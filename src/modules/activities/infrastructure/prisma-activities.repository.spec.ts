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
  status: 'STARTED' | 'SUBMITTED' | 'COMPLETED';
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
  selectionMode?: 'SINGLE' | 'MULTIPLE';
  minSelections?: number | null;
  maxSelections?: number | null;
  correctChoiceId: string | null;
  correctChoiceIds?: string[] | null;
  explanation: string;
  sources?: QuestionSourceRecord[];
  visuals?: QuestionVisualRecord[];
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

type QuestionVisualRecord = {
  id: string;
  questionId: string;
  type: 'IMAGE' | 'CHART' | 'DIAGRAM';
  displayOrder: number;
  payload: Record<string, unknown>;
  sources?: QuestionVisualSourceRecord[];
};

type QuestionVisualSourceRecord = {
  visualId: string;
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
    selectionMode?: 'SINGLE' | 'MULTIPLE';
    minSelections?: number | null;
    maxSelections?: number | null;
    correctChoiceId?: string | null;
    correctChoiceIds?: string[] | null;
    explanation: string;
  };
};

type ActivitySessionCreatePayload = {
  data: Record<string, unknown>;
};

type QuestionVisualCreatePayload = {
  data: {
    questionId: string;
    type: 'IMAGE' | 'CHART' | 'DIAGRAM';
    displayOrder: number;
    payload: Record<string, unknown>;
  };
};

type ActivitySessionUpdatePayload = {
  where: {
    id: string;
  };
  data: {
    status: 'SUBMITTED' | 'COMPLETED';
    completedAt?: Date;
  };
};

type OpenQuestionRecord = {
  id: string;
  sessionId: string;
  studentId: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  prompt: string;
  instructions: string | null;
  maxAnswerLength: number;
  version: number;
  sources?: OpenQuestionSourceRecord[];
};

type OpenQuestionSourceRecord = {
  questionId: string;
  subjectId: string;
  chunkId: string;
  chunk: DocumentChunkRecord;
};

type OpenAnswerEvaluationRecord = {
  id: string;
  sessionId: string;
  openQuestionId: string;
  studentId: string;
  subjectId: string;
  answerText: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  presentPoints: unknown;
  missingPoints: unknown;
  errors: unknown;
  modelAnswer: string | null;
  advice: string | null;
};

type OpenQuestionCreatePayload = {
  data: {
    sessionId: string;
    studentId: string;
    subjectId: string;
    documentId?: string | null;
    knowledgeUnitId: string;
    prompt: string;
    instructions?: string | null;
    maxAnswerLength: number;
    version: number;
  };
};

type OpenAnswerEvaluationCreatePayload = {
  data: {
    sessionId: string;
    openQuestionId: string;
    studentId: string;
    subjectId: string;
    answerText: string;
    status: 'READY' | 'FAILED';
    score: number | null;
    maxScore: number | null;
    feedback: string | null;
    presentPoints: unknown[];
    missingPoints: unknown[];
    errors: unknown[];
    modelAnswer: string | null;
    advice: string | null;
    generationFlowName?: string;
    generationProvider?: string;
    generationModel?: string;
    generationPromptVersion?: string;
    generationSchemaVersion?: string;
    generationInputSize?: number;
    errorCode?: string;
  };
};

type OpenQuestionSessionRecord = ActivitySessionRecord & {
  openQuestion: OpenQuestionRecord | null;
  openAnswerEvaluation: OpenAnswerEvaluationRecord | null;
  knowledgeUnit?: KnowledgeUnitRecord;
};

type KnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  sources?: Array<{
    chunk: DocumentChunkRecord;
  }>;
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
    create: jest.Mock<ActivitySessionRecord, [ActivitySessionCreatePayload]>;
    findFirst: jest.Mock;
    update: jest.Mock<ActivitySessionRecord, [ActivitySessionUpdatePayload]>;
  };
  question: {
    create: jest.Mock<QuestionRecord, [QuestionCreatePayload]>;
  };
  questionSource: {
    createMany: jest.Mock;
  };
  questionVisual: {
    create: jest.Mock<QuestionVisualRecord, [QuestionVisualCreatePayload]>;
  };
  questionVisualSource: {
    createMany: jest.Mock;
  };
  openQuestion: {
    create: jest.Mock<OpenQuestionRecord, [OpenQuestionCreatePayload]>;
  };
  openQuestionSource: {
    createMany: jest.Mock;
  };
  openAnswerEvaluation: {
    create: jest.Mock<
      OpenAnswerEvaluationRecord,
      [OpenAnswerEvaluationCreatePayload]
    >;
  };
  questionAnswer: {
    create: jest.Mock;
    createMany: jest.Mock;
  };
  questionAnswerChoice: {
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
        create: jest.fn<
          ActivitySessionRecord,
          [ActivitySessionCreatePayload]
        >(),
        findFirst: jest.fn(),
        update: jest.fn<
          ActivitySessionRecord,
          [ActivitySessionUpdatePayload]
        >(),
      },
      question: {
        create: jest.fn<QuestionRecord, [QuestionCreatePayload]>(),
      },
      questionSource: {
        createMany: jest.fn(),
      },
      questionVisual: {
        create: jest.fn<QuestionVisualRecord, [QuestionVisualCreatePayload]>(),
      },
      questionVisualSource: {
        createMany: jest.fn(),
      },
      openQuestion: {
        create: jest.fn<OpenQuestionRecord, [OpenQuestionCreatePayload]>(),
      },
      openQuestionSource: {
        createMany: jest.fn(),
      },
      openAnswerEvaluation: {
        create: jest.fn<
          OpenAnswerEvaluationRecord,
          [OpenAnswerEvaluationCreatePayload]
        >(),
      },
      questionAnswer: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      questionAnswerChoice: {
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

  const knowledgeUnitRecord = (
    input: Partial<KnowledgeUnitRecord> = {},
  ): KnowledgeUnitRecord => ({
    id: 'unit-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    title: 'Séparation des pouvoirs',
    summary: 'Résumé.',
    difficulty: null,
    sources: [{ chunk: chunkRecord() }],
    ...input,
  });

  const openQuestionRecord = (
    input: Partial<OpenQuestionRecord> = {},
  ): OpenQuestionRecord => ({
    id: 'open-question-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    prompt:
      'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
    instructions:
      'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
    maxAnswerLength: 4000,
    version: 1,
    sources: [
      {
        questionId: 'open-question-1',
        subjectId: 'subject-1',
        chunkId: 'chunk-1',
        chunk: chunkRecord(),
      },
    ],
    ...input,
  });

  const openAnswerEvaluationRecord = (
    input: Partial<OpenAnswerEvaluationRecord> = {},
  ): OpenAnswerEvaluationRecord => ({
    id: 'evaluation-1',
    sessionId: 'session-1',
    openQuestionId: 'open-question-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    answerText:
      'La séparation des pouvoirs évite la concentration des fonctions étatiques.',
    status: 'PENDING',
    score: null,
    maxScore: null,
    feedback: null,
    presentPoints: [],
    missingPoints: [],
    errors: [],
    modelAnswer: null,
    advice: null,
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

  it('persists a v3 quiz with multiple answers and visual sources without leaking correction fields before submit', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([chunkRecord()]);
    prisma.activitySession.create.mockResolvedValue(
      sessionRecord({ version: 3, documentId: 'document-1' }),
    );
    prisma.question.create.mockResolvedValue(
      questionRecord({
        id: 'question-1',
        documentId: 'document-1',
        selectionMode: 'MULTIPLE',
        minSelections: 1,
        maxSelections: 2,
        correctChoiceId: null,
        correctChoiceIds: ['a', 'c'],
        visuals: [
          {
            id: 'visual-1',
            questionId: 'question-1',
            type: 'CHART',
            displayOrder: 0,
            payload: {
              chartType: 'bar',
              title: 'Elements de controle',
              data: [{ category: 'Controle', value: 2 }],
              xKey: 'category',
              yKeys: ['value'],
            },
            sources: [
              {
                visualId: 'visual-1',
                subjectId: 'subject-1',
                chunkId: 'chunk-1',
                chunk: chunkRecord(),
              },
            ],
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
    prisma.questionVisual.create.mockResolvedValue({
      id: 'visual-1',
      questionId: 'question-1',
      type: 'CHART',
      displayOrder: 0,
      payload: {
        chartType: 'bar',
        title: 'Elements de controle',
        data: [{ category: 'Controle', value: 2 }],
        xKey: 'category',
        yKeys: ['value'],
      },
    });

    const activity = await repository.createDiagnosticQuiz({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: 'document-1',
      quiz: {
        title: 'Diagnostic enrichi',
        version: 3,
        questions: [
          {
            prompt: 'Quels elements controlent le pouvoir ?',
            selectionMode: 'multiple',
            minSelections: 1,
            maxSelections: 2,
            choices: [
              { id: 'a', label: 'Controle juridictionnel', feedback: 'Oui.' },
              { id: 'b', label: 'Pouvoir absolu', feedback: 'Non.' },
              { id: 'c', label: 'Separation des pouvoirs', feedback: 'Oui.' },
            ],
            correctChoiceIds: ['a', 'c'],
            explanation: 'Ces elements limitent le pouvoir.',
            sourceChunkIds: ['chunk-1'],
            visuals: [
              {
                type: 'CHART',
                displayOrder: 0,
                chartType: 'bar',
                title: 'Elements de controle',
                data: [{ category: 'Controle', value: 2 }],
                xKey: 'category',
                yKeys: ['value'],
                sourceChunkIds: ['chunk-1'],
              },
            ],
          },
        ],
      },
    });

    const sessionCreatePayload =
      prisma.activitySession.create.mock.calls[0]?.[0];
    const questionCreatePayload = prisma.question.create.mock.calls[0]?.[0] as
      | QuestionCreatePayload
      | undefined;
    const visualCreatePayload = prisma.questionVisual.create.mock.calls[0]?.[0];

    expect(sessionCreatePayload?.data).toMatchObject({
      version: 3,
      documentId: 'document-1',
    });
    expect(questionCreatePayload?.data).toMatchObject({
      selectionMode: 'MULTIPLE',
      minSelections: 1,
      maxSelections: 2,
      correctChoiceId: null,
      correctChoiceIds: ['a', 'c'],
    });
    expect(visualCreatePayload?.data).toMatchObject({
      questionId: 'question-1',
      type: 'CHART',
      displayOrder: 0,
    });
    expect(prisma.questionVisualSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          visualId: 'visual-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
        },
      ],
    });
    expect(activity.questions[0]).toMatchObject({
      selectionMode: 'multiple',
      minSelections: 1,
      maxSelections: 2,
      visuals: [
        expect.objectContaining({
          id: 'visual-1',
          type: 'CHART',
          sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
        }),
      ],
    });
    const publicPayload = JSON.stringify(activity);
    expect(publicPayload).not.toContain('correctChoiceId');
    expect(publicPayload).not.toContain('correctChoiceIds');
    expect(publicPayload).not.toContain('explanation');
    expect(publicPayload).not.toContain('feedback');
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

  it('submits multiple answers with all-or-nothing scoring and post-submit correction only', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(
      sessionWithQuestions({
        version: 3,
        documentId: 'document-1',
        questions: [
          questionRecord({
            id: 'question-1',
            documentId: 'document-1',
            selectionMode: 'MULTIPLE',
            minSelections: 1,
            maxSelections: 2,
            choices: [
              { id: 'a', label: 'Controle', feedback: 'Oui.' },
              { id: 'b', label: 'Pouvoir absolu', feedback: 'Non.' },
              { id: 'c', label: 'Separation', feedback: 'Oui.' },
            ],
            correctChoiceId: null,
            correctChoiceIds: ['a', 'c'],
            explanation: 'Les deux choix corrects limitent le pouvoir.',
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
    prisma.questionAnswer.create.mockResolvedValue({ id: 'answer-1' });
    prisma.activityResult.create.mockResolvedValue(
      resultRecord({ correctAnswers: 1, totalQuestions: 1, score: 1 }),
    );

    const result = await repository.submitResult({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [{ questionId: 'question-1', choiceIds: ['a', 'c'] }],
    });

    expect(prisma.questionAnswer.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        questionId: 'question-1',
        selectedChoiceId: null,
        isCorrect: true,
      },
    });
    expect(prisma.questionAnswerChoice.createMany).toHaveBeenCalledWith({
      data: [
        { answerId: 'answer-1', choiceId: 'a' },
        { answerId: 'answer-1', choiceId: 'c' },
      ],
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
          selectedChoiceIds: ['a', 'c'],
          correctChoiceIds: ['a', 'c'],
          isCorrect: true,
          partialScore: 1,
          explanation: 'Les deux choix corrects limitent le pouvoir.',
          choiceFeedback: [
            { choiceId: 'a', feedback: 'Oui.' },
            { choiceId: 'b', feedback: 'Non.' },
            { choiceId: 'c', feedback: 'Oui.' },
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

  it('rejects duplicate choice ids for a multiple-answer question', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue(
      sessionWithQuestions({
        version: 3,
        questions: [
          questionRecord({
            selectionMode: 'MULTIPLE',
            minSelections: 1,
            maxSelections: 2,
            correctChoiceId: null,
            correctChoiceIds: ['a', 'b'],
          }),
        ],
      }),
    );

    await expect(
      repository.submitResult({
        studentId: 'student-1',
        sessionId: 'session-1',
        answers: [{ questionId: 'question-1', choiceIds: ['a', 'a'] }],
      }),
    ).rejects.toThrow('Duplicate choices are not allowed');

    expect(prisma.questionAnswer.create).not.toHaveBeenCalled();
    expect(prisma.activityResult.create).not.toHaveBeenCalled();
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

  it('creates an open question activity without leaking source text or correction fields', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([chunkRecord()]);
    prisma.activitySession.create.mockResolvedValue(
      sessionRecord({
        type: 'OPEN_QUESTION' as never,
        version: 1,
        documentId: 'document-1',
      }),
    );
    prisma.openQuestion.create.mockResolvedValue(openQuestionRecord());

    const activity = await repository.createOpenQuestionActivity({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: 'document-1',
      question: {
        prompt:
          'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
        instructions:
          'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
        maxAnswerLength: 4000,
        sourceChunkIds: ['chunk-1'],
        version: 1,
      },
    });

    expect(prisma.activitySession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        documentId: 'document-1',
        type: 'OPEN_QUESTION',
        status: 'STARTED',
        version: 1,
      },
    });
    expect(prisma.openQuestion.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        prompt:
          'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
        instructions:
          'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
        maxAnswerLength: 4000,
        version: 1,
      },
    });
    expect(prisma.openQuestionSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          questionId: 'open-question-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
        },
      ],
    });
    expect(activity).toEqual({
      sessionId: 'session-1',
      type: 'open_question',
      version: 1,
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      question: {
        id: 'open-question-1',
        prompt:
          'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
        instructions:
          'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
        maxAnswerLength: 4000,
        sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
      },
    });
    const publicPayload = JSON.stringify(activity);
    expect(publicPayload).not.toContain('answerText');
    expect(publicPayload).not.toContain('modelAnswer');
    expect(publicPayload).not.toContain('score');
    expect(publicPayload).not.toContain('feedback');
    expect(publicPayload).not.toContain('Article 89');
  });

  it('builds an open answer evaluation context with sourced chunks', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue({
      ...sessionRecord({
        type: 'OPEN_QUESTION' as never,
        status: 'STARTED',
      }),
      knowledgeUnit: knowledgeUnitRecord(),
      openQuestion: openQuestionRecord(),
      openAnswerEvaluation: null,
    } satisfies OpenQuestionSessionRecord);

    const context = await repository.findOpenAnswerEvaluationContext({
      studentId: 'student-1',
      sessionId: 'session-1',
    });

    expect(context.knowledgeUnit).toMatchObject({
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Séparation des pouvoirs',
      summary: 'Résumé.',
      sourceChunkIds: ['chunk-1'],
    });
    expect(context).toEqual({
      sessionId: 'session-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnit: context.knowledgeUnit,
      question: {
        id: 'open-question-1',
        prompt:
          'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
        instructions:
          'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
        sourceChunkIds: ['chunk-1'],
      },
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'Article 89 encadre la revision constitutionnelle.',
          pageNumber: null,
        },
      ],
    });
  });

  it('saves a ready open answer evaluation with sourced feedback', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue({
      ...sessionRecord({
        type: 'OPEN_QUESTION' as never,
        status: 'STARTED',
      }),
      knowledgeUnit: knowledgeUnitRecord(),
      openQuestion: openQuestionRecord(),
      openAnswerEvaluation: null,
    } satisfies OpenQuestionSessionRecord);
    prisma.openAnswerEvaluation.create.mockResolvedValue(
      openAnswerEvaluationRecord({
        status: 'READY',
        score: 16,
        maxScore: 20,
        feedback: 'Réponse solide.',
        presentPoints: ['Point présent'],
        missingPoints: ['Point manquant'],
        errors: [],
        modelAnswer: 'Réponse modèle.',
        advice: 'Conseil.',
      }),
    );

    const result = await repository.saveOpenAnswerEvaluation({
      studentId: 'student-1',
      sessionId: 'session-1',
      answerText:
        'La séparation des pouvoirs évite la concentration des fonctions étatiques.',
      evaluation: {
        status: 'READY',
        score: 16,
        maxScore: 20,
        feedback: 'Réponse solide.',
        presentPoints: ['Point présent'],
        missingPoints: ['Point manquant'],
        errors: [],
        modelAnswer: 'Réponse modèle.',
        advice: 'Conseil.',
        sourceChunkIds: ['chunk-1'],
        metadata: {
          flowName: 'openAnswerEvaluation',
          provider: 'google-genai',
          model: 'googleai/gemini-2.5-flash',
          promptVersion: 'open-answer-evaluation-v1',
          schemaVersion: 'open-answer-evaluation-v1',
          inputSize: 1400,
        },
      },
    });

    expect(prisma.openAnswerEvaluation.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        openQuestionId: 'open-question-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        answerText:
          'La séparation des pouvoirs évite la concentration des fonctions étatiques.',
        status: 'READY',
        score: 16,
        maxScore: 20,
        feedback: 'Réponse solide.',
        presentPoints: ['Point présent'],
        missingPoints: ['Point manquant'],
        errors: [],
        modelAnswer: 'Réponse modèle.',
        advice: 'Conseil.',
        generationFlowName: 'openAnswerEvaluation',
        generationProvider: 'google-genai',
        generationModel: 'googleai/gemini-2.5-flash',
        generationPromptVersion: 'open-answer-evaluation-v1',
        generationSchemaVersion: 'open-answer-evaluation-v1',
        generationInputSize: 1400,
      },
    });
    expect(prisma.activitySession.update).toHaveBeenCalledTimes(1);
    const [sessionUpdateInput] = prisma.activitySession.update.mock.calls[0] as
      | [ActivitySessionUpdatePayload]
      | [];
    expect(sessionUpdateInput).toEqual({
      where: {
        id: 'session-1',
      },
      data: {
        status: 'SUBMITTED',
        completedAt: expect.any(Date) as Date,
      },
    });
    expect(result).toEqual({
      sessionId: 'session-1',
      type: 'open_question',
      status: 'submitted',
      evaluation: {
        id: 'evaluation-1',
        status: 'READY',
        score: 16,
        maxScore: 20,
        feedback: 'Réponse solide.',
        presentPoints: ['Point présent'],
        missingPoints: ['Point manquant'],
        errors: [],
        modelAnswer: 'Réponse modèle.',
        advice: 'Conseil.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Article 89 encadre la revision constitutionnelle.',
            pageNumber: null,
            index: 0,
          },
        ],
      },
    });
  });

  it('rejects double submit and non-open-question sessions for open answers', async () => {
    const { prisma, repository } = createRepository();
    prisma.activitySession.findFirst.mockResolvedValue({
      ...sessionRecord({
        type: 'OPEN_QUESTION' as never,
        status: 'SUBMITTED',
      }),
      knowledgeUnit: knowledgeUnitRecord(),
      openQuestion: openQuestionRecord(),
      openAnswerEvaluation: openAnswerEvaluationRecord(),
    } satisfies OpenQuestionSessionRecord);

    await expect(
      repository.saveOpenAnswerEvaluation({
        studentId: 'student-1',
        sessionId: 'session-1',
        answerText:
          'La séparation des pouvoirs évite la concentration des fonctions étatiques.',
        evaluation: {
          status: 'FAILED',
          errorCode: 'OPEN_ANSWER_EVALUATION_SOURCE_INVALID',
        },
      }),
    ).rejects.toThrow('Activity session already submitted');

    prisma.activitySession.findFirst.mockResolvedValue(sessionWithQuestions());

    await expect(
      repository.saveOpenAnswerEvaluation({
        studentId: 'student-1',
        sessionId: 'session-1',
        answerText:
          'La séparation des pouvoirs évite la concentration des fonctions étatiques.',
        evaluation: {
          status: 'FAILED',
          errorCode: 'OPEN_ANSWER_EVALUATION_SOURCE_INVALID',
        },
      }),
    ).rejects.toThrow('Activity session is not an open question');

    expect(prisma.openAnswerEvaluation.create).not.toHaveBeenCalled();
  });
});
