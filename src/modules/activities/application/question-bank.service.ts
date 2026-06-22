import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
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

type CourseQuickQuestionKnowledgeUnitInput = {
  id: string;
  documentId: string;
};

type CourseQuickQuestionContext = {
  primaryDocumentId: string;
  primaryKnowledgeUnitId: string;
  knowledgeUnits: CourseQuickQuestionKnowledgeUnitInput[];
};

type CourseQuickReservationInput = {
  studentId: string;
  subjectId: string;
  courseId: string;
  knowledgeUnits: CourseQuickQuestionKnowledgeUnitInput[];
  questionCount: number;
};

const QUICK_QUESTION_BANK_RESERVATION_MAX_ATTEMPTS = 3;

export interface CourseQuickQuestionBankPreparationStats {
  activeBefore: number;
  activeAfter: number;
  generatedCount: number;
  persistedCount: number;
  duplicateSkippedCount: number;
  structureSkippedCount: number;
}

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

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
    documentId?: string;
    knowledgeUnitId?: string;
    knowledgeUnits?: CourseQuickQuestionKnowledgeUnitInput[];
    questionCount?: number;
  }): Promise<DiagnosticQuizActivity> {
    const questionCount = resolveQuickQuestionBankQuestionCount(
      input.questionCount,
    );
    const quickContext = resolveCourseQuickQuestionContext(input);

    const selectedQuestions = await this.reserveQuestions({
      studentId: input.studentId,
      subjectId: input.subjectId,
      courseId: input.courseId,
      knowledgeUnits: quickContext.knowledgeUnits,
      questionCount,
    });

    if (selectedQuestions.length < questionCount) {
      throw new Error(QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS);
    }

    return this.activitiesRepository.createDiagnosticQuiz({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: quickContext.primaryKnowledgeUnitId,
      documentId: quickContext.primaryDocumentId,
      quiz: toGeneratedQuiz(selectedQuestions),
    });
  }

  async prepareCourseQuickQuestionBank(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    questionCount?: number;
  }): Promise<CourseQuickQuestionBankPreparationStats> {
    const questionCount = resolveQuickQuestionBankQuestionCount(
      input.questionCount,
    );
    this.logger.log({
      event: 'course_question_bank_prepare_service_start',
      courseId: input.courseId,
      knowledgeUnitId: input.knowledgeUnitId,
      studentRef: safeStudentRef(input.studentId),
      questionCount,
    });
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

    return this.ensureQuestionPool({
      ...input,
      questionCount,
      context,
    });
  }

  async countActiveCourseQuickQuestions(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    knowledgeUnitId?: string;
    knowledgeUnitIds?: string[];
  }): Promise<number> {
    return this.countActiveQuestions(input);
  }

  private async ensureQuestionPool(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    questionCount: number;
    context: DiagnosticQuizGenerationContext;
  }): Promise<CourseQuickQuestionBankPreparationStats> {
    let activeKnowledgeUnitCount = await this.countActiveQuestions(input);
    let activeCourseCount = await this.countActiveCourseQuestions(input);
    const stats: CourseQuickQuestionBankPreparationStats = {
      activeBefore: activeKnowledgeUnitCount,
      activeAfter: activeKnowledgeUnitCount,
      generatedCount: 0,
      persistedCount: 0,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    };

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

      stats.generatedCount += generatedQuiz.questions.length;
      const persistenceStats = await this.persistGeneratedQuestions({
        ...input,
        quiz: generatedQuiz,
      });
      stats.persistedCount += persistenceStats.persistedCount;
      stats.duplicateSkippedCount += persistenceStats.duplicateSkippedCount;
      stats.structureSkippedCount += persistenceStats.structureSkippedCount;
      const nextActiveKnowledgeUnitCount =
        await this.countActiveQuestions(input);
      const nextActiveCourseCount =
        await this.countActiveCourseQuestions(input);
      stats.activeAfter = nextActiveKnowledgeUnitCount;

      this.logger.log({
        event: 'course_question_bank_prepare_batch',
        courseId: input.courseId,
        knowledgeUnitId: input.knowledgeUnitId,
        studentRef: safeStudentRef(input.studentId),
        targetQuestionCount: input.questionCount,
        generatedCount: generatedQuiz.questions.length,
        persistedCount: persistenceStats.persistedCount,
        duplicateSkippedCount: persistenceStats.duplicateSkippedCount,
        structureSkippedCount: persistenceStats.structureSkippedCount,
        activeBefore: activeKnowledgeUnitCount,
        activeAfter: nextActiveKnowledgeUnitCount,
      });

      if (
        nextActiveKnowledgeUnitCount === activeKnowledgeUnitCount &&
        nextActiveCourseCount === activeCourseCount
      ) {
        break;
      }

      activeKnowledgeUnitCount = nextActiveKnowledgeUnitCount;
      activeCourseCount = nextActiveCourseCount;
    }

    this.logger.log({
      event: 'course_question_bank_prepare_service_done',
      courseId: input.courseId,
      knowledgeUnitId: input.knowledgeUnitId,
      studentRef: safeStudentRef(input.studentId),
      targetQuestionCount: input.questionCount,
      activeBefore: stats.activeBefore,
      activeAfter: stats.activeAfter,
      generatedCount: stats.generatedCount,
      persistedCount: stats.persistedCount,
      duplicateSkippedCount: stats.duplicateSkippedCount,
      structureSkippedCount: stats.structureSkippedCount,
    });

    return stats;
  }

  private countActiveQuestions(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    knowledgeUnitId?: string;
    knowledgeUnitIds?: string[];
  }) {
    const knowledgeUnitIds = resolveKnowledgeUnitIds(input);

    return this.prisma.questionBankItem.count({
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
  }): Promise<{
    persistedCount: number;
    duplicateSkippedCount: number;
    structureSkippedCount: number;
  }> {
    const stats = {
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

  private async reserveQuestions(
    input: CourseQuickReservationInput,
  ): Promise<QuestionBankItemWithRelations[]> {
    for (
      let attempt = 0;
      attempt < QUICK_QUESTION_BANK_RESERVATION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const reserved = await this.tryReserveQuestions(input).catch((error) => {
        if (error instanceof QuestionBankReservationConflictError) {
          return [];
        }

        throw error;
      });

      if (reserved.length === input.questionCount) {
        return reserved;
      }
    }

    return [];
  }

  private async tryReserveQuestions(
    input: CourseQuickReservationInput,
  ): Promise<QuestionBankItemWithRelations[]> {
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

      return selectedQuestions;
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

function resolveCourseQuickQuestionContext(input: {
  documentId?: string;
  knowledgeUnitId?: string;
  knowledgeUnits?: CourseQuickQuestionKnowledgeUnitInput[];
}): CourseQuickQuestionContext {
  const knowledgeUnits = dedupeKnowledgeUnits([
    ...(input.knowledgeUnits ?? []),
    ...(input.knowledgeUnitId && input.documentId
      ? [{ id: input.knowledgeUnitId, documentId: input.documentId }]
      : []),
  ]);

  const [primaryKnowledgeUnit] = knowledgeUnits;

  if (!primaryKnowledgeUnit) {
    throw new Error(QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY);
  }

  return {
    primaryDocumentId: primaryKnowledgeUnit.documentId,
    primaryKnowledgeUnitId: primaryKnowledgeUnit.id,
    knowledgeUnits,
  };
}

function resolveKnowledgeUnitIds(input: {
  knowledgeUnitId?: string;
  knowledgeUnitIds?: string[];
}): string[] {
  const knowledgeUnitIds = dedupeStrings([
    ...(input.knowledgeUnitIds ?? []),
    ...(input.knowledgeUnitId ? [input.knowledgeUnitId] : []),
  ]);

  if (knowledgeUnitIds.length === 0) {
    throw new Error(QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY);
  }

  return knowledgeUnitIds;
}

function dedupeKnowledgeUnits(
  knowledgeUnits: CourseQuickQuestionKnowledgeUnitInput[],
): CourseQuickQuestionKnowledgeUnitInput[] {
  const byId = new Map<string, CourseQuickQuestionKnowledgeUnitInput>();

  for (const knowledgeUnit of knowledgeUnits) {
    if (
      knowledgeUnit.id.length === 0 ||
      knowledgeUnit.documentId.length === 0
    ) {
      continue;
    }

    byId.set(knowledgeUnit.id, knowledgeUnit);
  }

  return [...byId.values()];
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

function safeStudentRef(studentId: string) {
  return createHash('sha256').update(studentId).digest('hex').slice(0, 12);
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
