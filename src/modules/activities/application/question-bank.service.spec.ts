import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ActivitiesRepository,
  DiagnosticQuizActivity,
  DiagnosticQuizGenerationContext,
} from './activities.repository';
import type {
  DiagnosticQuizGenerator,
  GeneratedDiagnosticQuiz,
} from './diagnostic-quiz-generator';
import type {
  QuestionBankRepository,
  QuestionBankReservedQuestionDto,
} from './question-bank.repository';
import {
  QUICK_QUESTION_BANK_COUNT_INVALID,
  QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS,
  QuestionBankService,
} from './question-bank.service';

describe('QuestionBankService', () => {
  it('uses the question bank repository port instead of Prisma directly', () => {
    const source = readFileSync(join(__dirname, 'question-bank.service.ts'), {
      encoding: 'utf8',
    });

    expect(source).not.toContain('PrismaService');
    expect(source).not.toContain('this.prisma');
    expect(source).toContain('QUESTION_BANK_REPOSITORY');
  });

  it('prepares missing questions in batches of two without creating a session snapshot', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    questionBankRepository.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(6);
    generator.generate
      .mockResolvedValueOnce(generatedQuiz('batch-a', 2))
      .mockResolvedValueOnce(generatedQuiz('batch-b', 2))
      .mockResolvedValueOnce(generatedQuiz('batch-c', 2));
    questionBankRepository.persistGeneratedQuestions.mockResolvedValue({
      persistedCount: 2,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    });

    await expect(
      service.prepareCourseQuickQuestionBank({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 6,
      }),
    ).resolves.toEqual({
      activeBefore: 0,
      activeAfter: 6,
      generatedCount: 6,
      persistedCount: 6,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
      aiGenerations: [],
    });

    expect(generator.generate.mock.calls).toHaveLength(3);
    expect(
      generator.generate.mock.calls.map(([input]) => input.questionCount),
    ).toEqual([2, 2, 2]);
    expect(
      questionBankRepository.persistGeneratedQuestions.mock.calls,
    ).toHaveLength(3);
    expect(
      questionBankRepository.reserveCourseQuickQuestions.mock.calls,
    ).toHaveLength(0);
    expect(activitiesRepository.createDiagnosticQuiz.mock.calls).toHaveLength(
      0,
    );
  });

  it('persists a generated question when the pool is one question below target', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    questionBankRepository.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10);
    generator.generate.mockResolvedValueOnce(generatedQuiz('missing', 1));
    questionBankRepository.persistGeneratedQuestions.mockResolvedValueOnce({
      persistedCount: 1,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    });

    await expect(
      service.prepareCourseQuickQuestionBank({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      activeBefore: 9,
      activeAfter: 10,
      generatedCount: 1,
      persistedCount: 1,
    });
  });

  it('accepts internal preparation targets below the session minimum', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    questionBankRepository.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4);
    generator.generate
      .mockResolvedValueOnce(generatedQuiz('internal-target-a', 2))
      .mockResolvedValueOnce(generatedQuiz('internal-target-b', 2));
    questionBankRepository.persistGeneratedQuestions.mockResolvedValue({
      persistedCount: 2,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    });

    await expect(
      service.prepareCourseQuickQuestionBank({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 4,
      }),
    ).resolves.toMatchObject({
      activeBefore: 0,
      activeAfter: 4,
      generatedCount: 4,
      persistedCount: 4,
    });

    expect(
      generator.generate.mock.calls.map(([input]) => input.questionCount),
    ).toEqual([2, 2]);
  });

  it('reports duplicate generations when no new question can be persisted', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    questionBankRepository.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9);
    generator.generate.mockResolvedValueOnce(generatedQuiz('duplicate', 1));
    questionBankRepository.persistGeneratedQuestions.mockResolvedValueOnce({
      persistedCount: 0,
      duplicateSkippedCount: 1,
      structureSkippedCount: 0,
    });

    await expect(
      service.prepareCourseQuickQuestionBank({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      activeBefore: 9,
      activeAfter: 9,
      generatedCount: 1,
      persistedCount: 0,
      duplicateSkippedCount: 1,
    });
  });

  it('reports structure-only generations when no new question can be persisted', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    questionBankRepository.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(9);
    generator.generate.mockResolvedValueOnce(generatedQuiz('structure', 1));
    questionBankRepository.persistGeneratedQuestions.mockResolvedValueOnce({
      persistedCount: 0,
      duplicateSkippedCount: 0,
      structureSkippedCount: 1,
    });

    await expect(
      service.prepareCourseQuickQuestionBank({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      activeBefore: 9,
      activeAfter: 9,
      generatedCount: 1,
      persistedCount: 0,
      structureSkippedCount: 1,
    });
  });

  it('records AI fallback metrics from generated quiz metadata', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    activitiesRepository.findDiagnosticQuizGenerationContext.mockResolvedValue(
      generationContext(),
    );
    questionBankRepository.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5);
    generator.generate.mockResolvedValueOnce(
      generatedQuiz('fallback', 1, {
        provider: 'mistral',
        model: 'mistral-large-latest',
        fallbackUsed: true,
      }),
    );
    questionBankRepository.persistGeneratedQuestions.mockResolvedValueOnce({
      persistedCount: 1,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    });

    await expect(
      service.prepareCourseQuickQuestionBank({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        questionCount: 5,
      }),
    ).resolves.toMatchObject({
      aiGenerations: [
        {
          provider: 'mistral',
          model: 'mistral-large-latest',
          fallbackUsed: true,
          generatedCount: 1,
          persistedCount: 1,
        },
      ],
    });
  });

  it('snapshots a quick session quiz from multiple knowledge units with balanced questions', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    questionBankRepository.reserveCourseQuickQuestions.mockResolvedValue([
      reservedQuestion({ id: 'ku-1-bank-1', knowledgeUnitId: 'ku-1' }),
      reservedQuestion({ id: 'ku-2-bank-1', knowledgeUnitId: 'ku-2' }),
      reservedQuestion({ id: 'ku-3-bank-1', knowledgeUnitId: 'ku-3' }),
      reservedQuestion({ id: 'ku-1-bank-2', knowledgeUnitId: 'ku-1' }),
      reservedQuestion({ id: 'ku-2-bank-2', knowledgeUnitId: 'ku-2' }),
      reservedQuestion({ id: 'ku-3-bank-2', knowledgeUnitId: 'ku-3' }),
    ]);
    activitiesRepository.createDiagnosticQuiz.mockResolvedValue(activity());

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
    expect(
      questionBankRepository.reserveCourseQuickQuestions,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      knowledgeUnits: [
        { id: 'ku-1', documentId: 'document-1' },
        { id: 'ku-2', documentId: 'document-1' },
        { id: 'ku-3', documentId: 'document-2' },
      ],
      questionCount: 6,
      maxAttempts: 3,
    });

    const createDiagnosticQuizCall =
      activitiesRepository.createDiagnosticQuiz.mock.calls[0]?.[0];
    expect(
      createDiagnosticQuizCall?.quiz.questions.map(
        (question) => question.knowledgeUnitId,
      ),
    ).toEqual(['ku-1', 'ku-2', 'ku-3', 'ku-1', 'ku-2', 'ku-3']);
  });

  it('throws when the repository cannot reserve enough prepared questions', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();
    questionBankRepository.reserveCourseQuickQuestions.mockResolvedValue(
      reservedQuestions(4),
    );

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
    expect(activitiesRepository.createDiagnosticQuiz.mock.calls).toHaveLength(
      0,
    );
  });

  it('rejects invalid question counts before touching storage or providers', async () => {
    const { activitiesRepository, generator, questionBankRepository, service } =
      createHarness();

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
    expect(
      questionBankRepository.countActiveCourseQuickQuestions.mock.calls,
    ).toHaveLength(0);
  });

  it('counts active quick questions by knowledge unit through the repository port', async () => {
    const { questionBankRepository, service } = createHarness();
    const counts = new Map([
      ['ku-1', 3],
      ['ku-2', 0],
    ]);
    questionBankRepository.countActiveCourseQuickQuestionsByKnowledgeUnit.mockResolvedValue(
      counts,
    );

    await expect(
      service.countActiveCourseQuickQuestionsByKnowledgeUnit({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        knowledgeUnitIds: ['ku-1', 'ku-2'],
      }),
    ).resolves.toBe(counts);

    expect(
      questionBankRepository.countActiveCourseQuickQuestionsByKnowledgeUnit,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      knowledgeUnitIds: ['ku-1', 'ku-2'],
    });
  });
});

function createHarness() {
  const questionBankRepository = {
    countActiveCourseQuickQuestions: jest.fn(),
    countActiveCourseQuickQuestionsByKnowledgeUnit: jest.fn(),
    persistGeneratedQuestions: jest.fn(),
    reserveCourseQuickQuestions: jest.fn(),
  } satisfies {
    [K in keyof QuestionBankRepository]: jest.Mock;
  };
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
    questionBankRepository,
    service: new QuestionBankService(
      questionBankRepository,
      activitiesRepository,
      generator,
    ),
  };
}

function generationContext(): DiagnosticQuizGenerationContext {
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
  };
}

function generatedQuiz(
  prefix: string,
  count: number,
  metadata?: GeneratedDiagnosticQuiz['metadata'],
): GeneratedDiagnosticQuiz {
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
    metadata,
  };
}

function reservedQuestions(count: number): QuestionBankReservedQuestionDto[] {
  return Array.from({ length: count }, (_, index) =>
    reservedQuestion({ id: `bank-${index + 1}` }),
  );
}

function reservedQuestion(
  overrides: Partial<QuestionBankReservedQuestionDto> = {},
): QuestionBankReservedQuestionDto {
  const id = overrides.id ?? 'bank-1';

  return {
    id,
    documentId: 'document-1',
    knowledgeUnitId: 'ku-1',
    prompt: `Question ${id}`,
    difficulty: 'MEDIUM',
    choices: [
      { id: 'a', label: 'Réponse A' },
      { id: 'b', label: 'Réponse B' },
    ],
    selectionMode: 'single',
    minSelections: null,
    maxSelections: null,
    correctChoiceId: 'a',
    correctChoiceIds: [],
    explanation: 'Explication.',
    sourceChunkIds: ['chunk-1'],
    visuals: [],
    ...overrides,
  };
}

function activity(): DiagnosticQuizActivity {
  return {
    sessionId: 'activity-1',
    type: 'diagnostic_quiz',
    title: 'Révision rapide',
    questions: [],
  };
}
