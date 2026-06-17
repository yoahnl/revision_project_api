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
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
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
    expect(generateInput?.prompt).toContain('JSON object only');
    expect(generateInput?.prompt).toContain('sans Markdown');
    expect(generateInput?.prompt).toContain('sans code fences');
    expect(generateInput?.prompt).toContain(
      'cognitiveSkill autorisés: memorization, comprehension, comparison, classification, case_application, procedure, error_detection, causality',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes single_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, correctChoiceId, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Aucun champ additionnel n’est autorisé.',
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

  it('generates a validated V1-B rich closed exercise when the mix requests timeline and date_slider', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1B() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1B());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
      ],
    );
    expect(generateInput?.prompt).toContain('timeline');
    expect(generateInput?.prompt).toContain('date_slider');
    expect(generateInput?.prompt).toContain(
      'timeline, date_slider, true_false_grid et cause_consequence sont des types V1-B fermés',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire true_false, image_choice',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes timeline: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, events, correctOrder, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes date_slider: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, minYear, maxYear, step, correctYear, toleranceYears, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-B rich closed exercise when the mix requests true_false_grid and cause_consequence', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1BFull() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1BFull());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
      ],
    );
    expect(generateInput?.prompt).toContain('true_false_grid');
    expect(generateInput?.prompt).toContain('cause_consequence');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire true_false_grid avec 3 à 8 rows',
    );
    expect(generateInput?.prompt).toContain(
      'Tu dois produire cause_consequence avec 3 à 6 causes/consequences',
    );
    expect(generateInput?.prompt).toContain('institution_matrix');
    expect(generateInput?.prompt).toContain(
      'institution_matrix, diagram_labeling et calculation_mcq sont des types V1-C fermés',
    );
    expect(generateInput?.prompt).toContain('aucun type V1-022 ou suivant');
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes true_false_grid: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, correctValues, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes cause_consequence: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, causes, consequences, correctPairs, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-C rich closed exercise when the mix requests institution_matrix', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1C() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1C());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
      ],
    );
    expect(generateInput?.prompt).toContain('institution_matrix');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire institution_matrix avec 2 à 5 rows',
    );
    expect(generateInput?.prompt).toContain('3 à 12 cells idéalement');
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre.',
    );
    expect(generateInput?.prompt).toContain(
      'image_choice, fill_blank_dropdown',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes institution_matrix: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, columns, cells, correctValues, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-C rich closed exercise when the mix requests diagram_labeling', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1CFull() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1CFull());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
      ],
    );
    expect(generateInput?.prompt).toContain('diagram_labeling');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire diagram_labeling avec un diagramme sémantique simple',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire un diagramme sous forme de code',
    );
    expect(generateInput?.prompt).toContain(
      'Types V1-022+ interdits: image_choice, fill_blank_dropdown.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes diagram_labeling: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, diagram, slots, correctValues, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-C rich closed exercise when the mix requests calculation_mcq', async () => {
    mockGenerate.mockResolvedValue({
      output: generatedExerciseV1CCalculation(),
    });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1CCalculation());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
        'calculation_mcq',
      ],
    );
    expect(generateInput?.prompt).toContain('calculation_mcq');
    expect(generateInput?.prompt).toContain(
      'absolute_majority_threshold ou largest_remainder_target_party_seats',
    );
    expect(generateInput?.prompt).toContain('formule libre');
    expect(generateInput?.prompt).toContain('D’Hondt');
    expect(generateInput?.prompt).toContain(
      'Types V1-022+ interdits: image_choice, fill_blank_dropdown.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes calculation_mcq: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, scenario, calculation, choices, correctChoiceId, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('logs metadata-only diagnostics when generated question count is wrong', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: generatedExercise().questions.slice(0, 5),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'count',
      expectedQuestionCount: 6,
      actualQuestionCount: 5,
      expectedQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
      actualQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 0,
      },
    });
    expect(errorLog.diagnostic.questionKinds).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
    ]);
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('logs metadata-only diagnostics when generated question type mix is wrong', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('multiple_choice'),
            id: 'multiple-mix-1',
          },
          richClosedQuestionFixture('matching'),
          richClosedQuestionFixture('ordering'),
          richClosedQuestionFixture('case_qualification'),
          richClosedQuestionFixture('error_detection'),
          {
            ...richClosedQuestionFixture('case_qualification'),
            id: 'case-mix-2',
          },
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'mix',
      expectedQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
      actualQuestionTypeMix: {
        single_choice: 0,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 2,
        error_detection: 1,
      },
    });
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('rejects output with a question kind outside the rich closed allowlist', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            questionKind: 'image_choice',
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

  it('rejects V1-B output carrying free-answer fields', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExerciseV1B(),
        questions: generatedExerciseV1B().questions.map((question) =>
          question.questionKind === 'timeline'
            ? { ...question, answerText: 'réponse libre interdite' }
            : question,
        ),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInputV1B()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it.each(['html', 'svg', 'mermaid', 'widget', 'renderPayload'] as const)(
    'rejects diagram_labeling output carrying arbitrary render field %s',
    async (field) => {
      mockGenerate.mockResolvedValue({
        output: {
          ...generatedExerciseV1CFull(),
          questions: generatedExerciseV1CFull().questions.map((question) =>
            question.questionKind === 'diagram_labeling'
              ? { ...question, [field]: '<unsafe>' }
              : question,
          ),
        },
      });

      await expect(
        new GenkitRichClosedQuestionGenerator().generate(
          generationInputV1CFull(),
        ),
      ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
    },
  );

  it.each([
    'formula',
    'expression',
    'script',
    'code',
    'renderPayload',
  ] as const)(
    'rejects calculation_mcq output carrying free-form calculation field %s',
    async (field) => {
      mockGenerate.mockResolvedValue({
        output: {
          ...generatedExerciseV1CCalculation(),
          questions: generatedExerciseV1CCalculation().questions.map(
            (question) =>
              question.questionKind === 'calculation_mcq'
                ? { ...question, [field]: 'unsafe' }
                : question,
          ),
        },
      });

      await expect(
        new GenkitRichClosedQuestionGenerator().generate(
          generationInputV1CCalculation(),
        ),
      ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
    },
  );

  it('rejects calculation_mcq output with an unsupported mode', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExerciseV1CCalculation(),
        questions: generatedExerciseV1CCalculation().questions.map(
          (question) =>
            question.questionKind === 'calculation_mcq'
              ? {
                  ...question,
                  calculation: {
                    mode: 'dhondt_highest_average',
                    totalSeats: 10,
                  },
                }
              : question,
        ),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(
        generationInputV1CCalculation(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it('logs schema diagnostics from direct issues without leaking sensitive context', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    const schemaError = new Error('Schema parser saw SENTINEL_FULL_CHUNK_TEXT');
    Object.assign(schemaError, {
      issues: [
        {
          code: 'invalid_type',
          path: ['questions', 0, 'choices'],
        },
      ],
    });
    mockGenerate.mockRejectedValue(schemaError);

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'schema',
      schemaErrorName: 'Error',
      schemaIssueCount: 1,
      validationIssues: [
        {
          code: 'invalid_type',
          path: 'questions.0.choices',
          severity: 'error',
        },
      ],
    });
    expect(JSON.stringify(errorLog)).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(JSON.stringify(errorLog)).not.toContain('test-mistral-key');
  });

  it('logs schema diagnostics from nested cause issues', async () => {
    const schemaError = new Error('Wrapper output error');
    Object.assign(schemaError, {
      cause: {
        issues: [
          {
            code: 'unrecognized_keys',
            path: ['questions', 2, 'extra'],
          },
        ],
      },
    });
    mockGenerate.mockRejectedValue(schemaError);

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'schema',
      schemaIssueCount: 1,
      validationIssues: [
        {
          code: 'unrecognized_keys',
          path: 'questions.2.extra',
          severity: 'error',
        },
      ],
    });
  });

  it('logs a scrubbed and truncated schema message when no issues are available', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockRejectedValue(
      new Error(
        `JSON output invalid ${'x'.repeat(300)} SENTINEL_FULL_CHUNK_TEXT test-mistral-key`,
      ),
    );

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'schema',
      schemaErrorName: 'Error',
      schemaIssueCount: 0,
    });
    expect(JSON.stringify(errorLog)).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(JSON.stringify(errorLog)).not.toContain('test-mistral-key');
    expect(
      String(
        (errorLog.diagnostic as { schemaErrorMessagePreview?: string })
          .schemaErrorMessagePreview,
      ).length,
    ).toBeLessThanOrEqual(220);
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

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'contract',
      validationIssues: [
        {
          code: 'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
          path: 'questions.0.cognitiveSkill',
        },
      ],
    });
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

  it('logs quality gate issue codes when quality rejects the generation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: Array.from({ length: 6 }, (_value, index) => ({
          ...richClosedQuestionFixture('single_choice'),
          id: `single-quality-${index + 1}`,
          prompt: `Question de choix unique ${index + 1}`,
        })),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_QUALITY_REJECTED });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    const diagnostic = errorLog.diagnostic as {
      failureType?: string;
      qualityIssues?: Array<{ code: string }>;
    };
    expect(diagnostic.failureType).toBe('quality');
    expect(diagnostic.qualityIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        }),
      ]),
    );
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('keeps source invalid categorized and logs source issue paths', async () => {
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

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'source',
      validationIssues: [
        {
          code: 'RICH_CLOSED_SOURCE_UNKNOWN',
          path: 'questions.0.sourceChunkIds',
        },
      ],
    });
  });

  it('retries with a stricter repair prompt when fallback model is configured after contract invalid output', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate
      .mockResolvedValueOnce({
        output: {
          ...generatedExercise(),
          questions: generatedExercise().questions.slice(0, 5),
        },
      })
      .mockResolvedValueOnce({ output: generatedExercise() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInput());

    expect(exercise.id).toBe('rich-exercise-1');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[1][0].prompt).toContain(
      'Tentative de réparation stricte',
    );
    expect(mockGenerate.mock.calls[1][0].prompt).toContain('Question count: 6');
    expect(mockGenerate.mock.calls[1][0].prompt).toContain('questionTypeMix');
    expect(
      observer.observe.mock.calls.map(([observation]) => observation),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
        model: 'mistral/mistral-small-latest',
      }),
      expect.objectContaining({
        status: 'success',
        model: 'mistral/mistral-large-latest',
      }),
    ]);
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(loggerWarnSpy.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(loggerWarnSpy.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('returns the final controlled error when fallback model also fails', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: generatedExercise().questions.slice(0, 5),
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRichClosedQuestionGenerator(observer).generate(
        generationInput(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(
      observer.observe.mock.calls.map(([observation]) => observation),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      }),
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      }),
    ]);
    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'count',
      expectedQuestionCount: 6,
      actualQuestionCount: 5,
    });
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

function generatedExerciseV1B(): RichClosedExercise {
  return richClosedV1BExerciseFixture();
}

function generatedExerciseV1BFull(): RichClosedExercise {
  return richClosedV1BFullExerciseFixture();
}

function generatedExerciseV1C(): RichClosedExercise {
  return richClosedV1CExerciseFixture();
}

function generatedExerciseV1CFull(): RichClosedExercise {
  return richClosedV1CFullExerciseFixture();
}

function generatedExerciseV1CCalculation(): RichClosedExercise {
  return richClosedV1CCalculationExerciseFixture();
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

function generationInputV1B() {
  return {
    ...generationInput(),
    questionCount: 8,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
    },
  };
}

function generationInputV1BFull() {
  return {
    ...generationInput(),
    questionCount: 10,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
    },
  };
}

function generationInputV1C() {
  return {
    ...generationInput(),
    questionCount: 11,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
    },
  };
}

function generationInputV1CFull() {
  return {
    ...generationInput(),
    questionCount: 12,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
    },
  };
}

function generationInputV1CCalculation() {
  return {
    ...generationInput(),
    questionCount: 13,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
    },
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

function getLastRichClosedErrorLog(loggerWarnSpy: jest.SpyInstance): {
  diagnostic?: unknown;
  [key: string]: unknown;
} {
  const parsedLogs = loggerWarnSpy.mock.calls.flatMap(([message]) => {
    const parsed: unknown = JSON.parse(String(message));

    return isLogRecord(parsed) ? [parsed] : [];
  });
  const errorLogs = parsedLogs.filter(
    (log) => log.event === 'rich.closed.generation.error',
  );

  expect(errorLogs.length).toBeGreaterThan(0);

  return errorLogs[errorLogs.length - 1];
}

function isLogRecord(
  value: unknown,
): value is { event?: string; diagnostic?: unknown; [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectNoSensitiveDiagnosticLog(log: unknown) {
  const serialized = JSON.stringify(log);

  expect(serialized).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
  expect(serialized).not.toContain('test-mistral-key');
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
