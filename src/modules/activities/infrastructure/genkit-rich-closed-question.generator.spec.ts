type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
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
const mockGenerate = jest.fn<Promise<{ output?: unknown }>, [GenerateInput]>();
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

import { Logger } from '@nestjs/common';
import {
  GenkitRichClosedQuestionGenerator,
  RICH_CLOSED_GENERATION_CONTRACT_INVALID,
  RICH_CLOSED_GENERATION_QUALITY_REJECTED,
  RICH_CLOSED_GENERATION_SCHEMA_INVALID,
  RICH_CLOSED_GENERATION_SOURCE_INVALID,
  RICH_CLOSED_PROMPT_VERSION,
} from './genkit-rich-closed-question.generator';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
} from '../application/rich-closed-questions/rich-closed-question.fixtures';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import type { RichClosedExercise } from '../application/rich-closed-questions/rich-closed-question.types';

describe('GenkitRichClosedQuestionGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalMistralFallbackModel = process.env.MISTRAL_FALLBACK_MODEL;
  const originalMistralRichClosedFallbackModel =
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL;
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.RICH_CLOSED_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.RICH_CLOSED_GENERATION_MAX_CHARS;
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
      'MISTRAL_RICH_CLOSED_FALLBACK_MODEL',
      originalMistralRichClosedFallbackModel,
    );
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('RICH_CLOSED_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('RICH_CLOSED_GENERATION_MAX_CHARS', originalMaxChars);
    mockOpenAICompatible.mockClear();
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('does not initialize Genkit when imported or constructed', () => {
    new GenkitRichClosedQuestionGenerator();

    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGoogleAI).not.toHaveBeenCalled();
    expect(mockGenkit).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('generates a validated V1-A rich closed exercise with metadata only observations', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockResolvedValue({ output: generatedExercise() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInput());

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
    expect(generateInput?.prompt).toContain('rich-closed-question-v1');
    expect(generateInput?.prompt).toContain('questionTypeMix');
    expect(generateInput?.prompt).toContain('single_choice');
    expect(generateInput?.prompt).toContain('case_qualification');
    expect(generateInput?.prompt).toContain('error_detection');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire des questions fermées.',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais inclure de modelAnswer',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre',
    );
    expect(generateInput?.output.schema).toBeDefined();
    expect(exercise).toMatchObject({
      id: 'rich-exercise-1',
      version: 'rich-closed-question-v1',
      metadata: {
        flowName: 'richClosedQuestionGeneration',
        provider: 'mistral',
        model: 'mistral/mistral-small-latest',
        promptVersion: RICH_CLOSED_PROMPT_VERSION,
        schemaVersion: 'rich-closed-question-v1',
      },
    });
    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('success');
    expect(observation.flowName).toBe('richClosedQuestionGeneration');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('rejects output with a question kind outside V1-A', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            questionKind: 'timeline',
          },
        ],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRichClosedQuestionGenerator(observer).generate(
        generationInput(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    expect(getObservedObservation(observer).errorCode).toBe(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
    );
  });

  it('rejects output dominated by single_choice through the quality gate', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: Array.from({ length: 6 }, (_value, index) => ({
          ...richClosedQuestionFixture('single_choice'),
          id: `single-${index + 1}`,
          prompt: `Question de choix unique ${index + 1}`,
        })),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_QUALITY_REJECTED });
  });

  it('rejects output containing feedback on choices', async () => {
    const exercise = generatedExercise();
    const firstQuestion = exercise.questions[0];
    if (firstQuestion.questionKind !== 'single_choice') {
      throw new Error('Fixture first question must be single_choice');
    }
    mockGenerate.mockResolvedValue({
      output: {
        ...exercise,
        questions: [
          {
            ...firstQuestion,
            choices: [
              {
                ...firstQuestion.choices[0],
                feedback: 'Feedback privé interdit dans la sortie Genkit V1-A.',
              },
              ...firstQuestion.choices.slice(1),
            ],
          },
          ...exercise.questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it('rejects output with unknown source chunks', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['chunk-unknown'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SOURCE_INVALID });
  });

  it('rejects output with invalid cognitiveSkill through contract validation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            cognitiveSkill: 'creative_writing',
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });
  });

  it('rejects output with invalid multiple_choice bounds through contract validation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          richClosedQuestionFixture('single_choice'),
          {
            ...richClosedQuestionFixture('multiple_choice'),
            minSelections: 1,
            maxSelections: 1,
            correctChoiceIds: ['choice-a', 'choice-b'],
          },
          ...generatedExercise().questions.slice(2),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });
  });

  it('returns controlled errors without leaking generated payloads', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['SENTINEL_SECRET_CHUNK'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({
      code: RICH_CLOSED_GENERATION_SOURCE_INVALID,
      message: RICH_CLOSED_GENERATION_SOURCE_INVALID,
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.not.toThrow('SENTINEL_SECRET_CHUNK');
  });
});

function generatedExercise(): RichClosedExercise {
  return richClosedExerciseFixture();
}

function generationInput() {
  return {
    studentId: 'student-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnit: {
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Régime parlementaire rationalisé',
      summary:
        'La responsabilité politique du gouvernement et les mécanismes de rationalisation encadrent les rapports entre Parlement et exécutif.',
      difficulty: 'MEDIUM' as const,
      sourceChunkIds: ['chunk-1'],
    },
    chunks: [
      {
        id: 'chunk-1',
        index: 0,
        text: 'SENTINEL_FULL_CHUNK_TEXT',
        pageNumber: null,
      },
    ],
    questionCount: 6,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
    },
    complexityProfile: 'exam' as const,
  };
}

function createObserver() {
  return {
    observe: jest.fn<void, [AiGenerationObservation]>(),
  } satisfies AiGenerationObserver & {
    observe: jest.Mock<void, [AiGenerationObservation]>;
  };
}

function getObservedObservation(
  observer: ReturnType<typeof createObserver>,
): AiGenerationObservation {
  expect(observer.observe).toHaveBeenCalledTimes(1);

  return observer.observe.mock.calls[0][0];
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
