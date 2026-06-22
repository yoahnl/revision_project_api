import {
  KnowledgeUnitDifficulty,
  QuestionBankItemStatus,
  QuestionSelectionMode,
} from '../../../generated/prisma/enums';
import type { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { ActivitiesRepository } from './activities.repository';
import type {
  DiagnosticQuizGenerator,
  GeneratedDiagnosticQuiz,
} from './diagnostic-quiz-generator';
import {
  QUICK_QUESTION_BANK_COUNT_INVALID,
  QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS,
  QuestionBankService,
} from './question-bank.service';

describe('QuestionBankService', () => {
  it('prepares missing questions in batches of two without creating a session snapshot', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    mocks.questionBankItemCount.mockResolvedValueOnce(0);
    mocks.questionBankItemCount.mockResolvedValueOnce(0);
    mocks.questionBankItemCount.mockResolvedValueOnce(2);
    mocks.questionBankItemCount.mockResolvedValueOnce(2);
    mocks.questionBankItemCount.mockResolvedValueOnce(4);
    mocks.questionBankItemCount.mockResolvedValueOnce(4);
    mocks.questionBankItemCount.mockResolvedValueOnce(6);
    mocks.questionBankItemCount.mockResolvedValueOnce(6);
    generator.generate
      .mockResolvedValueOnce(generatedQuiz('batch-a', 2))
      .mockResolvedValueOnce(generatedQuiz('batch-b', 2))
      .mockResolvedValueOnce(generatedQuiz('batch-c', 2));
    mocks.questionBankItemFindUnique.mockResolvedValue(null);
    mocks.questionBankItemCreate
      .mockResolvedValueOnce({ id: 'bank-a-1' })
      .mockResolvedValueOnce({ id: 'bank-a-2' })
      .mockResolvedValueOnce({ id: 'bank-b-1' })
      .mockResolvedValueOnce({ id: 'bank-b-2' })
      .mockResolvedValueOnce({ id: 'bank-c-1' })
      .mockResolvedValueOnce({ id: 'bank-c-2' });

    await service.prepareCourseQuickQuestionBank({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 6,
    });

    expect(generator.generate.mock.calls).toHaveLength(3);
    expect(
      generator.generate.mock.calls.map(([input]) => input.questionCount),
    ).toEqual([2, 2, 2]);
    expect(mocks.questionBankItemCreate.mock.calls).toHaveLength(6);
    expect(mocks.questionBankItemFindMany.mock.calls).toHaveLength(0);
    expect(mocks.questionBankItemUpdateMany.mock.calls).toHaveLength(0);
    expect(activitiesRepository.createDiagnosticQuiz.mock.calls).toHaveLength(
      0,
    );
  });

  it('snapshots a quick session quiz from an already prepared bank without calling the generator', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    mocks.questionBankItemFindMany.mockResolvedValue(bankItems(6));
    mocks.questionBankItemUpdateMany.mockResolvedValue({ count: 1 });
    activitiesRepository.createDiagnosticQuiz.mockResolvedValue({
      sessionId: 'activity-1',
      type: 'diagnostic_quiz',
      title: 'Révision rapide',
      questions: [],
    });

    await service.createCourseQuickDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 6,
    });

    expect(generator.generate.mock.calls).toHaveLength(0);
    const findManyCall = getFirstMockInput<QuestionBankItemFindManyInput>(
      mocks.questionBankItemFindMany.mock.calls,
    );
    expect(findManyCall.where.courseId).toBe('course-1');
    expect(findManyCall.where.knowledgeUnitId).toBe('ku-1');
    expect(findManyCall.where.status).toBe(QuestionBankItemStatus.ACTIVE);
    expect(findManyCall.orderBy).toEqual([
      { askedCount: 'asc' },
      { lastAskedAt: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    const reservedIds = mocks.questionBankItemUpdateMany.mock.calls.map(
      ([input]) => (input as QuestionBankItemUpdateManyInput).where.id,
    );
    expect(reservedIds).toEqual([
      'bank-1',
      'bank-2',
      'bank-3',
      'bank-4',
      'bank-5',
      'bank-6',
    ]);
    const updateManyCall = getFirstMockInput<QuestionBankItemUpdateManyInput>(
      mocks.questionBankItemUpdateMany.mock.calls,
    );
    expect(updateManyCall.where.studentId).toBe('student-1');
    expect(updateManyCall.data.askedCount).toEqual({ increment: 1 });
    expect(updateManyCall.data.lastAskedAt).toBeInstanceOf(Date);

    const createDiagnosticQuizCall =
      getFirstMockInput<CreateDiagnosticQuizInput>(
        activitiesRepository.createDiagnosticQuiz.mock.calls,
      );
    expect(createDiagnosticQuizCall.quiz.questions[0]?.bankQuestionId).toBe(
      'bank-1',
    );
  });

  it('snapshots a quick session quiz from multiple knowledge units with balanced questions', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();
    const preparedQuestions = [
      bankItem({ id: 'ku-1-bank-1', knowledgeUnitId: 'ku-1', askedCount: 0 }),
      bankItem({ id: 'ku-1-bank-2', knowledgeUnitId: 'ku-1', askedCount: 1 }),
      bankItem({ id: 'ku-1-bank-3', knowledgeUnitId: 'ku-1', askedCount: 2 }),
      bankItem({ id: 'ku-2-bank-1', knowledgeUnitId: 'ku-2', askedCount: 0 }),
      bankItem({ id: 'ku-2-bank-2', knowledgeUnitId: 'ku-2', askedCount: 1 }),
      bankItem({ id: 'ku-2-bank-3', knowledgeUnitId: 'ku-2', askedCount: 2 }),
      bankItem({ id: 'ku-3-bank-1', knowledgeUnitId: 'ku-3', askedCount: 0 }),
      bankItem({ id: 'ku-3-bank-2', knowledgeUnitId: 'ku-3', askedCount: 1 }),
    ];
    mocks.questionBankItemFindMany.mockResolvedValue(preparedQuestions);
    mocks.questionBankItemUpdateMany.mockResolvedValue({ count: 1 });
    activitiesRepository.createDiagnosticQuiz.mockResolvedValue({
      sessionId: 'activity-1',
      type: 'diagnostic_quiz',
      title: 'Révision rapide',
      questions: [],
    });

    await service.createCourseQuickDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      knowledgeUnits: [
        { id: 'ku-1', documentId: 'document-1' },
        { id: 'ku-2', documentId: 'document-1' },
        { id: 'ku-3', documentId: 'document-2' },
      ],
      questionCount: 6,
    });

    expect(generator.generate.mock.calls).toHaveLength(0);
    const findManyCall = getFirstMockInput<QuestionBankItemFindManyInput>(
      mocks.questionBankItemFindMany.mock.calls,
    );
    expect(findManyCall.where.knowledgeUnitId.in).toEqual([
      'ku-1',
      'ku-2',
      'ku-3',
    ]);
    expect(mocks.questionBankItemUpdateMany.mock.calls).toHaveLength(6);

    const createDiagnosticQuizCall =
      getFirstMockInput<CreateDiagnosticQuizInput>(
        activitiesRepository.createDiagnosticQuiz.mock.calls,
      );
    expect(
      createDiagnosticQuizCall.quiz.questions.map(
        (question) => question.knowledgeUnitId,
      ),
    ).toEqual(['ku-1', 'ku-2', 'ku-3', 'ku-1', 'ku-2', 'ku-3']);
    expect(
      createDiagnosticQuizCall.quiz.questions.map(
        (question) => question.bankQuestionId,
      ),
    ).toEqual([
      'ku-1-bank-1',
      'ku-2-bank-1',
      'ku-3-bank-1',
      'ku-1-bank-2',
      'ku-2-bank-2',
      'ku-3-bank-2',
    ]);
  });

  it('retries reservation when a concurrent session already claimed selected questions', async () => {
    const { activitiesRepository, mocks, service } = createHarness();
    mocks.questionBankItemFindMany
      .mockResolvedValueOnce(bankItems(5))
      .mockResolvedValueOnce(bankItems(5, { idPrefix: 'retry-bank' }));
    mocks.questionBankItemUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    activitiesRepository.createDiagnosticQuiz.mockResolvedValue({
      sessionId: 'activity-1',
      type: 'diagnostic_quiz',
      title: 'Révision rapide',
      questions: [],
    });

    await service.createCourseQuickDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 5,
    });

    expect(mocks.questionBankItemFindMany.mock.calls).toHaveLength(2);
    const createDiagnosticQuizCall =
      getFirstMockInput<CreateDiagnosticQuizInput>(
        activitiesRepository.createDiagnosticQuiz.mock.calls,
      );
    expect(createDiagnosticQuizCall.quiz.questions[0]?.bankQuestionId).toBe(
      'retry-bank-1',
    );
  });

  it('reuses existing active questions without calling the generator', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    mocks.questionBankItemCount.mockResolvedValueOnce(10);
    mocks.questionBankItemCount.mockResolvedValueOnce(10);
    mocks.questionBankItemFindMany.mockResolvedValue(bankItems(5));
    mocks.questionBankItemUpdateMany.mockResolvedValue({ count: 1 });
    activitiesRepository.createDiagnosticQuiz.mockResolvedValue({
      sessionId: 'activity-1',
      type: 'diagnostic_quiz',
      title: 'Révision rapide',
      questions: [],
    });

    await service.createCourseQuickDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 5,
    });

    expect(generator.generate.mock.calls).toHaveLength(0);
    const findManyCall = getFirstMockInput<QuestionBankItemFindManyInput>(
      mocks.questionBankItemFindMany.mock.calls,
    );
    expect(findManyCall.where.status).toBe(QuestionBankItemStatus.ACTIVE);
  });

  it('does not persist generated questions about PDF structure or metadata', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    mocks.questionBankItemCount.mockResolvedValueOnce(0);
    mocks.questionBankItemCount.mockResolvedValueOnce(0);
    mocks.questionBankItemCount.mockResolvedValueOnce(1);
    mocks.questionBankItemCount.mockResolvedValueOnce(1);
    mocks.questionBankItemCount.mockResolvedValueOnce(3);
    mocks.questionBankItemCount.mockResolvedValueOnce(3);
    mocks.questionBankItemCount.mockResolvedValueOnce(5);
    mocks.questionBankItemCount.mockResolvedValueOnce(5);
    generator.generate
      .mockResolvedValueOnce(
        generatedQuizWithPrompts('batch-a', [
          'Selon la table des matières, quelle page ouvre le cours 1 ?',
          'Quel contrôle limite les rapports entre pouvoir exécutif et législatif ?',
        ]),
      )
      .mockResolvedValueOnce(generatedQuiz('batch-b', 2))
      .mockResolvedValueOnce(generatedQuiz('batch-c', 2));
    mocks.questionBankItemFindUnique.mockResolvedValue(null);
    mocks.questionBankItemCreate
      .mockResolvedValueOnce({ id: 'bank-a-2' })
      .mockResolvedValueOnce({ id: 'bank-b-1' })
      .mockResolvedValueOnce({ id: 'bank-b-2' })
      .mockResolvedValueOnce({ id: 'bank-c-1' })
      .mockResolvedValueOnce({ id: 'bank-c-2' });
    mocks.questionBankItemFindMany.mockResolvedValue(bankItems(5));
    mocks.questionBankItemUpdateMany.mockResolvedValue({ count: 5 });
    activitiesRepository.createDiagnosticQuiz.mockResolvedValue({
      sessionId: 'activity-1',
      type: 'diagnostic_quiz',
      title: 'Révision rapide',
      questions: [],
    });

    await service.prepareCourseQuickQuestionBank({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 5,
    });

    expect(mocks.questionBankItemCreate.mock.calls).toHaveLength(5);
    const persistedPrompts = mocks.questionBankItemCreate.mock.calls.map(
      ([input]) => (input as { data: { prompt: string } }).data.prompt,
    );
    expect(persistedPrompts).not.toContain(
      'Selon la table des matières, quelle page ouvre le cours 1 ?',
    );
  });

  it('refuses to generate above the active cap and does not use flagged questions', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    mocks.questionBankItemCount.mockResolvedValueOnce(4);
    mocks.questionBankItemCount.mockResolvedValueOnce(100);
    mocks.questionBankItemFindMany.mockResolvedValue(bankItems(4));
    mocks.questionBankItemUpdateMany.mockResolvedValue({ count: 4 });

    await expect(
      service.createCourseQuickDiagnosticQuiz({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 5,
      }),
    ).rejects.toThrow(QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS);

    expect(generator.generate.mock.calls).toHaveLength(0);
    const findManyCall = getFirstMockInput<QuestionBankItemFindManyInput>(
      mocks.questionBankItemFindMany.mock.calls,
    );
    expect(findManyCall.where.status).toBe(QuestionBankItemStatus.ACTIVE);
    expect(activitiesRepository.createDiagnosticQuiz.mock.calls).toHaveLength(
      0,
    );
  });

  it('rejects invalid question counts before touching storage or providers', async () => {
    const { activitiesRepository, generator, mocks, service } = createHarness();

    await expect(
      service.createCourseQuickDiagnosticQuiz({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 31,
      }),
    ).rejects.toThrow(QUICK_QUESTION_BANK_COUNT_INVALID);

    expect(
      activitiesRepository.findDiagnosticQuizGenerationContext.mock.calls,
    ).toHaveLength(0);
    expect(generator.generate.mock.calls).toHaveLength(0);
    expect(mocks.questionBankItemCount.mock.calls).toHaveLength(0);
  });
});

function createHarness() {
  const mocks = {
    questionBankItemCount: jest.fn<Promise<number>, [unknown]>(),
    questionBankItemFindUnique: jest.fn<
      Promise<QuestionBankItemIdOnly | null>,
      [unknown]
    >(),
    questionBankItemCreate: jest.fn<
      Promise<QuestionBankItemIdOnly>,
      [unknown]
    >(),
    questionBankItemFindMany: jest.fn<
      Promise<QuestionBankItemRow[]>,
      [unknown]
    >(),
    questionBankItemUpdateMany: jest.fn<
      Promise<QuestionBankItemUpdateManyResult>,
      [unknown]
    >(),
    questionBankItemSourceCreateMany: jest.fn<
      Promise<QuestionBankItemUpdateManyResult>,
      [unknown]
    >(),
    questionBankItemVisualCreateMany: jest.fn<
      Promise<QuestionBankItemUpdateManyResult>,
      [unknown]
    >(),
  };
  const transaction = jest.fn(
    async <T>(callback: (tx: QuestionBankTransaction) => Promise<T>) =>
      callback(createTransaction(mocks)),
  );
  const prisma = {
    questionBankItem: {
      count: mocks.questionBankItemCount,
      findUnique: mocks.questionBankItemFindUnique,
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const activitiesRepository: jest.Mocked<ActivitiesRepository> = {
    findDiagnosticQuizGenerationContext: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    findRichClosedGenerationContext: jest.fn(),
    createRichClosedExerciseSession: jest.fn(),
    submitDiagnosticQuiz: jest.fn(),
    submitOpenAnswer: jest.fn(),
    findDiagnosticQuizResult: jest.fn(),
    findOpenAnswerEvaluationContext: jest.fn(),
    completeOpenAnswerEvaluation: jest.fn(),
    markOpenAnswerEvaluationFailed: jest.fn(),
    findRichClosedExerciseSession: jest.fn(),
    submitRichClosedExercise: jest.fn(),
    findRichClosedExerciseResult: jest.fn(),
  };
  const generator: jest.Mocked<DiagnosticQuizGenerator> = {
    generate: jest.fn(),
  };

  return {
    activitiesRepository,
    generator,
    mocks,
    service: new QuestionBankService(prisma, activitiesRepository, generator),
  };
}

function createTransaction(mocks: QuestionBankMocks): QuestionBankTransaction {
  return {
    questionBankItem: {
      create: mocks.questionBankItemCreate,
      findMany: mocks.questionBankItemFindMany,
      updateMany: mocks.questionBankItemUpdateMany,
    },
    questionBankItemSource: {
      createMany: mocks.questionBankItemSourceCreateMany,
    },
    questionBankItemVisual: {
      createMany: mocks.questionBankItemVisualCreateMany,
    },
  };
}

function generationContext() {
  return {
    documentId: 'document-1',
    knowledgeUnit: {
      id: 'ku-1',
      subjectId: 'subject-1',
      title: 'Notion',
      description: 'Description',
      bloomLevel: 'UNDERSTAND',
      difficulty: 'MEDIUM',
      sourceChunkIds: ['chunk-1'],
    },
    chunks: [
      {
        id: 'chunk-1',
        index: 0,
        text: 'Contenu source.',
        pageNumber: 1,
      },
    ],
  } satisfies Awaited<
    ReturnType<ActivitiesRepository['findDiagnosticQuizGenerationContext']>
  >;
}

function generatedQuiz(prefix: string, count: number): GeneratedDiagnosticQuiz {
  return {
    title: 'Révision rapide',
    version: 3,
    questions: Array.from({ length: count }, (_, index) => ({
      prompt: `${prefix} question ${index + 1}`,
      difficulty: 'MEDIUM',
      selectionMode: 'single',
      choices: [
        { id: 'a', label: 'Réponse A' },
        { id: 'b', label: 'Réponse B' },
      ],
      correctChoiceId: 'a',
      explanation: 'Explication.',
      sourceChunkIds: ['chunk-1'],
      visuals: [],
    })),
  };
}

function generatedQuizWithPrompts(
  prefix: string,
  prompts: string[],
): GeneratedDiagnosticQuiz {
  return {
    title: 'Révision rapide',
    version: 3,
    questions: prompts.map((prompt, index) => ({
      prompt,
      difficulty: 'MEDIUM',
      selectionMode: 'single',
      choices: [
        { id: 'a', label: `${prefix} réponse A ${index + 1}` },
        { id: 'b', label: `${prefix} réponse B ${index + 1}` },
      ],
      correctChoiceId: 'a',
      explanation: 'Explication.',
      sourceChunkIds: ['chunk-1'],
      visuals: [],
    })),
  };
}

function bankItems(
  count: number,
  options: { idPrefix?: string } = {},
): QuestionBankItemRow[] {
  const idPrefix = options.idPrefix ?? 'bank';
  return Array.from({ length: count }, (_, index) =>
    bankItem({
      id: `${idPrefix}-${index + 1}`,
      askedCount: index,
      lastAskedAt: index === 0 ? null : new Date(`2026-06-20T10:0${index}:00Z`),
      createdAt: new Date(`2026-06-20T09:0${index}:00Z`),
      updatedAt: new Date(`2026-06-20T09:0${index}:00Z`),
    }),
  );
}

function bankItem(
  overrides: Partial<QuestionBankItemRow> = {},
): QuestionBankItemRow {
  const id = overrides.id ?? 'bank-1';

  return {
    id,
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: 'course-1',
    documentId: 'document-1',
    knowledgeUnitId: 'ku-1',
    prompt: `Question ${id}`,
    difficulty: KnowledgeUnitDifficulty.MEDIUM,
    choices: [
      { id: 'a', label: 'Réponse A' },
      { id: 'b', label: 'Réponse B' },
    ],
    selectionMode: QuestionSelectionMode.SINGLE,
    minSelections: null,
    maxSelections: null,
    correctChoiceId: 'a',
    correctChoiceIds: null,
    explanation: 'Explication.',
    fingerprint: `fingerprint-${id}`,
    status: QuestionBankItemStatus.ACTIVE,
    askedCount: 0,
    lastAskedAt: null,
    flaggedAt: null,
    flagReason: null,
    archivedAt: null,
    createdAt: new Date('2026-06-20T09:00:00Z'),
    updatedAt: new Date('2026-06-20T09:00:00Z'),
    sources: [
      {
        id: `source-${id}`,
        questionBankItemId: id,
        subjectId: 'subject-1',
        chunkId: 'chunk-1',
      },
    ],
    visuals: [],
    ...overrides,
  };
}

function getFirstMockInput<T>(calls: Array<[unknown]>): T {
  const firstCall = calls[0];

  if (!firstCall) {
    throw new Error('Expected mock to be called');
  }

  return firstCall[0] as T;
}

type QuestionBankMocks = ReturnType<typeof createHarness>['mocks'];

interface QuestionBankItemFindManyInput {
  where: {
    courseId: string;
    knowledgeUnitId: string | { in: string[] };
    status: QuestionBankItemStatus;
  };
  orderBy: Array<Record<string, 'asc' | 'desc'>>;
}

interface QuestionBankItemUpdateManyInput {
  where: {
    id: string;
    studentId: string;
    askedCount: number;
    lastAskedAt: Date | null;
  };
  data: {
    askedCount: {
      increment: number;
    };
    lastAskedAt: Date;
  };
}

interface CreateDiagnosticQuizInput {
  quiz: GeneratedDiagnosticQuiz;
}

interface QuestionBankTransaction {
  questionBankItem: {
    create: QuestionBankMocks['questionBankItemCreate'];
    findMany: QuestionBankMocks['questionBankItemFindMany'];
    updateMany: QuestionBankMocks['questionBankItemUpdateMany'];
  };
  questionBankItemSource: {
    createMany: QuestionBankMocks['questionBankItemSourceCreateMany'];
  };
  questionBankItemVisual: {
    createMany: QuestionBankMocks['questionBankItemVisualCreateMany'];
  };
}

interface QuestionBankItemIdOnly {
  id: string;
}

interface QuestionBankItemUpdateManyResult {
  count: number;
}

interface QuestionBankItemSourceRow {
  id: string;
  questionBankItemId: string;
  subjectId: string;
  chunkId: string;
}

interface QuestionBankItemVisualRow {
  id: string;
  questionBankItemId: string;
  type: string;
  displayOrder: number;
  payload: unknown;
  createdAt: Date;
}

interface QuestionBankItemRow {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string;
  documentId: string;
  knowledgeUnitId: string;
  prompt: string;
  difficulty: KnowledgeUnitDifficulty;
  choices: unknown;
  selectionMode: QuestionSelectionMode;
  minSelections: number | null;
  maxSelections: number | null;
  correctChoiceId: string | null;
  correctChoiceIds: unknown;
  explanation: string;
  fingerprint: string;
  status: QuestionBankItemStatus;
  askedCount: number;
  lastAskedAt: Date | null;
  flaggedAt: Date | null;
  flagReason: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sources: QuestionBankItemSourceRow[];
  visuals: QuestionBankItemVisualRow[];
}
