type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    prompt?: string;
    instructions?: string;
    maxAnswerLength?: number;
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
import { GenkitOpenQuestionGenerator } from './genkit-open-question.generator';

describe('GenkitOpenQuestionGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.OPEN_QUESTION_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.OPEN_QUESTION_GENERATION_MAX_CHARS;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('OPEN_QUESTION_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('OPEN_QUESTION_GENERATION_MAX_CHARS', originalMaxChars);
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
  });

  it('generates a sourced open question and observes metadata only', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        prompt:
          'Explique pourquoi la séparation des pouvoirs limite la concentration du pouvoir.',
        instructions:
          'Réponds en trois paragraphes courts en justifiant avec le cours.',
        maxAnswerLength: 2200,
        sourceChunkIds: ['chunk-1', 'chunk-1'],
      },
    });
    const observer = createObserver();

    const question = await new GenkitOpenQuestionGenerator(observer).generate({
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnit: {
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Séparation des pouvoirs',
        summary: 'La notion distingue les fonctions étatiques.',
        difficulty: 'MEDIUM',
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
    });

    expect(question).toMatchObject({
      version: 1,
      prompt:
        'Explique pourquoi la séparation des pouvoirs limite la concentration du pouvoir.',
      instructions:
        'Réponds en trois paragraphes courts en justifiant avec le cours.',
      maxAnswerLength: 2200,
      sourceChunkIds: ['chunk-1'],
      metadata: {
        flowName: 'openQuestionGeneration',
        provider: 'google-genai',
        model: 'googleai/gemini-2.5-flash',
        promptVersion: 'open-question-generation-v1',
        schemaVersion: 'open-question-generation-v1',
      },
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(generateInput?.prompt).toContain('Séparation des pouvoirs');
    expect(generateInput?.output.schema).toBeDefined();
    const observation = getObservedObservation(observer);
    expect(observation).toMatchObject({
      flowName: 'openQuestionGeneration',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'open-question-generation-v1',
      schemaVersion: 'open-question-generation-v1',
      status: 'success',
      documentId: 'document-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'limite la concentration',
    );
  });

  it('rejects unknown open question sources and observes an error', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        prompt: 'Explique la notion avec le cours.',
        instructions: 'Réponds brièvement.',
        maxAnswerLength: 1000,
        sourceChunkIds: ['chunk-unknown'],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitOpenQuestionGenerator(observer).generate({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnit: {
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Séparation des pouvoirs',
          summary: 'Résumé.',
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
      }),
    ).rejects.toThrow('OPEN_QUESTION_SOURCE_INVALID');

    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('error');
    expect(observation.errorCode).toBe('OPEN_QUESTION_SOURCE_INVALID');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
  });

  it('rejects unknown fields from open question output', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        prompt: 'Explique la notion avec le cours.',
        instructions: 'Réponds brièvement.',
        maxAnswerLength: 1000,
        sourceChunkIds: ['chunk-1'],
        unexpected: 'forbidden',
      },
    });

    await expect(
      new GenkitOpenQuestionGenerator().generate({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnit: {
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Séparation des pouvoirs',
          summary: 'Résumé.',
          sourceChunkIds: ['chunk-1'],
        },
        chunks: [
          {
            id: 'chunk-1',
            index: 0,
            text: 'Texte source.',
            pageNumber: null,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('limits open question generation chunks by configured count and chars', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.OPEN_QUESTION_GENERATION_MAX_CHUNKS = '1';
    process.env.OPEN_QUESTION_GENERATION_MAX_CHARS = '8';
    mockGenerate.mockResolvedValue({
      output: {
        prompt: 'Explique la notion avec le cours.',
        instructions: 'Réponds brièvement.',
        maxAnswerLength: 1000,
        sourceChunkIds: ['chunk-1'],
      },
    });

    await new GenkitOpenQuestionGenerator().generate({
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnit: {
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Séparation des pouvoirs',
        summary: 'Résumé.',
        sourceChunkIds: ['chunk-1', 'chunk-2'],
      },
      chunks: [
        { id: 'chunk-2', index: 1, text: 'SECOND_SENTINEL', pageNumber: null },
        { id: 'chunk-1', index: 0, text: '1234567890', pageNumber: null },
      ],
    });

    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('12345678');
    expect(generateInput?.prompt).not.toContain('90');
    expect(generateInput?.prompt).not.toContain('SECOND_SENTINEL');
  });
});

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
