import { PrismaActivitiesRepository } from './prisma-activities.repository';

type ActivitySessionRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  version: number;
  documentId: string | null;
  generationFlowName: string | null;
  generationProvider: string | null;
  generationModel: string | null;
  generationPromptVersion: string | null;
  generationSchemaVersion: string | null;
  generationInputSize: number | null;
  status: 'STARTED' | 'COMPLETED';
  completedAt: Date | null;
};

type QuestionRecord = {
  id: string;
  sessionId: string;
  subjectId: string | null;
  documentId: string | null;
  knowledgeUnitId: string;
  prompt: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  displayOrder: number;
  choices: Array<{ id: string; label: string; feedback?: string | null }>;
  correctChoiceId: string;
  explanation: string;
  sources?: QuestionSourceRecord[];
};

type ActivityResultRecord = {
  id: string;
  sessionId: string;
  correctAnswers: number;
  totalQuestions: number;
  score: number | null;
  createdAt: Date;
};

type DocumentChunkRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  pageNumber: number | null;
  text: string;
};

type QuestionSourceRecord = {
  questionId: string;
  subjectId: string;
  chunkId: string;
  chunk: DocumentChunkRecord;
};

type QuestionCreatePayload = {
  data: {
    sessionId: string;
    knowledgeUnitId: string;
    prompt: string;
    choices: Array<{ id: string; label: string }>;
    correctChoiceId: string;
    explanation: string;
  };
};

type ActivitySessionUpdatePayload = {
  where: {
    id: string;
  };
  data: {
    status: 'COMPLETED';
    completedAt: Date;
  };
};

type SessionWithQuestions = ActivitySessionRecord & {
  questions: QuestionRecord[];
  result: ActivityResultRecord | null;
};

type PrismaActivitiesMock = {
  knowledgeUnit: {
    findFirst: jest.Mock;
  };
  documentChunk: {
    findMany: jest.Mock;
  };
  activitySession: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  question: {
    create: jest.Mock;
  };
  questionSource: {
    createMany: jest.Mock;
  };
  questionAnswer: {
    createMany: jest.Mock;
  };
  activityResult: {
    create: jest.Mock;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

type TransactionCallback = (tx: PrismaActivitiesMock) => unknown;

describe('PrismaActivitiesRepository', () => {
  const createdAt = new Date('2026-06-12T10:00:00.000Z');

  const createRepository = () => {
    const prisma: PrismaActivitiesMock = {
      knowledgeUnit: {
        findFirst: jest.fn(),
      },
      documentChunk: {
        findMany: jest.fn(),
      },
      activitySession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      question: {
        create: jest.fn(),
      },
      questionSource: {
        createMany: jest.fn(),
      },
      questionAnswer: {
        createMany: jest.fn(),
      },
      activityResult: {
        create: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
    };
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prisma)),
    );

    return {
      prisma,
      repository: new PrismaActivitiesRepository(prisma as never),
    };
  };

  const sessionRecord = (
    input: Partial<ActivitySessionRecord> = {},
  ): ActivitySessionRecord => ({
    id: 'session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    knowledgeUnitId: 'unit-1',
    version: 1,
    documentId: null,
    generationFlowName: null,
    generationProvider: null,
    generationModel: null,
    generationPromptVersion: null,
    generationSchemaVersion: null,
    generationInputSize: null,
    status: 'STARTED',
    completedAt: null,
    ...input,
  });

  const questionRecord = (
    input: Partial<QuestionRecord> = {},
  ): QuestionRecord => ({
    id: 'question-1',
    sessionId: 'session-1',
    subjectId: 'subject-1',
    documentId: null,
    knowledgeUnitId: 'unit-1',
    prompt:
      'Quelle structure est principalement responsable de la contraction cardiaque ?',
    difficulty: null,
    displayOrder: 0,
    choices: [
      { id: 'a', label: 'Myocarde' },
      { id: 'b', label: 'Pericarde' },
    ],
    correctChoiceId: 'a',
    explanation: 'Le myocarde est le muscle cardiaque.',
    ...input,
  });

  const sessionWithQuestions = (
    input: Partial<SessionWithQuestions> = {},
  ): SessionWithQuestions => ({
    ...sessionRecord(),
    questions: [questionRecord()],
    result: null,
    ...input,
  });

  const resultRecord = (
    input: Partial<ActivityResultRecord> = {},
  ): ActivityResultRecord => ({
    id: 'result-1',
    sessionId: 'session-1',
    correctAnswers: 1,
    totalQuestions: 1,
    score: 1,
    createdAt,
    ...input,
  });

  const chunkRecord = (
    input: Partial<DocumentChunkRecord> = {},
  ): DocumentChunkRecord => ({
    id: 'chunk-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    index: 0,
    pageNumber: null,
    text: 'Article 89 encadre la revision constitutionnelle.',
    ...input,
  });

  const generatedQuizQuestions = (questionCount: number) =>
    Array.from({ length: questionCount }, (_value, index) => ({
      prompt: `Question de revision ${index + 1}`,
      choices: [
        { id: `a-${index + 1}`, label: 'Bonne reponse' },
        { id: `b-${index + 1}`, label: 'Distracteur' },
      ],
      correctChoiceId: `a-${index + 1}`,
      explanation: 'Explication de correction.',
    }));

  it('persists the generated diagnostic quiz after verifying ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      subjectId: 'subject-1',
    });
    prisma.activitySession.create.mockResolvedValue(sessionRecord());
    prisma.question.create.mockResolvedValue(
      questionRecord({
        prompt:
          'Quel principe limite le pouvoir constituant derive dans la Constitution de 1958 ?',
        choices: [
          { id: 'a', label: 'La forme republicaine du gouvernement' },
          { id: 'b', label: 'La superiorite du pouvoir reglementaire' },
        ],
        correctChoiceId: 'a',
        explanation:
          'La Constitution interdit de reviser la forme republicaine du gouvernement.',
      }),
    );

    const activity = await repository.createDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      quiz: {
        title: 'Diagnostic constitutionnel',
        questions: [
          {
            prompt:
              'Quel principe limite le pouvoir constituant derive dans la Constitution de 1958 ?',
            choices: [
              { id: 'a', label: 'La forme republicaine du gouvernement' },
              { id: 'b', label: 'La superiorite du pouvoir reglementaire' },
            ],
            correctChoiceId: 'a',
            explanation:
              'La Constitution interdit de reviser la forme republicaine du gouvernement.',
          },
        ],
      },
    });

    expect(prisma.knowledgeUnit.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unit-1',
        subjectId: 'subject-1',
        subject: {
          studentId: 'student-1',
        },
      },
    });
    expect(prisma.activitySession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        type: 'DIAGNOSTIC_QUIZ',
        status: 'STARTED',
      },
    });
    const [questionCreatePayload] = prisma.question.create.mock.calls[0] as
      | [QuestionCreatePayload]
      | [];
    expect(questionCreatePayload?.data).toMatchObject({
      sessionId: 'session-1',
      knowledgeUnitId: 'unit-1',
      prompt:
        'Quel principe limite le pouvoir constituant derive dans la Constitution de 1958 ?',
      choices: [
        { id: 'a', label: 'La forme republicaine du gouvernement' },
        { id: 'b', label: 'La superiorite du pouvoir reglementaire' },
      ],
      correctChoiceId: 'a',
      explanation:
        'La Constitution interdit de reviser la forme republicaine du gouvernement.',
    });
    expect(activity).toMatchObject({
      sessionId: 'session-1',
      type: 'diagnostic_quiz',
      title: 'Diagnostic constitutionnel',
      questions: [{ id: 'question-1' }],
    });
  });

  it('persists a generated diagnostic quiz with ten questions', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      subjectId: 'subject-1',
    });
    prisma.activitySession.create.mockResolvedValue(sessionRecord());
    prisma.question.create.mockImplementation(
      ({ data }: QuestionCreatePayload) =>
        questionRecord({
          id: `question-${prisma.question.create.mock.calls.length}`,
          prompt: data.prompt,
          choices: data.choices,
          correctChoiceId: data.correctChoiceId,
          explanation: data.explanation,
        }),
    );

    const activity = await repository.createDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      quiz: {
        title: 'Diagnostic constitutionnel',
        questions: generatedQuizQuestions(10),
      },
    });

    expect(prisma.question.create).toHaveBeenCalledTimes(10);
    expect(activity.questions).toHaveLength(10);
    expect(activity.questions[9]?.id).toBe('question-10');
  });

  it('persists a sourced v2 diagnostic quiz without leaking correction fields before submit', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([chunkRecord()]);
    prisma.activitySession.create.mockResolvedValue(
      sessionRecord({
        version: 2,
        documentId: 'document-1',
        generationFlowName: 'diagnosticQuizGeneration',
        generationProvider: 'google-genai',
        generationModel: 'googleai/custom-model',
        generationPromptVersion: 'diagnostic-quiz-v2',
        generationSchemaVersion: 'diagnostic-quiz-v2',
        generationInputSize: 1200,
      }),
    );
    prisma.question.create.mockResolvedValue(
      questionRecord({
        documentId: 'document-1',
        difficulty: 'MEDIUM',
        choices: [
          {
            id: 'a',
            label: 'La forme republicaine du gouvernement',
            feedback: 'Correct.',
          },
          {
            id: 'b',
            label: 'La suppression du Parlement',
            feedback: 'Incorrect.',
          },
        ],
        sources: [
          {
            questionId: 'question-1',
            subjectId: 'subject-1',
            chunkId: 'chunk-1',
            chunk: chunkRecord(),
          },
        ],
      }),
    );

    const activity = await repository.createDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: 'document-1',
      quiz: {
        title: 'Diagnostic constitutionnel',
        version: 2,
        metadata: {
          flowName: 'diagnosticQuizGeneration',
          provider: 'google-genai',
          model: 'googleai/custom-model',
          promptVersion: 'diagnostic-quiz-v2',
          schemaVersion: 'diagnostic-quiz-v2',
          inputSize: 1200,
        },
        questions: [
          {
            prompt:
              'Quelle limite materielle encadre la revision constitutionnelle ?',
            difficulty: 'MEDIUM',
            choices: [
              {
                id: 'a',
                label: 'La forme republicaine du gouvernement',
                feedback: 'Correct.',
              },
              {
                id: 'b',
                label: 'La suppression du Parlement',
                feedback: 'Incorrect.',
              },
            ],
            correctChoiceId: 'a',
            explanation: 'La Constitution protege cette limite materielle.',
            sourceChunkIds: ['chunk-1'],
          },
        ],
      },
    });

    expect(prisma.activitySession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        type: 'DIAGNOSTIC_QUIZ',
        status: 'STARTED',
        version: 2,
        documentId: 'document-1',
        generationFlowName: 'diagnosticQuizGeneration',
        generationProvider: 'google-genai',
        generationModel: 'googleai/custom-model',
        generationPromptVersion: 'diagnostic-quiz-v2',
        generationSchemaVersion: 'diagnostic-quiz-v2',
        generationInputSize: 1200,
      },
    });
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-1'] },
        subjectId: 'subject-1',
        documentId: 'document-1',
      },
      select: {
        id: true,
        documentId: true,
        subjectId: true,
        index: true,
        pageNumber: true,
        text: true,
      },
    });
    expect(prisma.question.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        knowledgeUnitId: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        prompt:
          'Quelle limite materielle encadre la revision constitutionnelle ?',
        difficulty: 'MEDIUM',
        displayOrder: 0,
        choices: [
          {
            id: 'a',
            label: 'La forme republicaine du gouvernement',
            feedback: 'Correct.',
          },
          {
            id: 'b',
            label: 'La suppression du Parlement',
            feedback: 'Incorrect.',
          },
        ],
        correctChoiceId: 'a',
        explanation: 'La Constitution protege cette limite materielle.',
      },
    });
    expect(prisma.questionSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          questionId: 'question-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
        },
      ],
    });
    expect(activity).toEqual({
      sessionId: 'session-1',
      type: 'diagnostic_quiz',
      title: 'Diagnostic constitutionnel',
      version: 2,
      documentId: 'document-1',
      subjectId: 'subject-1',
      questions: [
        {
          id: 'question-1',
          knowledgeUnitId: 'unit-1',
          prompt:
            'Quelle structure est principalement responsable de la contraction cardiaque ?',
          difficulty: 'MEDIUM',
          choices: [
            { id: 'a', label: 'La forme republicaine du gouvernement' },
            { id: 'b', label: 'La suppression du Parlement' },
          ],
          sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
        },
      ],
    });
    const publicPayload = JSON.stringify(activity);
    expect(publicPayload).not.toContain('correctChoiceId');
    expect(publicPayload).not.toContain('explanation');
    expect(publicPayload).not.toContain('feedback');
    expect(publicPayload).not.toContain('isCorrect');
    expect(publicPayload).not.toContain('Article 89');
  });

  it('rejects sourced v2 quiz creation when a source chunk is unknown or cross-document', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([]);

    await expect(
      repository.createDiagnosticQuiz({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        documentId: 'document-1',
        quiz: {
          title: 'Diagnostic constitutionnel',
          version: 2,
          questions: [
            {
              prompt:
                'Quelle limite materielle encadre la revision constitutionnelle ?',
              choices: [
                { id: 'a', label: 'La forme republicaine du gouvernement' },
                { id: 'b', label: 'La suppression du Parlement' },
              ],
              correctChoiceId: 'a',
              explanation: 'La Constitution protege cette limite materielle.',
              sourceChunkIds: ['missing-chunk'],
            },
          ],
        },
      }),
    ).rejects.toThrow('Question source chunk not found');

    expect(prisma.activitySession.create).not.toHaveBeenCalled();
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it('rejects quiz creation when the knowledge unit is outside the student subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue(null);

    await expect(
      repository.createDiagnosticQuiz({
        studentId: 'student-1',
        subjectId: 'subject-2',
        knowledgeUnitId: 'unit-1',
        quiz: {
          title: 'Diagnostic constitutionnel',
          questions: [
            {
              prompt:
                'Quelle est la norme supreme dans la hierarchie interne ?',
              choices: [
                { id: 'a', label: 'La Constitution' },
                { id: 'b', label: 'Le reglement' },
              ],
              correctChoiceId: 'a',
              explanation:
                'La Constitution se situe au sommet de la hierarchie interne.',
            },
          ],
        },
      }),
    ).rejects.toThrow('Knowledge unit does not belong to student subject');

    expect(prisma.activitySession.create).not.toHaveBeenCalled();
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it('persists a bounded score and completes the activity session', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(sessionWithQuestions());
    prisma.activityResult.create.mockResolvedValue(resultRecord());

    const result = await repository.submitResult({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [{ questionId: 'question-1', choiceId: 'a' }],
    });

    expect(prisma.activitySession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        studentId: 'student-1',
      },
      include: {
        questions: {
          include: {
            sources: {
              include: {
                chunk: true,
              },
            },
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
        result: true,
      },
    });
    expect(prisma.activityResult.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        correctAnswers: 1,
        totalQuestions: 1,
        score: 1,
      },
    });
    const [activitySessionUpdatePayload] = prisma.activitySession.update.mock
      .calls[0] as [ActivitySessionUpdatePayload] | [];
    expect(activitySessionUpdatePayload).toEqual({
      where: { id: 'session-1' },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date) as Date,
      },
    });
    expect(result).toEqual({
      correctAnswers: 1,
      totalQuestions: 1,
      score: 1,
      knowledgeUnitId: 'unit-1',
      items: [
        {
          questionId: 'question-1',
          knowledgeUnitId: 'unit-1',
          prompt:
            'Quelle structure est principalement responsable de la contraction cardiaque ?',
          selectedChoiceId: 'a',
          correctChoiceId: 'a',
          isCorrect: true,
          explanation: 'Le myocarde est le muscle cardiaque.',
          choiceFeedback: [],
          sources: [],
        },
      ],
    });
  });

  it('persists v2 answers and returns detailed correction with source text after submit', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(
      sessionWithQuestions({
        version: 2,
        documentId: 'document-1',
        questions: [
          questionRecord({
            documentId: 'document-1',
            difficulty: 'MEDIUM',
            choices: [
              {
                id: 'a',
                label: 'La forme republicaine du gouvernement',
                feedback: 'Ce choix est correct.',
              },
              {
                id: 'b',
                label: 'La suppression du Parlement',
                feedback: 'Ce choix est incorrect.',
              },
            ],
            correctChoiceId: 'a',
            explanation:
              'La revision ne peut pas porter atteinte a la forme republicaine.',
            sources: [
              {
                questionId: 'question-1',
                subjectId: 'subject-1',
                chunkId: 'chunk-1',
                chunk: chunkRecord(),
              },
            ],
          }),
        ],
      }),
    );
    prisma.activityResult.create.mockResolvedValue(
      resultRecord({ correctAnswers: 0, totalQuestions: 1, score: 0 }),
    );

    const result = await repository.submitResult({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [{ questionId: 'question-1', choiceId: 'b' }],
    });

    expect(prisma.questionAnswer.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: 'session-1',
          questionId: 'question-1',
          selectedChoiceId: 'b',
          isCorrect: false,
        },
      ],
    });
    expect(prisma.activityResult.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        correctAnswers: 0,
        totalQuestions: 1,
        score: 0,
      },
    });
    expect(result).toEqual({
      correctAnswers: 0,
      totalQuestions: 1,
      score: 0,
      knowledgeUnitId: 'unit-1',
      items: [
        {
          questionId: 'question-1',
          knowledgeUnitId: 'unit-1',
          prompt:
            'Quelle structure est principalement responsable de la contraction cardiaque ?',
          selectedChoiceId: 'b',
          correctChoiceId: 'a',
          isCorrect: false,
          explanation:
            'La revision ne peut pas porter atteinte a la forme republicaine.',
          choiceFeedback: [
            { choiceId: 'a', feedback: 'Ce choix est correct.' },
            { choiceId: 'b', feedback: 'Ce choix est incorrect.' },
          ],
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Article 89 encadre la revision constitutionnelle.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });
  });

  it('rejects missing answers when submitting a quiz', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(
      sessionWithQuestions({
        questions: [
          questionRecord({ id: 'question-1' }),
          questionRecord({ id: 'question-2' }),
        ],
      }),
    );

    await expect(
      repository.submitResult({
        studentId: 'student-1',
        sessionId: 'session-1',
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      }),
    ).rejects.toThrow('Missing answers are not allowed');

    expect(prisma.questionAnswer.createMany).not.toHaveBeenCalled();
    expect(prisma.activityResult.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate answers before writing an impossible score', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(sessionWithQuestions());

    await expect(
      repository.submitResult({
        studentId: 'student-1',
        sessionId: 'session-1',
        answers: [
          { questionId: 'question-1', choiceId: 'a' },
          { questionId: 'question-1', choiceId: 'a' },
        ],
      }),
    ).rejects.toThrow('Duplicate answers are not allowed');

    expect(prisma.activityResult.create).not.toHaveBeenCalled();
    expect(prisma.activitySession.update).not.toHaveBeenCalled();
  });

  it('rejects already completed sessions before creating a duplicate result', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(
      sessionWithQuestions({
        status: 'COMPLETED',
        completedAt: createdAt,
        result: resultRecord(),
      }),
    );

    await expect(
      repository.submitResult({
        studentId: 'student-1',
        sessionId: 'session-1',
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      }),
    ).rejects.toThrow('Activity session already completed');

    expect(prisma.activityResult.create).not.toHaveBeenCalled();
    expect(prisma.activitySession.update).not.toHaveBeenCalled();
  });

  it('rejects missing or cross-student sessions', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(null);

    await expect(
      repository.submitResult({
        studentId: 'student-2',
        sessionId: 'session-1',
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      }),
    ).rejects.toThrow('Activity session not found');

    expect(prisma.activityResult.create).not.toHaveBeenCalled();
  });

  it('rejects unknown question ids and choice ids', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(sessionWithQuestions());

    await expect(
      repository.submitResult({
        studentId: 'student-1',
        sessionId: 'session-1',
        answers: [{ questionId: 'question-2', choiceId: 'a' }],
      }),
    ).rejects.toThrow('Question does not belong to activity session');

    await expect(
      repository.submitResult({
        studentId: 'student-1',
        sessionId: 'session-1',
        answers: [{ questionId: 'question-1', choiceId: 'c' }],
      }),
    ).rejects.toThrow('Choice does not belong to question');

    expect(prisma.activityResult.create).not.toHaveBeenCalled();
  });
});
