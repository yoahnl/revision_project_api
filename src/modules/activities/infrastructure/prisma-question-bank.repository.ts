import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import {
  QuestionBankItemStatus,
  QuestionSelectionMode,
  QuestionVisualType,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  CountActiveCourseQuickQuestionsInput,
  CountActiveCourseQuickQuestionsByKnowledgeUnitInput,
  PersistGeneratedQuestionsInput,
  QuestionBankPersistenceStats,
  QuestionBankRepository,
  QuestionBankReservedQuestionDto,
  ReserveCourseQuickQuestionsInput,
} from '../application/question-bank.repository';
import type {
  GeneratedDiagnosticQuizChoice,
  GeneratedDiagnosticQuizQuestion,
  GeneratedDiagnosticQuizVisual,
} from '../application/diagnostic-quiz-generator';

type QuestionBankItemWithRelations = Prisma.QuestionBankItemGetPayload<{
  include: {
    sources: true;
    visuals: {
      orderBy: {
        displayOrder: 'asc';
      };
    };
  };
}>;

@Injectable()
export class PrismaQuestionBankRepository implements QuestionBankRepository {
  constructor(private readonly prisma: PrismaService) {}

  countActiveCourseQuickQuestions(
    input: CountActiveCourseQuickQuestionsInput,
  ): Promise<number> {
    const knowledgeUnitIds = resolveKnowledgeUnitIds(input);

    return this.prisma.questionBankItem.count({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: input.courseId,
        ...(knowledgeUnitIds.length > 0
          ? {
              knowledgeUnitId:
                knowledgeUnitIds.length === 1
                  ? knowledgeUnitIds[0]
                  : { in: knowledgeUnitIds },
            }
          : {}),
        status: QuestionBankItemStatus.ACTIVE,
      },
    });
  }

  async countActiveCourseQuickQuestionsByKnowledgeUnit(
    input: CountActiveCourseQuickQuestionsByKnowledgeUnitInput,
  ): Promise<Map<string, number>> {
    const knowledgeUnitIds = dedupeStrings(input.knowledgeUnitIds);
    const counts = new Map(
      knowledgeUnitIds.map((knowledgeUnitId) => [knowledgeUnitId, 0]),
    );

    if (knowledgeUnitIds.length === 0) {
      return counts;
    }

    const grouped = await this.prisma.questionBankItem.groupBy({
      by: ['knowledgeUnitId'],
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: input.courseId,
        knowledgeUnitId: { in: knowledgeUnitIds },
        status: QuestionBankItemStatus.ACTIVE,
      },
      _count: { _all: true },
    });

    for (const row of grouped) {
      counts.set(row.knowledgeUnitId, row._count._all);
    }

    return counts;
  }

  async persistGeneratedQuestions(
    input: PersistGeneratedQuestionsInput,
  ): Promise<QuestionBankPersistenceStats> {
    const stats: QuestionBankPersistenceStats = {
      persistedCount: 0,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    };

    for (const question of input.quiz.questions) {
      if (isPdfStructureQuestion(question)) {
        stats.structureSkippedCount += 1;
        continue;
      }

      const fingerprint = fingerprintQuestion(input.knowledgeUnitId, question);
      const existing = await this.prisma.questionBankItem.findUnique({
        where: {
          courseId_fingerprint: {
            courseId: input.courseId,
            fingerprint,
          },
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        stats.duplicateSkippedCount += 1;
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const created = await tx.questionBankItem.create({
          data: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            courseId: input.courseId,
            documentId: input.documentId,
            knowledgeUnitId: input.knowledgeUnitId,
            prompt: question.prompt,
            difficulty: question.difficulty ?? null,
            choices: toJsonValue(question.choices),
            selectionMode:
              question.selectionMode === 'multiple'
                ? QuestionSelectionMode.MULTIPLE
                : QuestionSelectionMode.SINGLE,
            minSelections: question.minSelections ?? null,
            maxSelections: question.maxSelections ?? null,
            correctChoiceId: question.correctChoiceId ?? null,
            correctChoiceIds:
              question.correctChoiceIds === undefined
                ? undefined
                : toJsonValue(question.correctChoiceIds),
            explanation: question.explanation,
            fingerprint,
          },
        });

        const sourceChunkIds = dedupeStrings(question.sourceChunkIds ?? []);

        if (sourceChunkIds.length > 0) {
          await tx.questionBankItemSource.createMany({
            data: sourceChunkIds.map((chunkId) => ({
              questionBankItemId: created.id,
              subjectId: input.subjectId,
              chunkId,
            })),
          });
        }

        const visuals = question.visuals ?? [];

        if (visuals.length > 0) {
          await tx.questionBankItemVisual.createMany({
            data: visuals.map((visual, fallbackDisplayOrder) => ({
              questionBankItemId: created.id,
              type: toVisualType(visual.type),
              displayOrder: visual.displayOrder ?? fallbackDisplayOrder,
              payload: toJsonValue(toVisualPayload(visual)),
            })),
          });
        }
      });
      stats.persistedCount += 1;
    }

    return stats;
  }

  async reserveCourseQuickQuestions(
    input: ReserveCourseQuickQuestionsInput,
  ): Promise<QuestionBankReservedQuestionDto[]> {
    for (let attempt = 0; attempt < input.maxAttempts; attempt += 1) {
      const reserved = await this.tryReserveCourseQuickQuestions(input).catch(
        (error) => {
          if (error instanceof QuestionBankReservationConflictError) {
            return [];
          }

          throw error;
        },
      );

      if (reserved.length === input.questionCount) {
        return reserved;
      }
    }

    return [];
  }

  private async tryReserveCourseQuickQuestions(
    input: ReserveCourseQuickQuestionsInput,
  ): Promise<QuestionBankReservedQuestionDto[]> {
    const knowledgeUnitIds = input.knowledgeUnits.map((unit) => unit.id);

    return this.prisma.$transaction(async (tx) => {
      const available = await tx.questionBankItem.findMany({
        where: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          courseId: input.courseId,
          knowledgeUnitId:
            knowledgeUnitIds.length === 1
              ? knowledgeUnitIds[0]
              : { in: knowledgeUnitIds },
          status: QuestionBankItemStatus.ACTIVE,
        },
        include: {
          sources: true,
          visuals: {
            orderBy: {
              displayOrder: 'asc',
            },
          },
        },
        orderBy: [
          { askedCount: 'asc' },
          { lastAskedAt: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      });

      const selectedQuestions = selectBalancedQuestions({
        questions: available,
        knowledgeUnitIds,
        questionCount: input.questionCount,
      });

      if (selectedQuestions.length < input.questionCount) {
        return [];
      }

      const reservedAt = new Date();

      for (const question of selectedQuestions) {
        const result = await tx.questionBankItem.updateMany({
          where: {
            id: question.id,
            studentId: input.studentId,
            askedCount: question.askedCount,
            lastAskedAt: question.lastAskedAt,
            status: QuestionBankItemStatus.ACTIVE,
          },
          data: {
            askedCount: {
              increment: 1,
            },
            lastAskedAt: reservedAt,
          },
        });

        if (result.count !== 1) {
          throw new QuestionBankReservationConflictError();
        }
      }

      return selectedQuestions.map(toReservedQuestionDto);
    });
  }
}

function resolveKnowledgeUnitIds(input: {
  knowledgeUnitId?: string;
  knowledgeUnitIds?: string[];
}): string[] {
  return dedupeStrings([
    ...(input.knowledgeUnitIds ?? []),
    ...(input.knowledgeUnitId ? [input.knowledgeUnitId] : []),
  ]);
}

function selectBalancedQuestions(input: {
  questions: QuestionBankItemWithRelations[];
  knowledgeUnitIds: string[];
  questionCount: number;
}): QuestionBankItemWithRelations[] {
  const groupedByKnowledgeUnitId = new Map<
    string,
    QuestionBankItemWithRelations[]
  >();

  for (const knowledgeUnitId of input.knowledgeUnitIds) {
    groupedByKnowledgeUnitId.set(knowledgeUnitId, []);
  }

  for (const question of input.questions) {
    groupedByKnowledgeUnitId.get(question.knowledgeUnitId)?.push(question);
  }

  const selectedQuestions: QuestionBankItemWithRelations[] = [];

  while (selectedQuestions.length < input.questionCount) {
    let addedInPass = false;

    for (const knowledgeUnitId of input.knowledgeUnitIds) {
      const questions = groupedByKnowledgeUnitId.get(knowledgeUnitId);
      const nextQuestion = questions?.shift();

      if (!nextQuestion) {
        continue;
      }

      selectedQuestions.push(nextQuestion);
      addedInPass = true;

      if (selectedQuestions.length === input.questionCount) {
        break;
      }
    }

    if (!addedInPass) {
      break;
    }
  }

  return selectedQuestions;
}

function toReservedQuestionDto(
  question: QuestionBankItemWithRelations,
): QuestionBankReservedQuestionDto {
  return {
    id: question.id,
    documentId: question.documentId,
    knowledgeUnitId: question.knowledgeUnitId,
    prompt: question.prompt,
    difficulty: question.difficulty,
    choices: toGeneratedChoices(question.choices),
    selectionMode:
      question.selectionMode === QuestionSelectionMode.MULTIPLE
        ? 'multiple'
        : 'single',
    minSelections: question.minSelections,
    maxSelections: question.maxSelections,
    correctChoiceId: question.correctChoiceId,
    correctChoiceIds: toStringArray(question.correctChoiceIds),
    explanation: question.explanation,
    sourceChunkIds: question.sources.map((source) => source.chunkId),
    visuals: question.visuals.map(toGeneratedVisual),
  };
}

function toGeneratedChoices(
  value: Prisma.JsonValue,
): GeneratedDiagnosticQuizChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const choices: GeneratedDiagnosticQuizChoice[] = [];

  for (const choice of value) {
    if (
      typeof choice !== 'object' ||
      choice === null ||
      !('id' in choice) ||
      !('label' in choice) ||
      typeof choice.id !== 'string' ||
      typeof choice.label !== 'string'
    ) {
      continue;
    }

    choices.push({
      id: choice.id,
      label: choice.label,
      feedback:
        'feedback' in choice && typeof choice.feedback === 'string'
          ? choice.feedback
          : null,
    });
  }

  return choices;
}

function toGeneratedVisual(
  visual: QuestionBankItemWithRelations['visuals'][number],
): GeneratedDiagnosticQuizVisual {
  const payload =
    typeof visual.payload === 'object' && visual.payload !== null
      ? (visual.payload as Record<string, unknown>)
      : {};

  if (visual.type === QuestionVisualType.CHART) {
    return {
      type: 'CHART',
      displayOrder: visual.displayOrder,
      sourceChunkIds: [],
      chartType: payload.chartType === 'line' ? 'line' : 'bar',
      title: typeof payload.title === 'string' ? payload.title : 'Graphique',
      description:
        typeof payload.description === 'string' ? payload.description : null,
      data: Array.isArray(payload.data)
        ? (payload.data as Array<Record<string, string | number | null>>)
        : [],
      xKey: typeof payload.xKey === 'string' ? payload.xKey : null,
      yKeys: Array.isArray(payload.yKeys)
        ? payload.yKeys.filter((key): key is string => typeof key === 'string')
        : null,
    };
  }

  if (visual.type === QuestionVisualType.DIAGRAM) {
    return {
      type: 'DIAGRAM',
      displayOrder: visual.displayOrder,
      sourceChunkIds: [],
      title: typeof payload.title === 'string' ? payload.title : 'Schéma',
      description:
        typeof payload.description === 'string' ? payload.description : null,
      nodes: Array.isArray(payload.nodes)
        ? (payload.nodes as Array<{ id: string; label: string }>)
        : [],
      edges: Array.isArray(payload.edges)
        ? (payload.edges as Array<{
            from: string;
            to: string;
            label?: string | null;
          }>)
        : [],
    };
  }

  return {
    type: 'IMAGE',
    displayOrder: visual.displayOrder,
    sourceChunkIds: [],
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : '',
    altText: typeof payload.altText === 'string' ? payload.altText : 'Image',
    caption: typeof payload.caption === 'string' ? payload.caption : null,
  };
}

function toVisualPayload(visual: GeneratedDiagnosticQuizVisual) {
  if (visual.type === 'CHART') {
    return {
      chartType: visual.chartType,
      title: visual.title,
      description: visual.description ?? null,
      data: visual.data,
      xKey: visual.xKey ?? null,
      yKeys: visual.yKeys ?? null,
    };
  }

  if (visual.type === 'DIAGRAM') {
    return {
      title: visual.title,
      description: visual.description ?? null,
      nodes: visual.nodes,
      edges: visual.edges ?? [],
    };
  }

  return {
    imageUrl: visual.imageUrl,
    altText: visual.altText,
    caption: visual.caption ?? null,
  };
}

function toVisualType(type: GeneratedDiagnosticQuizVisual['type']) {
  if (type === 'CHART') {
    return QuestionVisualType.CHART;
  }

  if (type === 'DIAGRAM') {
    return QuestionVisualType.DIAGRAM;
  }

  return QuestionVisualType.IMAGE;
}

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function fingerprintQuestion(
  knowledgeUnitId: string,
  question: GeneratedDiagnosticQuizQuestion,
): string {
  const normalized = JSON.stringify({
    knowledgeUnitId,
    prompt: normalizeForFingerprint(question.prompt),
    choices: question.choices.map((choice) =>
      normalizeForFingerprint(choice.label),
    ),
    correctChoiceId: question.correctChoiceId ?? null,
    correctChoiceIds: question.correctChoiceIds ?? [],
  });

  return createHash('sha256').update(normalized).digest('hex');
}

function normalizeForFingerprint(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPdfStructureQuestion(question: GeneratedDiagnosticQuizQuestion) {
  const text = normalizeForFingerprint(
    [
      question.prompt,
      question.explanation,
      ...question.choices.map((choice) => choice.label),
    ].join(' '),
  );
  const structuralMarkers = [
    'table des matieres',
    'table des matières',
    'sommaire',
    'plan du cours',
    'structure du document',
    'structure du pdf',
    'page ',
    'pages ',
    'numero de page',
    'numéro de page',
    'annee universitaire',
    'année universitaire',
    'bibliographie',
    'plagiat',
    'contact',
    'email',
    'courriel',
    'ufr',
    'l1-',
    'l1 ',
  ];

  return structuralMarkers.some((marker) => text.includes(marker));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

class QuestionBankReservationConflictError extends Error {}
