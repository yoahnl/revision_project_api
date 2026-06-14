type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    title?: string;
    content?: string;
    keyPoints?: string[];
    limits?: string | null;
    sourceChunkIds?: string[];
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

const mockPlugin = { name: 'mistral-plugin' };
const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockOpenAICompatible = jest.fn<unknown, [OpenAICompatibleInput]>(
  () => mockPlugin,
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

import { GenkitDocumentSummaryGenerator } from './genkit-document-summary.generator';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../application/ai-generation-observer';

describe('GenkitDocumentSummaryGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalGoogleApiKey = process.env.GOOGLE_GENAI_API_KEY;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.SUMMARY_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.SUMMARY_GENERATION_MAX_CHARS;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('GOOGLE_GENAI_API_KEY', originalGoogleApiKey);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('GENKIT_MODEL', originalModel);
    restoreEnv('SUMMARY_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('SUMMARY_GENERATION_MAX_CHARS', originalMaxChars);
  });

  it('generates a sourced summary and observes metadata only', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Résumé',
        content: 'Synthèse courte.',
        keyPoints: ['Point clé'],
        limits: 'Limite.',
        sourceChunkIds: ['chunk-1', 'chunk-1'],
      },
    });
    const observer = createObserver();

    const summary = await new GenkitDocumentSummaryGenerator(observer).generate(
      {
        documentId: 'document-1',
        chunks: [
          {
            id: 'chunk-1',
            index: 0,
            text: 'SENTINEL_FULL_CHUNK_TEXT',
            pageNumber: null,
          },
        ],
        knowledgeUnits: [
          {
            id: 'unit-1',
            title: 'Séparation des pouvoirs',
            summary: 'Résumé de notion',
            sourceChunkIds: ['chunk-1'],
          },
        ],
      },
    );

    expect(summary).toMatchObject({
      title: 'Résumé',
      content: 'Synthèse courte.',
      keyPoints: ['Point clé'],
      limits: 'Limite.',
      sourceChunkIds: ['chunk-1'],
      metadata: {
        flowName: 'documentSummaryGeneration',
        provider: 'google-genai',
        model: 'googleai/gemini-2.5-flash',
        promptVersion: 'generate-summary-v1',
        schemaVersion: 'summary-v1',
        sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
      },
    });
    expect(summary.metadata.generatedAt).toBeInstanceOf(Date);
    expect(summary.metadata.inputSize).toEqual(expect.any(Number));
    const generateCall = mockGenerate.mock.calls[0];
    if (!generateCall) {
      throw new Error('Expected generate to be called');
    }
    expect(generateCall[0].prompt).toContain('SENTINEL_FULL_CHUNK_TEXT');
    const observation = getObservedObservation(observer);
    expect(observation).toEqual({
      flowName: 'documentSummaryGeneration',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'generate-summary-v1',
      schemaVersion: 'summary-v1',
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: 'success',
      documentId: 'document-1',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'Synthèse courte.',
    );
  });

  it('supports the configured Mistral provider without observing sensitive content', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    delete process.env.MISTRAL_MODEL;
    mockOpenAICompatible.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Résumé',
        content: 'Synthèse courte.',
        keyPoints: ['Point clé'],
        sourceChunkIds: ['chunk-1'],
      },
    });
    const observer = createObserver();

    const summary = await new GenkitDocumentSummaryGenerator(observer).generate(
      {
        documentId: 'document-1',
        chunks: [
          {
            id: 'chunk-1',
            index: 0,
            text: 'SENTINEL_FULL_CHUNK_TEXT',
            pageNumber: null,
          },
        ],
        knowledgeUnits: [],
      },
    );

    expect(mockOpenAICompatible).toHaveBeenCalledWith({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(mockGenkit).toHaveBeenCalledWith({
      plugins: [mockPlugin],
      model: 'mistral/mistral-small-latest',
    });
    expect(summary.metadata.provider).toBe('mistral');
    expect(summary.metadata.model).toBe('mistral/mistral-small-latest');
    const observation = getObservedObservation(observer);
    expect(observation.provider).toBe('mistral');
    expect(observation.model).toBe('mistral/mistral-small-latest');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('rejects unknown summary sources', async () => {
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Résumé',
        content: 'Synthèse courte.',
        keyPoints: ['Point clé'],
        sourceChunkIds: ['chunk-unknown'],
      },
    });

    await expect(
      new GenkitDocumentSummaryGenerator().generate({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte.', pageNumber: null }],
        knowledgeUnits: [],
      }),
    ).rejects.toThrow('SUMMARY_SOURCE_INVALID');
  });

  it('rejects summaries without sources', async () => {
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Résumé',
        content: 'Synthèse courte.',
        keyPoints: ['Point clé'],
        sourceChunkIds: [],
      },
    });

    await expect(
      new GenkitDocumentSummaryGenerator().generate({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte.', pageNumber: null }],
        knowledgeUnits: [],
      }),
    ).rejects.toThrow();
  });

  it('limits summary input before prompting', async () => {
    process.env.SUMMARY_GENERATION_MAX_CHUNKS = '1';
    process.env.SUMMARY_GENERATION_MAX_CHARS = '8';
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Résumé',
        content: 'Synthèse courte.',
        keyPoints: ['Point clé'],
        sourceChunkIds: ['chunk-1'],
      },
    });

    await new GenkitDocumentSummaryGenerator().generate({
      documentId: 'document-1',
      chunks: [
        { id: 'chunk-1', index: 0, text: '1234567890', pageNumber: null },
        { id: 'chunk-2', index: 1, text: 'DO_NOT_INCLUDE', pageNumber: null },
      ],
      knowledgeUnits: [],
    });

    const generateCall = mockGenerate.mock.calls[0];
    if (!generateCall) {
      throw new Error('Expected generate to be called');
    }
    expect(generateCall[0].prompt).toContain('12345678');
    expect(generateCall[0].prompt).not.toContain('123456789');
    expect(generateCall[0].prompt).not.toContain('DO_NOT_INCLUDE');
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
  const call = observer.observe.mock.calls[0];

  if (!call) {
    throw new Error('Expected observer to be called');
  }

  return call[0];
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
