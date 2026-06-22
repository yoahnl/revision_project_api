import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type DiagnosticQuizActivity,
  type DiagnosticQuizGenerationContext,
} from './activities.repository';
import {
  DIAGNOSTIC_QUIZ_GENERATOR,
  type GeneratedDiagnosticQuiz,
  type GeneratedDiagnosticQuizQuestion,
  type DiagnosticQuizGenerator,
} from './diagnostic-quiz-generator';
import {
  QUESTION_BANK_REPOSITORY,
  type CourseQuickQuestionKnowledgeUnitInput,
  type QuestionBankRepository,
  type QuestionBankReservedQuestionDto,
} from './question-bank.repository';

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
  aiGenerations: CourseQuickQuestionBankPreparationAiGenerationStats[];
}

export interface CourseQuickQuestionBankPreparationAiGenerationStats {
  provider: string;
  model: string;
  fallbackUsed: boolean;
  generatedCount: number;
  persistedCount: number;
}

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

  constructor(
    @Inject(QUESTION_BANK_REPOSITORY)
    private readonly questionBankRepository: QuestionBankRepository,
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
    preparationJobId?: string;
    questionCount?: number;
  }): Promise<CourseQuickQuestionBankPreparationStats> {
    const questionCount = resolveQuickQuestionBankQuestionCount(
      input.questionCount,
    );
    this.logger.log({
      event: 'course_question_bank_prepare_service_start',
      courseId: input.courseId,
      preparationJobId: input.preparationJobId,
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
    return this.questionBankRepository.countActiveCourseQuickQuestions(input);
  }

  private async ensureQuestionPool(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    preparationJobId?: string;
    questionCount: number;
    context: DiagnosticQuizGenerationContext;
  }): Promise<CourseQuickQuestionBankPreparationStats> {
    let activeKnowledgeUnitCount =
      await this.questionBankRepository.countActiveCourseQuickQuestions(input);
    let activeCourseCount =
      await this.questionBankRepository.countActiveCourseQuickQuestions({
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: input.courseId,
      });
    const stats: CourseQuickQuestionBankPreparationStats = {
      activeBefore: activeKnowledgeUnitCount,
      activeAfter: activeKnowledgeUnitCount,
      generatedCount: 0,
      persistedCount: 0,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
      aiGenerations: [],
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
        correlationId: input.preparationJobId,
        knowledgeUnit: input.context.knowledgeUnit,
        chunks: input.context.chunks,
        questionCount: batchSize,
        selectionModes: ['single'],
        visualsEnabled: false,
      });

      stats.generatedCount += generatedQuiz.questions.length;
      const persistenceStats =
        await this.questionBankRepository.persistGeneratedQuestions({
          ...input,
          quiz: generatedQuiz,
        });
      stats.persistedCount += persistenceStats.persistedCount;
      stats.duplicateSkippedCount += persistenceStats.duplicateSkippedCount;
      stats.structureSkippedCount += persistenceStats.structureSkippedCount;
      recordAiGenerationStats({
        stats,
        quiz: generatedQuiz,
        generatedCount: generatedQuiz.questions.length,
        persistedCount: persistenceStats.persistedCount,
      });
      const nextActiveKnowledgeUnitCount =
        await this.questionBankRepository.countActiveCourseQuickQuestions(
          input,
        );
      const nextActiveCourseCount =
        await this.questionBankRepository.countActiveCourseQuickQuestions({
          studentId: input.studentId,
          subjectId: input.subjectId,
          courseId: input.courseId,
        });
      stats.activeAfter = nextActiveKnowledgeUnitCount;

      this.logger.log({
        event: 'course_question_bank_prepare_batch',
        courseId: input.courseId,
        preparationJobId: input.preparationJobId,
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
      preparationJobId: input.preparationJobId,
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
  private async reserveQuestions(
    input: CourseQuickReservationInput,
  ): Promise<QuestionBankReservedQuestionDto[]> {
    return this.questionBankRepository.reserveCourseQuickQuestions({
      ...input,
      maxAttempts: QUICK_QUESTION_BANK_RESERVATION_MAX_ATTEMPTS,
    });
  }
}

function recordAiGenerationStats(input: {
  stats: CourseQuickQuestionBankPreparationStats;
  quiz: GeneratedDiagnosticQuiz;
  generatedCount: number;
  persistedCount: number;
}) {
  const metadata = input.quiz.metadata;

  if (!metadata) {
    return;
  }

  const existing = input.stats.aiGenerations.find(
    (generation) =>
      generation.provider === metadata.provider &&
      generation.model === metadata.model &&
      generation.fallbackUsed === (metadata.fallbackUsed === true),
  );

  if (existing) {
    existing.generatedCount += input.generatedCount;
    existing.persistedCount += input.persistedCount;
    return;
  }

  input.stats.aiGenerations.push({
    provider: metadata.provider,
    model: metadata.model,
    fallbackUsed: metadata.fallbackUsed === true,
    generatedCount: input.generatedCount,
    persistedCount: input.persistedCount,
  });
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

function toGeneratedQuiz(
  questions: QuestionBankReservedQuestionDto[],
): GeneratedDiagnosticQuiz {
  return {
    title: 'Révision rapide',
    version: 3,
    questions: questions.map(toGeneratedQuestion),
  };
}

function toGeneratedQuestion(
  question: QuestionBankReservedQuestionDto,
): GeneratedDiagnosticQuizQuestion {
  return {
    bankQuestionId: question.id,
    documentId: question.documentId,
    knowledgeUnitId: question.knowledgeUnitId,
    prompt: question.prompt,
    difficulty: question.difficulty,
    choices: question.choices,
    selectionMode: question.selectionMode,
    minSelections: question.minSelections,
    maxSelections: question.maxSelections,
    correctChoiceId: question.correctChoiceId,
    correctChoiceIds: question.correctChoiceIds,
    explanation: question.explanation,
    sourceChunkIds: question.sourceChunkIds,
    visuals: question.visuals,
  };
}

function safeStudentRef(studentId: string) {
  return createHash('sha256').update(studentId).digest('hex').slice(0, 12);
}
