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

const mockGooglePlugin = { name: 'google-plugin' };
const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockGoogleAI = jest.fn<unknown, []>(() => mockGooglePlugin);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
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
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.OPEN_ANSWER_EVALUATION_MAX_CHUNKS;
  const originalMaxChars = process.env.OPEN_ANSWER_EVALUATION_MAX_CHARS;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('OPEN_ANSWER_EVALUATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('OPEN_ANSWER_EVALUATION_MAX_CHARS', originalMaxChars);
    mockGoogleAI.mockClear();
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
