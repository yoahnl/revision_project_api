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
      choices: Array<{ id: string; label: string }>;
      correctChoiceId: string;
      explanation: string;
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

describe('GenkitDiagnosticQuizGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalGenkitModel = process.env.GENKIT_MODEL;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    mockOpenAICompatible.mockClear();
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
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
    expect(generateInput?.output.schema).toBeDefined();
    expect(quiz).toEqual(generatedQuiz());
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
      promptVersion: 'diagnostic-quiz-v1',
      schemaVersion: 'diagnostic-quiz-v1',
      inputSize: 'SENTINEL_UNIT_TITLE'.length + 'SENTINEL_UNIT_SUMMARY'.length,
      durationMs: observation.durationMs,
      status: 'success',
      knowledgeUnitId: 'unit-1',
      subjectId: 'subject-1',
    });
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
      promptVersion: 'diagnostic-quiz-v1',
      schemaVersion: 'diagnostic-quiz-v1',
      inputSize: 'SENTINEL_UNIT_TITLE'.length + 'SENTINEL_UNIT_SUMMARY'.length,
      durationMs: observation.durationMs,
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
      knowledgeUnitId: 'unit-1',
      subjectId: 'subject-1',
    });
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
      promptVersion: 'diagnostic-quiz-v1',
      schemaVersion: 'diagnostic-quiz-v1',
      inputSize: 'SENTINEL_UNIT_TITLE'.length + 'SENTINEL_UNIT_SUMMARY'.length,
      durationMs: observation.durationMs,
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
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
