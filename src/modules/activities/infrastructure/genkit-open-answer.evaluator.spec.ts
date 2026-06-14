type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    score?: number;
    maxScore?: number;
    feedback?: string;
    presentPoints?: string[];
    missingPoints?: string[];
    errors?: string[];
    modelAnswer?: string;
    advice?: string;
    sourceChunkIds?: string[];
    unexpected?: string;
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

const mockGooglePlugin = { name: 'google-plugin' };
const mockMistralPlugin = { name: 'mistral-plugin' };
const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockGoogleAI = jest.fn<unknown, []>(() => mockGooglePlugin);
const mockOpenAICompatible = jest.fn<unknown, [OpenAICompatibleInput]>(
  () => mockMistralPlugin,
);

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

import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import { GenkitOpenAnswerEvaluator } from './genkit-open-answer.evaluator';

describe('GenkitOpenAnswerEvaluator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalGoogleApiKey = process.env.GOOGLE_GENAI_API_KEY;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalMistralFallbackModel = process.env.MISTRAL_FALLBACK_MODEL;
  const originalMistralOpenAnswerFallbackModel =
    process.env.MISTRAL_OPEN_ANSWER_EVALUATION_FALLBACK_MODEL;
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.OPEN_ANSWER_EVALUATION_MAX_CHUNKS;
  const originalMaxChars = process.env.OPEN_ANSWER_EVALUATION_MAX_CHARS;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('GOOGLE_GENAI_API_KEY', originalGoogleApiKey);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('MISTRAL_FALLBACK_MODEL', originalMistralFallbackModel);
    restoreEnv(
      'MISTRAL_OPEN_ANSWER_EVALUATION_FALLBACK_MODEL',
      originalMistralOpenAnswerFallbackModel,
    );
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('OPEN_ANSWER_EVALUATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('OPEN_ANSWER_EVALUATION_MAX_CHARS', originalMaxChars);
    mockGoogleAI.mockClear();
    mockOpenAICompatible.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
  });

  it('evaluates an open answer and observes metadata only', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        score: 16,
        maxScore: 20,
        feedback:
          'Réponse solide qui explique la limitation de la concentration du pouvoir.',
        presentPoints: ['Séparation des fonctions'],
        missingPoints: ['Exemple institutionnel plus précis'],
        errors: ['Confusion mineure sur le contrôle juridictionnel'],
        modelAnswer:
          'Une bonne réponse explique que la séparation distribue les fonctions entre organes.',
        advice: 'Relis le passage sur les fonctions législative et exécutive.',
        sourceChunkIds: ['chunk-1', 'chunk-1'],
      },
    });
    const observer = createObserver();

    const evaluation = await new GenkitOpenAnswerEvaluator(observer).evaluate({
      subjectId: 'subject-1',
      documentId: 'document-1',
      activitySessionId: 'session-1',
      knowledgeUnit: {
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Séparation des pouvoirs',
        summary: 'La notion distingue les fonctions étatiques.',
        sourceChunkIds: ['chunk-1'],
      },
      question: {
        id: 'open-question-1',
        prompt:
          'Explique pourquoi la séparation des pouvoirs limite la concentration du pouvoir.',
        instructions: 'Réponds avec le cours.',
        sourceChunkIds: ['chunk-1'],
      },
      answerText: 'SENTINEL_FULL_STUDENT_ANSWER',
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'SENTINEL_FULL_CHUNK_TEXT',
          pageNumber: null,
        },
      ],
    });

    expect(evaluation).toMatchObject({
      status: 'READY',
      score: 16,
      maxScore: 20,
      feedback:
        'Réponse solide qui explique la limitation de la concentration du pouvoir.',
      presentPoints: ['Séparation des fonctions'],
      missingPoints: ['Exemple institutionnel plus précis'],
      errors: ['Confusion mineure sur le contrôle juridictionnel'],
      modelAnswer:
        'Une bonne réponse explique que la séparation distribue les fonctions entre organes.',
      advice: 'Relis le passage sur les fonctions législative et exécutive.',
      sourceChunkIds: ['chunk-1'],
      metadata: {
        flowName: 'openAnswerEvaluation',
        provider: 'google-genai',
        model: 'googleai/gemini-2.5-flash',
        promptVersion: 'open-answer-evaluation-v1',
        schemaVersion: 'open-answer-evaluation-v1',
      },
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('SENTINEL_FULL_STUDENT_ANSWER');
    expect(generateInput?.prompt).toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(generateInput?.output.schema).toBeDefined();
    const observation = getObservedObservation(observer);
    expect(observation).toMatchObject({
      flowName: 'openAnswerEvaluation',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'open-answer-evaluation-v1',
      schemaVersion: 'open-answer-evaluation-v1',
      status: 'success',
      documentId: 'document-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      activitySessionId: 'session-1',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_STUDENT_ANSWER',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'bonne réponse explique',
    );
  });

  it('rejects unknown evaluation sources and observes an error', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        score: 12,
        maxScore: 20,
        feedback: 'Feedback structuré.',
        presentPoints: ['Point présent'],
        missingPoints: ['Point manquant'],
        errors: [],
        modelAnswer: 'Réponse modèle.',
        advice: 'Conseil.',
        sourceChunkIds: ['chunk-unknown'],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitOpenAnswerEvaluator(observer).evaluate(baseInput()),
    ).rejects.toThrow('OPEN_ANSWER_EVALUATION_SOURCE_INVALID');

    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('error');
    expect(observation.errorCode).toBe('OPEN_ANSWER_EVALUATION_SOURCE_INVALID');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_STUDENT_ANSWER',
    );
  });

  it('rejects score values outside evaluation bounds', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        score: 30,
        maxScore: 20,
        feedback: 'Feedback structuré.',
        presentPoints: ['Point présent'],
        missingPoints: ['Point manquant'],
        errors: [],
        modelAnswer: 'Réponse modèle.',
        advice: 'Conseil.',
        sourceChunkIds: ['chunk-1'],
      },
    });

    await expect(
      new GenkitOpenAnswerEvaluator().evaluate(baseInput()),
    ).rejects.toThrow();
  });

  it('retries open answer evaluation with a specific Mistral fallback model after invalid schema output', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_MODEL = 'mistral-small-latest';
    process.env.MISTRAL_FALLBACK_MODEL = 'mistral-global-fallback';
    process.env.MISTRAL_OPEN_ANSWER_EVALUATION_FALLBACK_MODEL =
      'mistral-large-latest';
    mockGenerate
      .mockResolvedValueOnce({
        output: {
          score: 24,
          maxScore: 20,
          feedback: 'Feedback structuré.',
          presentPoints: ['Point présent'],
          missingPoints: ['Point manquant'],
          errors: [],
          modelAnswer: 'Réponse modèle.',
          advice: 'Conseil.',
          sourceChunkIds: ['chunk-1'],
        },
      })
      .mockResolvedValueOnce({
        output: {
          score: 5,
          maxScore: 20,
          feedback:
            'La réponse est trop générale et ne mobilise presque pas les critères du cours.',
          presentPoints: ['La réponse tente de prendre position.'],
          missingPoints: ['Lien avec la notion', 'Arguments sourcés'],
          errors: ['Affirmation non justifiée'],
          modelAnswer:
            'Une réponse attendue distingue les éléments du cours et les applique avec précision.',
          advice: 'Reprends les chunks sources avant de reformuler.',
          sourceChunkIds: ['chunk-1'],
        },
      });
    const observer = createObserver();

    const evaluation = await new GenkitOpenAnswerEvaluator(observer).evaluate(
      baseInput(),
    );

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenkit).toHaveBeenNthCalledWith(1, {
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-small-latest',
    });
    expect(mockGenkit).toHaveBeenNthCalledWith(2, {
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-large-latest',
    });
    expect(evaluation.score).toBe(5);
    expect(evaluation.metadata?.model).toBe('mistral/mistral-large-latest');
    expect(observer.observe.mock.calls).toHaveLength(2);
    expect(observer.observe.mock.calls[0]?.[0]).toMatchObject({
      status: 'error',
      model: 'mistral/mistral-small-latest',
      errorCode: 'OPEN_ANSWER_EVALUATION_INVALID',
    });
    expect(observer.observe.mock.calls[1]?.[0]).toMatchObject({
      status: 'success',
      model: 'mistral/mistral-large-latest',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_STUDENT_ANSWER',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'Réponse attendue',
    );
  });
});

function baseInput() {
  return {
    subjectId: 'subject-1',
    documentId: 'document-1',
    activitySessionId: 'session-1',
    knowledgeUnit: {
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Séparation des pouvoirs',
      summary: 'Résumé.',
      sourceChunkIds: ['chunk-1'],
    },
    question: {
      id: 'open-question-1',
      prompt: 'Explique la notion.',
      instructions: 'Réponds avec le cours.',
      sourceChunkIds: ['chunk-1'],
    },
    answerText: 'SENTINEL_FULL_STUDENT_ANSWER',
    chunks: [
      {
        id: 'chunk-1',
        index: 0,
        text: 'SENTINEL_FULL_CHUNK_TEXT',
        pageNumber: null,
      },
    ],
  };
}

function createObserver(): jest.Mocked<AiGenerationObserver> {
  return {
    observe: jest.fn(),
  };
}

function getObservedObservation(
  observer: jest.Mocked<AiGenerationObserver>,
): AiGenerationObservation {
  const [[observation]] = observer.observe.mock.calls;

  if (!observation) {
    throw new Error('Expected observation');
  }

  return observation;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
