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
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
