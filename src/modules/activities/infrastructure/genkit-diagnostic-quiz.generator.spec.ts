import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';

type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    title: string;
    questions: Array<{
      prompt: string;
      difficulty?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
      choices: Array<{ id: string; label: string; feedback?: string | null }>;
      selectionMode?: 'single' | 'multiple';
      minSelections?: number | null;
      maxSelections?: number | null;
      correctChoiceId?: string;
      correctChoiceIds?: string[];
      explanation: string;
      sourceChunkIds?: string[];
      visuals?: Array<
        | {
            type: 'CHART';
            displayOrder?: number;
            chartType: 'bar' | 'line' | 'pie' | 'scatter';
            title: string;
            description?: string | null;
            data: Array<Record<string, string | number | null>>;
            xKey?: string | null;
            yKeys?: string[];
            sourceChunkIds: string[];
          }
        | {
            type: 'DIAGRAM';
            displayOrder?: number;
            title: string;
            description?: string | null;
            nodes: Array<{ id: string; label: string }>;
            edges?: Array<{ from: string; to: string; label?: string | null }>;
            sourceChunkIds: string[];
          }
      >;
    }>;
  };
};

type GenkitInput = {
  plugins: unknown[];
  model: string;
};

type OpenAICompatibleInput = {
  name: string;
  apiKey?: string;
  baseURL?: string;
};

const mockMistralPlugin = { name: 'mistral-plugin' };
const mockGooglePlugin = { name: 'google-plugin' };
const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockOpenAICompatible = jest.fn<unknown, [OpenAICompatibleInput]>(
  () => mockMistralPlugin,
);
const mockGoogleAI = jest.fn<unknown, []>(() => mockGooglePlugin);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
}));

jest.mock('@genkit-ai/compat-oai', () => ({
  __esModule: true,
  default: mockOpenAICompatible,
  openAICompatible: mockOpenAICompatible,
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: mockGoogleAI,
}));

import { GenkitDiagnosticQuizGenerator } from './genkit-diagnostic-quiz.generator';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import { Logger } from '@nestjs/common';

describe('GenkitDiagnosticQuizGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalMistralFallbackModel = process.env.MISTRAL_FALLBACK_MODEL;
  const originalMistralDiagnosticQuizFallbackModel =
    process.env.MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL;
  const originalGoogleGenaiApiKey = process.env.GOOGLE_GENAI_API_KEY;
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalGoogleApiKey = process.env.GOOGLE_API_KEY;
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHARS;
  const originalDefaultQuestionCount =
    process.env.DIAGNOSTIC_QUIZ_DEFAULT_QUESTION_COUNT;
  const originalMaxQuestionCount =
    process.env.DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('MISTRAL_FALLBACK_MODEL', originalMistralFallbackModel);
    restoreEnv(
      'MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL',
      originalMistralDiagnosticQuizFallbackModel,
    );
    restoreEnv('GOOGLE_GENAI_API_KEY', originalGoogleGenaiApiKey);
    restoreEnv('GEMINI_API_KEY', originalGeminiApiKey);
    restoreEnv('GOOGLE_API_KEY', originalGoogleApiKey);
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('DIAGNOSTIC_QUIZ_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('DIAGNOSTIC_QUIZ_GENERATION_MAX_CHARS', originalMaxChars);
    restoreEnv(
      'DIAGNOSTIC_QUIZ_DEFAULT_QUESTION_COUNT',
      originalDefaultQuestionCount,
    );
    restoreEnv('DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT', originalMaxQuestionCount);
    mockOpenAICompatible.mockClear();
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('does not initialize Genkit when imported or constructed', () => {
    new GenkitDiagnosticQuizGenerator();

    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGoogleAI).not.toHaveBeenCalled();
    expect(mockGenkit).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('generates a Mistral-backed quiz from the selected knowledge unit', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    delete process.env.MISTRAL_MODEL;
    mockGenerate.mockResolvedValue({
      output: generatedQuiz(),
    });

    const quiz = await new GenkitDiagnosticQuizGenerator().generate({
      knowledgeUnit: new KnowledgeUnit({
        id: 'unit-constitution',
        subjectId: 'subject-constitutional-law',
        title: 'Revision constitutionnelle',
        summary:
          'La Constitution de 1958 encadre la procedure de revision et protege la forme republicaine du gouvernement.',
      }),
    });

    expect(mockOpenAICompatible).toHaveBeenCalledWith({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(mockGenkit).toHaveBeenCalledWith({
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-small-latest',
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('Revision constitutionnelle');
    expect(generateInput?.prompt).toContain('forme republicaine');
    expect(generateInput?.prompt).not.toContain('contraction cardiaque');
    expect(generateInput?.prompt).toContain('correctChoiceId');
    expect(generateInput?.prompt).toContain('exactement 10 questions');
    expect(generateInput?.output.schema).toBeDefined();
    expect(quiz).toEqual(generatedQuiz());
  });

  it('asks for deeper questions before labeling a question high difficulty', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: generatedQuiz(),
    });

    await new GenkitDiagnosticQuizGenerator().generate({
      knowledgeUnit: new KnowledgeUnit({
        id: 'unit-regimes',
        subjectId: 'subject-constitutional-law',
        title: 'Regimes parlementaire et presidentiel',
        summary:
          'Le regime parlementaire repose sur une responsabilite politique du gouvernement devant le Parlement, tandis que le regime presidentiel se caracterise par une separation plus stricte des pouvoirs.',
        difficulty: 'HIGH',
      }),
    });

    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain(
      'Varie les niveaux cognitifs: restitution, comprehension, comparaison, application, piege conceptuel et raisonnement source.',
    );
    expect(generateInput?.prompt).toContain(
      'Ne classe jamais une simple question de restitution en difficulty=HIGH.',
    );
    expect(generateInput?.prompt).toContain(
      'Pour difficulty=HIGH, la question doit exiger comparaison, application, diagnostic d erreur ou raisonnement a partir d une source.',
    );
    expect(generateInput?.prompt).toContain(
      'Evite les questions dont la reponse est directement recopiee dans un choix.',
    );
    expect(generateInput?.prompt).toContain(
      'Au moins 70% des questions doivent evaluer une comparaison, une application a un cas, une consequence, une exception ou un piege conceptuel.',
    );
    expect(generateInput?.prompt).toContain(
      'Limite les questions de simple auteur, date, definition ou identification isolee a 30% maximum du QCM.',
    );
  });

  it('generates the requested number of quiz questions up to twenty', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: generatedQuizWithQuestionCount(20),
    });

    const quiz = await new GenkitDiagnosticQuizGenerator().generate({
      questionCount: 20,
      knowledgeUnit: new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Controle de constitutionnalite',
        summary: 'Le Conseil constitutionnel controle certaines normes.',
      }),
    });

    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('exactement 20 questions');
    expect(quiz.questions).toHaveLength(20);
  });

  it('rejects quiz output with fewer questions than requested', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: generatedQuizWithQuestionCount(3),
    });
    const observer = createObserver();

    await expect(
      new GenkitDiagnosticQuizGenerator(observer).generate({
        questionCount: 10,
        knowledgeUnit: new KnowledgeUnit({
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Controle de constitutionnalite',
          summary: 'Le Conseil constitutionnel controle certaines normes.',
        }),
      }),
    ).rejects.toThrow('DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID');

    const observation = getObservedObservation(observer);
    expect(observation.errorCode).toBe(
      'DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID',
    );
  });

  it('rejects quiz output with more than twenty questions', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: generatedQuizWithQuestionCount(21),
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        knowledgeUnit: new KnowledgeUnit({
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Controle de constitutionnalite',
          summary: 'Le Conseil constitutionnel controle certaines normes.',
        }),
      }),
    ).rejects.toThrow();
  });

  it('generates a sourced v2 quiz from the selected knowledge unit chunks', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.GENKIT_MODEL = 'googleai/custom-model';
    process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHUNKS = '1';
    process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHARS = '300';
    mockGenerate.mockResolvedValue({
      output: generatedSourcedQuiz(),
    });
    const observer = createObserver();

    const quiz = await new GenkitDiagnosticQuizGenerator(observer).generate({
      documentId: 'document-1',
      subjectId: 'subject-1',
      questionCount: 1,
      knowledgeUnit: sourcedKnowledgeUnit(),
      chunks: [
        {
          id: 'chunk-unused',
          index: 0,
          text: 'SENTINEL_UNUSED_CHUNK_TEXT',
          pageNumber: null,
        },
        {
          id: 'chunk-source',
          index: 1,
          text: 'SENTINEL_SOURCE_CHUNK_TEXT Article 89 organise la revision.',
          pageNumber: 2,
        },
      ],
    });

    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('chunk-source');
    expect(generateInput?.prompt).toContain('SENTINEL_SOURCE_CHUNK_TEXT');
    expect(generateInput?.prompt).not.toContain('SENTINEL_UNUSED_CHUNK_TEXT');
    expect(quiz).toEqual({
      ...generatedSourcedQuiz(),
      version: 2,
      metadata: {
        flowName: 'diagnosticQuizGeneration',
        provider: 'google-genai',
        model: 'googleai/custom-model',
        promptVersion: 'diagnostic-quiz-v2',
        schemaVersion: 'diagnostic-quiz-v2',
        inputSize: generateInput?.prompt.length,
      },
    });

    const observation = getObservedObservation(observer);
    expect(observation).toEqual({
      flowName: 'diagnosticQuizGeneration',
      provider: 'google-genai',
      model: 'googleai/custom-model',
      promptVersion: 'diagnostic-quiz-v2',
      schemaVersion: 'diagnostic-quiz-v2',
      inputSize: generateInput?.prompt.length,
      durationMs: observation.durationMs,
      status: 'success',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-source',
      subjectId: 'subject-1',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_SOURCE_CHUNK_TEXT');
    expect(observedPayload).not.toContain('SENTINEL_UNUSED_CHUNK_TEXT');
    expect(observedPayload).not.toContain('La forme republicaine');
    expect(observedPayload).not.toContain('correct-source');
    expect(observedPayload).not.toContain('Explication sourcee');
  });

  it('generates a sourced v3 quiz with multiple answers and bounded visuals', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: generatedMediaMultiQuiz(),
    });
    const observer = createObserver();

    const quiz = await new GenkitDiagnosticQuizGenerator(observer).generate({
      documentId: 'document-1',
      subjectId: 'subject-1',
      questionCount: 1,
      visualsEnabled: true,
      visualTypes: ['CHART', 'DIAGRAM'],
      selectionModes: ['single', 'multiple'],
      knowledgeUnit: sourcedKnowledgeUnit(),
      chunks: [
        {
          id: 'chunk-source',
          index: 1,
          text: 'Le cours compare les pouvoirs et leurs controles.',
          pageNumber: 2,
        },
      ],
    });

    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('selectionMode');
    expect(generateInput?.prompt).toContain('CHART');
    expect(generateInput?.prompt).toContain('DIAGRAM');
    expect(generateInput?.prompt).not.toContain('IMAGE');
    expect(quiz.version).toBe(3);
    expect(quiz.metadata).toMatchObject({
      promptVersion: 'diagnostic-quiz-v3',
      schemaVersion: 'diagnostic-quiz-v3',
    });
    expect(quiz.questions[0]).toMatchObject({
      selectionMode: 'multiple',
      minSelections: 1,
      maxSelections: 2,
      correctChoiceIds: ['a', 'c'],
      visuals: [
        expect.objectContaining({ type: 'CHART' }),
        expect.objectContaining({ type: 'DIAGRAM' }),
      ],
    });
    expect(getObservedObservation(observer)).toMatchObject({
      promptVersion: 'diagnostic-quiz-v3',
      schemaVersion: 'diagnostic-quiz-v3',
      status: 'success',
    });
  });

  it('logs safe quiz generation diagnostics for requested capabilities and output shape', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: generatedMediaMultiQuiz(),
    });

    await new GenkitDiagnosticQuizGenerator(createObserver()).generate({
      documentId: 'document-1',
      subjectId: 'subject-1',
      questionCount: 1,
      visualsEnabled: true,
      visualTypes: ['CHART', 'DIAGRAM'],
      selectionModes: ['single', 'multiple'],
      knowledgeUnit: sourcedKnowledgeUnit(),
      chunks: [
        {
          id: 'chunk-source',
          index: 1,
          text: 'SENTINEL_SOURCE_CHUNK_TEXT Le cours compare les pouvoirs.',
          pageNumber: 2,
        },
      ],
    });

    const logPayloads = loggerLogSpy.mock.calls
      .map(([message]): Record<string, unknown> | null =>
        typeof message === 'string'
          ? (JSON.parse(message) as Record<string, unknown>)
          : null,
      )
      .filter(
        (payload): payload is Record<string, unknown> => payload !== null,
      );
    const contextLog = logPayloads.find(
      (payload) => payload.event === 'diagnostic.quiz.generation.context',
    );

    expect(logPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'diagnostic.quiz.generation.context',
          generationVersion: 'diagnostic-quiz-v3',
          requestedQuestionCount: 1,
          selectedChunkCount: 1,
          requestedSelectionModes: ['single', 'multiple'],
          requestedVisualTypes: ['CHART', 'DIAGRAM'],
          visualsEnabled: true,
          hasSourcedContext: true,
          documentId: 'document-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-source',
        }),
        expect.objectContaining({
          event: 'diagnostic.quiz.generation.output',
          generationVersion: 'diagnostic-quiz-v3',
          outputQuestionCount: 1,
          difficultyCounts: { LOW: 0, MEDIUM: 1, HIGH: 0, UNKNOWN: 0 },
          selectionModeCounts: { single: 0, multiple: 1 },
          visualCounts: { CHART: 1, DIAGRAM: 1 },
          sourcedQuestionCount: 1,
          visualQuestionCount: 1,
          basicPromptHeuristicCount: 0,
        }),
      ]),
    );
    expect(typeof contextLog?.selectedChunkCharCount).toBe('number');
    const logs = JSON.stringify(loggerLogSpy.mock.calls);
    expect(logs).not.toContain('SENTINEL_SOURCE_CHUNK_TEXT');
    expect(logs).not.toContain('correctChoiceIds');
    expect(logs).not.toContain('Le controle juridictionnel');
    expect(logs).not.toContain('Ce choix est correct');
  });

  it('rejects a visual source unknown to the selected chunks', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedMediaMultiQuiz(),
        questions: [
          {
            ...generatedMediaMultiQuiz().questions[0],
            visuals: [
              {
                ...generatedMediaMultiQuiz().questions[0].visuals?.[0],
                sourceChunkIds: ['missing-chunk'],
              },
            ],
          },
        ],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitDiagnosticQuizGenerator(observer).generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        questionCount: 1,
        visualsEnabled: true,
        visualTypes: ['CHART'],
        selectionModes: ['multiple'],
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Le cours compare les pouvoirs et leurs controles.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow('DIAGNOSTIC_QUIZ_VISUAL_INVALID');

    expect(getObservedObservation(observer)).toMatchObject({
      promptVersion: 'diagnostic-quiz-v3',
      schemaVersion: 'diagnostic-quiz-v3',
      status: 'error',
      errorCode: 'DIAGNOSTIC_QUIZ_VISUAL_INVALID',
    });
  });

  it('keeps v3 versions when a Mistral fallback succeeds after invalid v3 output', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_MODEL = 'mistral-small-latest';
    process.env.MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate
      .mockResolvedValueOnce({
        output: {
          ...generatedMediaMultiQuiz(),
          questions: [
            {
              ...generatedMediaMultiQuiz().questions[0],
              visuals: [
                {
                  ...generatedMediaMultiQuiz().questions[0].visuals?.[0],
                  sourceChunkIds: ['missing-chunk'],
                },
              ],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output: generatedMediaMultiQuiz(),
      });
    const observer = createObserver();

    const quiz = await new GenkitDiagnosticQuizGenerator(observer).generate({
      documentId: 'document-1',
      subjectId: 'subject-1',
      questionCount: 1,
      visualsEnabled: true,
      visualTypes: ['CHART', 'DIAGRAM'],
      selectionModes: ['single', 'multiple'],
      knowledgeUnit: sourcedKnowledgeUnit(),
      chunks: [
        {
          id: 'chunk-source',
          index: 1,
          text: 'Le cours compare les pouvoirs et leurs controles.',
          pageNumber: 2,
        },
      ],
    });

    expect(quiz.metadata).toMatchObject({
      model: 'mistral/mistral-large-latest',
      promptVersion: 'diagnostic-quiz-v3',
      schemaVersion: 'diagnostic-quiz-v3',
    });
    expect(observer.observe.mock.calls).toHaveLength(2);
    expect(observer.observe.mock.calls[0]?.[0]).toMatchObject({
      model: 'mistral/mistral-small-latest',
      promptVersion: 'diagnostic-quiz-v3',
      schemaVersion: 'diagnostic-quiz-v3',
      status: 'error',
      errorCode: 'DIAGNOSTIC_QUIZ_VISUAL_INVALID',
    });
    expect(observer.observe.mock.calls[1]?.[0]).toMatchObject({
      model: 'mistral/mistral-large-latest',
      promptVersion: 'diagnostic-quiz-v3',
      schemaVersion: 'diagnostic-quiz-v3',
      status: 'success',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('correctChoiceIds');
    expect(observedPayload).not.toContain('Le controle juridictionnel');
    expect(observedPayload).not.toContain(
      'Le controle et la separation des pouvoirs',
    );
  });

  it('rejects sourced v2 quiz output that references an unknown chunk', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        questions: [
          {
            ...generatedSourcedQuiz().questions[0],
            sourceChunkIds: ['missing-chunk'],
          },
        ],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitDiagnosticQuizGenerator(observer).generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow('DIAGNOSTIC_QUIZ_SOURCE_INVALID');

    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('error');
    expect(observation.errorCode).toBe('DIAGNOSTIC_QUIZ_SOURCE_INVALID');
    expect(observation.documentId).toBe('document-1');
    expect(observation.knowledgeUnitId).toBe('unit-source');
  });

  it('retries sourced v2 quiz generation with a specific Mistral fallback model after invalid sources', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_MODEL = 'mistral-small-latest';
    process.env.MISTRAL_FALLBACK_MODEL = 'mistral-global-fallback';
    process.env.MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate
      .mockResolvedValueOnce({
        output: {
          ...generatedSourcedQuiz(),
          questions: [
            {
              ...generatedSourcedQuiz().questions[0],
              sourceChunkIds: ['missing-chunk'],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output: generatedSourcedQuiz(),
      });
    const observer = createObserver();

    const quiz = await new GenkitDiagnosticQuizGenerator(observer).generate({
      documentId: 'document-1',
      subjectId: 'subject-1',
      knowledgeUnit: sourcedKnowledgeUnit(),
      chunks: [
        {
          id: 'chunk-source',
          index: 1,
          text: 'SENTINEL_SOURCE_CHUNK_TEXT Article 89 organise la revision.',
          pageNumber: 2,
        },
      ],
    });

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenkit).toHaveBeenNthCalledWith(1, {
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-small-latest',
    });
    expect(mockGenkit).toHaveBeenNthCalledWith(2, {
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-large-latest',
    });
    expect(quiz.metadata?.model).toBe('mistral/mistral-large-latest');
    expect(observer.observe.mock.calls).toHaveLength(2);
    expect(observer.observe.mock.calls[0]?.[0]).toMatchObject({
      status: 'error',
      model: 'mistral/mistral-small-latest',
      errorCode: 'DIAGNOSTIC_QUIZ_SOURCE_INVALID',
    });
    expect(observer.observe.mock.calls[1]?.[0]).toMatchObject({
      status: 'success',
      model: 'mistral/mistral-large-latest',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_SOURCE_CHUNK_TEXT');
    expect(observedPayload).not.toContain('correct-source');
    expect(observedPayload).not.toContain('Explication sourcee');
    expect(observedPayload).not.toContain('Ce choix est correct');
  });

  it('rejects sourced v2 quiz output without question sources', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        questions: [
          {
            ...generatedSourcedQuiz().questions[0],
            sourceChunkIds: [],
          },
        ],
      },
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow('DIAGNOSTIC_QUIZ_SOURCE_INVALID');
  });

  it('rejects v2 quiz output with an invalid correct choice id', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        questions: [
          {
            ...generatedSourcedQuiz().questions[0],
            correctChoiceId: 'missing-choice',
          },
        ],
      },
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects v2 quiz output with duplicate choice ids', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        questions: [
          {
            ...generatedSourcedQuiz().questions[0],
            choices: [
              { id: 'same-choice', label: 'Choix A' },
              { id: 'same-choice', label: 'Choix B' },
            ],
            correctChoiceId: 'same-choice',
          },
        ],
      },
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects v2 quiz output with insufficient choices', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        questions: [
          {
            ...generatedSourcedQuiz().questions[0],
            choices: [{ id: 'only-choice', label: 'Choix unique' }],
            correctChoiceId: 'only-choice',
          },
        ],
      },
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects v2 quiz output without a pedagogical explanation', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        questions: [
          {
            ...generatedSourcedQuiz().questions[0],
            explanation: '',
          },
        ],
      },
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown fields in v2 quiz output', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedSourcedQuiz(),
        unexpectedField: 'not allowed',
      } as never,
    });

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        documentId: 'document-1',
        subjectId: 'subject-1',
        knowledgeUnit: sourcedKnowledgeUnit(),
        chunks: [
          {
            id: 'chunk-source',
            index: 1,
            text: 'Article 89 organise la revision.',
            pageNumber: 2,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('uses the Google Genkit provider when Mistral is not configured', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.GENKIT_MODEL = 'googleai/custom-model';
    mockGenerate.mockResolvedValue({
      output: generatedQuiz(),
    });

    await new GenkitDiagnosticQuizGenerator().generate({
      knowledgeUnit: new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Controle de constitutionnalite',
        summary: 'Le Conseil constitutionnel controle certaines normes.',
      }),
    });

    expect(mockGoogleAI).toHaveBeenCalledTimes(1);
    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGenkit).toHaveBeenCalledWith({
      plugins: [mockGooglePlugin],
      model: 'googleai/custom-model',
    });
  });

  it('falls back from Google to Mistral when diagnostic quiz generation fails', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate
      .mockRejectedValueOnce(new Error('provider temporarily unavailable'))
      .mockResolvedValueOnce({
        output: generatedQuiz(),
      });
    const observer = createObserver();

    const quiz = await new GenkitDiagnosticQuizGenerator(observer).generate({
      knowledgeUnit: new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Controle de constitutionnalite',
        summary: 'Le Conseil constitutionnel controle certaines normes.',
      }),
    });

    expect(quiz).toEqual(generatedQuiz());
    expect(mockGoogleAI).toHaveBeenCalledTimes(1);
    expect(mockOpenAICompatible).toHaveBeenCalledWith({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(mockGenkit).toHaveBeenNthCalledWith(1, {
      plugins: [mockGooglePlugin],
      model: 'googleai/gemini-2.5-flash',
    });
    expect(mockGenkit).toHaveBeenNthCalledWith(2, {
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-large-latest',
    });
    expect(observer.observe.mock.calls[0]?.[0]).toMatchObject({
      provider: 'google-genai',
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
      errorCategory: 'UNKNOWN',
    });
    expect(observer.observe.mock.calls[1]?.[0]).toMatchObject({
      provider: 'mistral',
      model: 'mistral/mistral-large-latest',
      status: 'success',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('Controle de constitutionnalite');
    expect(observedPayload).not.toContain('test-gemini-key');
    expect(observedPayload).not.toContain('test-mistral-key');
    expect(observedPayload).not.toContain('provider temporarily unavailable');
  });

  it('rejects empty Genkit output', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockResolvedValue({});

    await expect(
      new GenkitDiagnosticQuizGenerator().generate({
        knowledgeUnit: new KnowledgeUnit({
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Controle de constitutionnalite',
          summary: 'Le Conseil constitutionnel controle certaines normes.',
        }),
      }),
    ).rejects.toThrow('Generated diagnostic quiz is empty');
  });

  it('observes successful quiz generations without sending knowledge unit content', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.GENKIT_MODEL = 'googleai/custom-model';
    mockGenerate.mockResolvedValue({
      output: generatedQuiz(),
    });
    const observer = createObserver();

    await new GenkitDiagnosticQuizGenerator(observer).generate({
      knowledgeUnit: new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'SENTINEL_UNIT_TITLE',
        summary: 'SENTINEL_UNIT_SUMMARY',
      }),
    });

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'diagnosticQuizGeneration',
      provider: 'google-genai',
      model: 'googleai/custom-model',
      promptVersion: 'diagnostic-quiz-v2',
      schemaVersion: 'diagnostic-quiz-v2',
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: 'success',
      knowledgeUnitId: 'unit-1',
      subjectId: 'subject-1',
    });
    expect(observation.inputSize).toBeGreaterThan(
      'SENTINEL_UNIT_TITLE'.length + 'SENTINEL_UNIT_SUMMARY'.length,
    );
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_UNIT_TITLE');
    expect(observedPayload).not.toContain('SENTINEL_UNIT_SUMMARY');
    expect(observedPayload).not.toContain('forme republicaine');
  });

  it('observes quiz generation errors without logging provider messages', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'secret-test-key';
    mockGenerate.mockRejectedValue(
      new Error('SENTINEL_PROVIDER_ERROR_WITH_UNIT_CONTENT'),
    );
    const observer = createObserver();

    await expect(
      new GenkitDiagnosticQuizGenerator(observer).generate({
        knowledgeUnit: new KnowledgeUnit({
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'SENTINEL_UNIT_TITLE',
          summary: 'SENTINEL_UNIT_SUMMARY',
        }),
      }),
    ).rejects.toThrow('SENTINEL_PROVIDER_ERROR_WITH_UNIT_CONTENT');

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'diagnosticQuizGeneration',
      provider: 'mistral',
      model: 'mistral/mistral-small-latest',
      promptVersion: 'diagnostic-quiz-v2',
      schemaVersion: 'diagnostic-quiz-v2',
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
      errorCategory: 'UNKNOWN',
      errorName: 'Error',
      errorSummary: 'AI provider generation failed',
      knowledgeUnitId: 'unit-1',
      subjectId: 'subject-1',
    });
    expect(observation.inputSize).toBeGreaterThan(
      'SENTINEL_UNIT_TITLE'.length + 'SENTINEL_UNIT_SUMMARY'.length,
    );
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_UNIT_TITLE');
    expect(observedPayload).not.toContain('SENTINEL_UNIT_SUMMARY');
    expect(observedPayload).not.toContain('secret-test-key');
    expect(observedPayload).not.toContain(
      'SENTINEL_PROVIDER_ERROR_WITH_UNIT_CONTENT',
    );
  });

  it('observes provider configuration errors before rethrowing them', async () => {
    process.env.AI_PROVIDER = 'mistral';
    delete process.env.MISTRAL_API_KEY;
    const observer = createObserver();

    await expect(
      new GenkitDiagnosticQuizGenerator(observer).generate({
        knowledgeUnit: new KnowledgeUnit({
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'SENTINEL_UNIT_TITLE',
          summary: 'SENTINEL_UNIT_SUMMARY',
        }),
      }),
    ).rejects.toThrow('MISTRAL_API_KEY is required');

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'diagnosticQuizGeneration',
      provider: 'mistral',
      model: 'mistral/mistral-small-latest',
      promptVersion: 'diagnostic-quiz-v2',
      schemaVersion: 'diagnostic-quiz-v2',
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
      errorCategory: 'CONFIGURATION',
      errorName: 'Error',
      errorSummary: 'AI provider configuration is invalid or incomplete',
      knowledgeUnitId: 'unit-1',
      subjectId: 'subject-1',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_UNIT_TITLE');
    expect(observedPayload).not.toContain('SENTINEL_UNIT_SUMMARY');
    expect(observedPayload).not.toContain('MISTRAL_API_KEY is required');
  });
});

function generatedQuiz() {
  return {
    title: 'Diagnostic constitutionnel',
    questions: [
      {
        prompt:
          'Quelle limite materielle encadre la revision constitutionnelle en France ?',
        choices: [
          { id: 'a', label: 'La forme republicaine du gouvernement' },
          { id: 'b', label: 'La suppression du Parlement' },
        ],
        correctChoiceId: 'a',
        explanation:
          'La forme republicaine du gouvernement ne peut pas faire l objet d une revision.',
      },
    ],
  };
}

function generatedQuizWithQuestionCount(questionCount: number) {
  return {
    title: 'Diagnostic constitutionnel',
    questions: Array.from({ length: questionCount }, (_value, index) => ({
      prompt: `Quelle limite materielle ${index + 1} encadre la revision constitutionnelle en France ?`,
      choices: [
        {
          id: `correct-${index + 1}`,
          label: 'La forme republicaine du gouvernement',
        },
        {
          id: `wrong-${index + 1}`,
          label: 'La suppression du Parlement',
        },
      ],
      correctChoiceId: `correct-${index + 1}`,
      explanation:
        'La forme republicaine du gouvernement ne peut pas faire l objet d une revision.',
    })),
  };
}

function generatedSourcedQuiz() {
  return {
    title: 'Diagnostic constitutionnel source',
    questions: [
      {
        prompt:
          'Quelle limite materielle encadre la revision constitutionnelle en France ?',
        difficulty: 'MEDIUM' as const,
        choices: [
          {
            id: 'correct-source',
            label: 'La forme republicaine du gouvernement',
            feedback:
              'Ce choix reprend la limite materielle explicitement mentionnee.',
          },
          {
            id: 'wrong-source',
            label: 'La suppression automatique du Parlement',
            feedback: 'Ce choix n est pas fonde par le cours fourni.',
          },
        ],
        correctChoiceId: 'correct-source',
        explanation:
          'Explication sourcee: la revision ne peut pas porter atteinte a cette limite.',
        sourceChunkIds: ['chunk-source'],
      },
    ],
  };
}

function generatedMediaMultiQuiz() {
  return {
    title: 'Diagnostic constitutionnel enrichi',
    questions: [
      {
        prompt:
          'Quels elements permettent de controler le pouvoir dans le cours ?',
        difficulty: 'MEDIUM' as const,
        selectionMode: 'multiple' as const,
        minSelections: 1,
        maxSelections: 2,
        choices: [
          {
            id: 'a',
            label: 'Le controle juridictionnel',
            feedback: 'Ce choix est fonde par le passage source.',
          },
          {
            id: 'b',
            label: 'La suppression du Parlement',
            feedback: 'Ce choix n est pas fonde par le cours.',
          },
          {
            id: 'c',
            label: 'La separation des pouvoirs',
            feedback: 'Ce choix est relie au cours.',
          },
        ],
        correctChoiceIds: ['a', 'c'],
        explanation:
          'Le controle et la separation des pouvoirs structurent la limitation du pouvoir.',
        sourceChunkIds: ['chunk-source'],
        visuals: [
          {
            type: 'CHART' as const,
            displayOrder: 0,
            chartType: 'bar' as const,
            title: 'Elements de controle',
            data: [
              { category: 'Controle', value: 2 },
              { category: 'Separation', value: 1 },
            ],
            xKey: 'category',
            yKeys: ['value'],
            sourceChunkIds: ['chunk-source'],
          },
          {
            type: 'DIAGRAM' as const,
            displayOrder: 1,
            title: 'Relations institutionnelles',
            nodes: [
              { id: 'n1', label: 'Pouvoir' },
              { id: 'n2', label: 'Controle' },
            ],
            edges: [{ from: 'n1', to: 'n2', label: 'limite' }],
            sourceChunkIds: ['chunk-source'],
          },
        ],
      },
    ],
  };
}

function sourcedKnowledgeUnit() {
  return Object.assign(
    new KnowledgeUnit({
      id: 'unit-source',
      subjectId: 'subject-1',
      title: 'Revision constitutionnelle',
      summary:
        'La Constitution encadre la procedure de revision et ses limites.',
    }),
    {
      difficulty: 'MEDIUM' as const,
      sourceChunkIds: ['chunk-source'],
    },
  );
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

type TestAiGenerationObserver = {
  observe: jest.Mock<void, [AiGenerationObservation]>;
} & AiGenerationObserver;

function createObserver(): TestAiGenerationObserver {
  return {
    observe: jest.fn(),
  };
}

function getObservedObservation(
  observer: TestAiGenerationObserver,
): AiGenerationObservation {
  const [call] = observer.observe.mock.calls;
  if (!call) {
    throw new Error('Expected an AI generation observation');
  }
  return call[0];
}
