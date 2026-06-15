type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    actionKind?: string;
    knowledgeUnitId?: string | null;
    reasonCode?: string;
    message?: string;
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
import { GenkitRevisionCoachNextActionGenerator } from './genkit-revision-coach-next-action.generator';

describe('GenkitRevisionCoachNextActionGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalGenkitModel = process.env.GENKIT_MODEL;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
  });

  it('returns a valid bounded decision and observes metadata only', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: 'unit-1',
        reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
      },
    });
    const observer = createObserver();

    const decision = await new GenkitRevisionCoachNextActionGenerator(
      observer,
    ).generate(baseInput());

    expect(decision).toEqual({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-1',
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('revision-session-1');
    expect(generateInput?.prompt).not.toContain('SENTINEL_FULL_COURSE_TEXT');
    expect(generateInput?.output.schema).toBeDefined();
    const observation = getObservedObservation(observer);
    expect(observation).toMatchObject({
      flowName: 'revisionCoachNextAction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'revision-coach-next-action-v1',
      schemaVersion: 'revision-coach-next-action-v1',
      status: 'success',
      documentId: 'document-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      studentId: 'student-1',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_COURSE_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'ALTERNATE_ACTIVITY_TYPE',
    );
  });

  it('rejects empty output with a controlled error', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({});
    const observer = createObserver();

    await expect(
      new GenkitRevisionCoachNextActionGenerator(observer).generate(
        baseInput(),
      ),
    ).rejects.toThrow('REVISION_COACH_EMPTY_OUTPUT');

    expect(getObservedObservation(observer)).toMatchObject({
      status: 'error',
      errorCode: 'REVISION_COACH_EMPTY_OUTPUT',
    });
  });

  it('rejects actions that are not allowed', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: 'unit-1',
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });

    await expect(
      new GenkitRevisionCoachNextActionGenerator().generate({
        ...baseInput(),
        availableActions: ['DIAGNOSTIC_QUIZ'],
      }),
    ).rejects.toThrow('REVISION_COACH_ACTION_NOT_ALLOWED');
  });

  it('rejects open question decisions without an allowed knowledge unit', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: null,
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });

    await expect(
      new GenkitRevisionCoachNextActionGenerator().generate(baseInput()),
    ).rejects.toThrow('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');

    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: 'unit-unknown',
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });

    await expect(
      new GenkitRevisionCoachNextActionGenerator().generate(baseInput()),
    ).rejects.toThrow('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  });

  it('observes provider errors with a controlled failure code', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockRejectedValue(new Error('raw provider stack'));
    const observer = createObserver();

    await expect(
      new GenkitRevisionCoachNextActionGenerator(observer).generate(
        baseInput(),
      ),
    ).rejects.toThrow('raw provider stack');

    expect(getObservedObservation(observer)).toMatchObject({
      status: 'error',
      errorCode: 'REVISION_COACH_FAILED',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'raw provider stack',
    );
  });
});

function baseInput() {
  return {
    studentId: 'student-1',
    sessionId: 'revision-session-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    sessionKnowledgeUnitId: 'unit-1',
    history: [
      {
        kind: 'DIAGNOSTIC_QUIZ' as const,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId: 'quiz-session-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
    availableActions: ['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION'] as const,
    allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
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
