import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  QuestionBankItemStatus,
  QuestionSelectionMode,
  QuestionVisualType,
} from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type DiagnosticQuizActivity,
  type DiagnosticQuizGenerationContext,
} from './activities.repository';
import {
  DIAGNOSTIC_QUIZ_GENERATOR,
  type GeneratedDiagnosticQuiz,
  type GeneratedDiagnosticQuizChoice,
  type GeneratedDiagnosticQuizQuestion,
  type GeneratedDiagnosticQuizVisual,
  type DiagnosticQuizGenerator,
} from './diagnostic-quiz-generator';

export const QUICK_QUESTION_BANK_MIN_QUESTION_COUNT = 5;
export const QUICK_QUESTION_BANK_DEFAULT_QUESTION_COUNT = 10;
export const QUICK_QUESTION_BANK_MAX_QUESTION_COUNT = 30;
export const QUICK_QUESTION_BANK_GENERATION_BATCH_SIZE = 2;
export const QUICK_QUESTION_BANK_ACTIVE_CAP_PER_COURSE = 100;

export const QUICK_QUESTION_BANK_COUNT_INVALID =
  'QUICK_QUESTION_BANK_COUNT_INVALID';
export const QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY =
  'QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY';
export const QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS =
  'QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS';

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
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(DIAGNOSTIC_QUIZ_GENERATOR)
    private readonly diagnosticQuizGenerator: DiagnosticQuizGenerator,
  ) {}

  async createCourseQuickDiagnosticQuiz(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    questionCount?: number;
  }): Promise<DiagnosticQuizActivity> {
    const questionCount = resolveQuickQuestionBankQuestionCount(
      input.questionCount,
    );
    const context =
      await this.activitiesRepository.findDiagnosticQuizGenerationContext({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: input.knowledgeUnitId,
      });

    if (
      !context ||
      context.documentId !== input.documentId ||
      context.chunks.length === 0
    ) {
      throw new Error(QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY);
    }

    await this.ensureQuestionPool({
      ...input,
      questionCount,
      context,
    });

    const selectedQuestions = await this.reserveQuestions({
      ...input,
      questionCount,
    });

    if (selectedQuestions.length < questionCount) {
      throw new Error(QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS);
    }

    return this.activitiesRepository.createDiagnosticQuiz({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: input.knowledgeUnitId,
      documentId: input.documentId,
      quiz: toGeneratedQuiz(selectedQuestions),
    });
  }

  private async ensureQuestionPool(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    questionCount: number;
    context: DiagnosticQuizGenerationContext;
  }): Promise<void> {
    let activeKnowledgeUnitCount = await this.countActiveQuestions(input);
    let activeCourseCount = await this.countActiveCourseQuestions(input);

    while (
      activeKnowledgeUnitCount < input.questionCount &&
      activeCourseCount < QUICK_QUESTION_BANK_ACTIVE_CAP_PER_COURSE
    ) {
      const batchSize = Math.min(
        QUICK_QUESTION_BANK_GENERATION_BATCH_SIZE,
        input.questionCount - activeKnowledgeUnitCount,
        QUICK_QUESTION_BANK_ACTIVE_CAP_PER_COURSE - activeCourseCount,
      );

      const generatedQuiz = await this.diagnosticQuizGenerator.generate({
        subjectId: input.subjectId,
        documentId: input.documentId,
        knowledgeUnit: input.context.knowledgeUnit,
        chunks: input.context.chunks,
        questionCount: batchSize,
        selectionModes: ['single'],
        visualsEnabled: false,
      });

      await this.persistGeneratedQuestions({
        ...input,
        quiz: generatedQuiz,
      });
      const nextActiveKnowledgeUnitCount =
        await this.countActiveQuestions(input);
      const nextActiveCourseCount =
        await this.countActiveCourseQuestions(input);

      if (
        nextActiveKnowledgeUnitCount === activeKnowledgeUnitCount &&
        nextActiveCourseCount === activeCourseCount
      ) {
        break;
      }

      activeKnowledgeUnitCount = nextActiveKnowledgeUnitCount;
      activeCourseCount = nextActiveCourseCount;
    }
  }

  private countActiveQuestions(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    knowledgeUnitId: string;
  }) {
    return this.prisma.questionBankItem.count({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: input.courseId,
        knowledgeUnitId: input.knowledgeUnitId,
        status: QuestionBankItemStatus.ACTIVE,
      },
    });
  }

  private countActiveCourseQuestions(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
  }) {
    return this.prisma.questionBankItem.count({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: input.courseId,
        status: QuestionBankItemStatus.ACTIVE,
      },
    });
  }

  private async persistGeneratedQuestions(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    quiz: GeneratedDiagnosticQuiz;
  }): Promise<void> {
    for (const question of input.quiz.questions) {
      if (isPdfStructureQuestion(question)) {
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
    }
  }

  private async reserveQuestions(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    knowledgeUnitId: string;
    questionCount: number;
  }): Promise<QuestionBankItemWithRelations[]> {
    return this.prisma.$transaction(async (tx) => {
      const available = await tx.questionBankItem.findMany({
        where: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          courseId: input.courseId,
          knowledgeUnitId: input.knowledgeUnitId,
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
        take: input.questionCount,
      });

      const selectedIds = available.map((question) => question.id);

      if (selectedIds.length > 0) {
        await tx.questionBankItem.updateMany({
          where: {
            id: {
              in: selectedIds,
            },
            studentId: input.studentId,
          },
          data: {
            askedCount: {
              increment: 1,
            },
            lastAskedAt: new Date(),
          },
        });
      }

      return available;
    });
  }
}

export function resolveQuickQuestionBankQuestionCount(
  questionCount: number | undefined,
): number {
  const resolvedQuestionCount =
    questionCount ?? QUICK_QUESTION_BANK_DEFAULT_QUESTION_COUNT;

  if (
    !Number.isInteger(resolvedQuestionCount) ||
    resolvedQuestionCount < QUICK_QUESTION_BANK_MIN_QUESTION_COUNT ||
    resolvedQuestionCount > QUICK_QUESTION_BANK_MAX_QUESTION_COUNT
  ) {
    throw new Error(QUICK_QUESTION_BANK_COUNT_INVALID);
  }

  return resolvedQuestionCount;
}

function toGeneratedQuiz(
  questions: QuestionBankItemWithRelations[],
): GeneratedDiagnosticQuiz {
  return {
    title: 'Révision rapide',
    version: 3,
    questions: questions.map(toGeneratedQuestion),
  };
}

function toGeneratedQuestion(
  question: QuestionBankItemWithRelations,
): GeneratedDiagnosticQuizQuestion {
  return {
    bankQuestionId: question.id,
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
