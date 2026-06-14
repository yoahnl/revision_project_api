type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    units: Array<{ title: string; summary: string }>;
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

import { GenkitMistralDocumentKnowledgeExtractor } from './genkit-mistral-document-knowledge.extractor';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../application/ai-generation-observer';

describe('GenkitMistralDocumentKnowledgeExtractor', () => {
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;

  afterEach(() => {
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
  });

  it('does not initialize Genkit when imported or constructed', () => {
    new GenkitMistralDocumentKnowledgeExtractor();

    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGenkit).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('initializes Genkit with the OpenAI-compatible Mistral plugin', async () => {
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    delete process.env.MISTRAL_MODEL;
    mockOpenAICompatible.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Cycle cardiaque',
            summary: 'Phases principales du cycle cardiaque.',
          },
        ],
      },
    });

    const units = await new GenkitMistralDocumentKnowledgeExtractor().extract({
      documentId: 'document-1',
      fileName: 'cours.pdf',
      text: 'Contenu du document.',
    });

    expect(mockOpenAICompatible).toHaveBeenCalledWith({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(mockGenkit).toHaveBeenCalledWith({
      plugins: [mockPlugin],
      model: 'mistral/mistral-small-latest',
    });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(units).toEqual([
      {
        title: 'Cycle cardiaque',
        summary: 'Phases principales du cycle cardiaque.',
      },
    ]);
  });

  it('normalizes bare MISTRAL_MODEL names into the Genkit plugin namespace', async () => {
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_MODEL = 'mistral-large-latest';
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({ output: { units: [] } });

    await new GenkitMistralDocumentKnowledgeExtractor().extract({
      documentId: 'document-1',
      fileName: 'cours.pdf',
      text: 'Contenu du document.',
    });

    expect(mockGenkit).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'mistral/mistral-large-latest' }),
    );
  });

  it('requires MISTRAL_API_KEY before initializing Genkit', async () => {
    delete process.env.MISTRAL_API_KEY;
    mockOpenAICompatible.mockClear();
    mockGenkit.mockClear();

    await expect(
      new GenkitMistralDocumentKnowledgeExtractor().extract({
        documentId: 'document-1',
        fileName: 'cours.pdf',
        text: 'Contenu du document.',
      }),
    ).rejects.toThrow('MISTRAL_API_KEY is required');
    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGenkit).not.toHaveBeenCalled();
  });

  it('observes successful Mistral extractions without sending sensitive content', async () => {
    process.env.MISTRAL_API_KEY = 'secret-test-key';
    delete process.env.MISTRAL_MODEL;
    mockOpenAICompatible.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'SENTINEL_OUTPUT_TITLE',
            summary: 'SENTINEL_OUTPUT_SUMMARY',
          },
        ],
      },
    });
    const observer = createObserver();

    await new GenkitMistralDocumentKnowledgeExtractor(observer).extract({
      documentId: 'document-1',
      fileName: 'secret-file-name.pdf',
      text: 'SENTINEL_FULL_DOCUMENT_TEXT',
    });

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'documentKnowledgeExtraction',
      provider: 'mistral',
      model: 'mistral/mistral-small-latest',
      promptVersion: 'document-knowledge-v1',
      schemaVersion: 'extracted-knowledge-v1',
      inputSize: 'SENTINEL_FULL_DOCUMENT_TEXT'.length,
      durationMs: observation.durationMs,
      status: 'success',
      documentId: 'document-1',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_FULL_DOCUMENT_TEXT');
    expect(observedPayload).not.toContain('secret-file-name.pdf');
    expect(observedPayload).not.toContain('secret-test-key');
    expect(observedPayload).not.toContain('SENTINEL_OUTPUT_TITLE');
    expect(observedPayload).not.toContain('SENTINEL_OUTPUT_SUMMARY');
  });

  it('observes Mistral extraction errors without logging provider messages', async () => {
    process.env.MISTRAL_API_KEY = 'secret-test-key';
    delete process.env.MISTRAL_MODEL;
    mockOpenAICompatible.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockRejectedValue(
      new Error('SENTINEL_PROVIDER_ERROR_WITH_COURSE_TEXT'),
    );
    const observer = createObserver();

    await expect(
      new GenkitMistralDocumentKnowledgeExtractor(observer).extract({
        documentId: 'document-1',
        fileName: 'secret-file-name.pdf',
        text: 'SENTINEL_FULL_DOCUMENT_TEXT',
      }),
    ).rejects.toThrow('SENTINEL_PROVIDER_ERROR_WITH_COURSE_TEXT');

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'documentKnowledgeExtraction',
      provider: 'mistral',
      model: 'mistral/mistral-small-latest',
      promptVersion: 'document-knowledge-v1',
      schemaVersion: 'extracted-knowledge-v1',
      inputSize: 'SENTINEL_FULL_DOCUMENT_TEXT'.length,
      durationMs: observation.durationMs,
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
      documentId: 'document-1',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_FULL_DOCUMENT_TEXT');
    expect(observedPayload).not.toContain('secret-file-name.pdf');
    expect(observedPayload).not.toContain('secret-test-key');
    expect(observedPayload).not.toContain(
      'SENTINEL_PROVIDER_ERROR_WITH_COURSE_TEXT',
    );
  });
});

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
