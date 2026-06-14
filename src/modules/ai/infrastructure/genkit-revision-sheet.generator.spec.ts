type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    title?: string;
    introduction?: string | null;
    keyPoints?: string[];
    commonMistakes?: string[];
    mustKnow?: string[];
    practiceSuggestions?: string[];
    sections?: Array<{
      title?: string;
      content?: string;
      sourceChunkIds?: string[];
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

import { GenkitRevisionSheetGenerator } from './genkit-revision-sheet.generator';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../application/ai-generation-observer';

describe('GenkitRevisionSheetGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalMaxChunks = process.env.REVISION_SHEET_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.REVISION_SHEET_GENERATION_MAX_CHARS;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('REVISION_SHEET_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('REVISION_SHEET_GENERATION_MAX_CHARS', originalMaxChars);
  });

  it('generates a sourced revision sheet and observes metadata only', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Fiche',
        introduction: 'Introduction.',
        keyPoints: ['Point clé'],
        commonMistakes: ['Erreur'],
        mustKnow: ['Essentiel'],
        practiceSuggestions: ['Pratiquer'],
        sections: [
          {
            title: 'Principe',
            content: 'Contenu structuré.',
            sourceChunkIds: ['chunk-1', 'chunk-1'],
          },
        ],
      },
    });
    const observer = createObserver();

    const sheet = await new GenkitRevisionSheetGenerator(observer).generate({
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
    });

    expect(sheet).toMatchObject({
      title: 'Fiche',
      introduction: 'Introduction.',
      keyPoints: ['Point clé'],
      commonMistakes: ['Erreur'],
      mustKnow: ['Essentiel'],
      practiceSuggestions: ['Pratiquer'],
      sections: [
        {
          displayOrder: 0,
          title: 'Principe',
          content: 'Contenu structuré.',
          sourceChunkIds: ['chunk-1'],
        },
      ],
      metadata: {
        flowName: 'documentRevisionSheetGeneration',
        provider: 'google-genai',
        model: 'googleai/gemini-2.5-flash',
        promptVersion: 'generate-revision-sheet-v1',
        schemaVersion: 'revision-sheet-v1',
        sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
      },
    });
    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('success');
    expect(observation.flowName).toBe('documentRevisionSheetGeneration');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'Contenu structuré.',
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
        title: 'Fiche',
        keyPoints: ['Point clé'],
        sections: [
          {
            title: 'Principe',
            content: 'Contenu structuré.',
            sourceChunkIds: ['chunk-1'],
          },
        ],
      },
    });
    const observer = createObserver();

    const sheet = await new GenkitRevisionSheetGenerator(observer).generate({
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
    expect(sheet.metadata.provider).toBe('mistral');
    expect(sheet.metadata.model).toBe('mistral/mistral-small-latest');
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

  it('rejects revision sheet sections without sources', async () => {
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Fiche',
        sections: [
          {
            title: 'Principe',
            content: 'Contenu structuré.',
            sourceChunkIds: [],
          },
        ],
        keyPoints: ['Point clé'],
      },
    });

    await expect(
      new GenkitRevisionSheetGenerator().generate({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte.', pageNumber: null }],
        knowledgeUnits: [],
      }),
    ).rejects.toThrow();
  });

  it('rejects revision sheets with unknown sources', async () => {
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Fiche',
        sections: [
          {
            title: 'Principe',
            content: 'Contenu structuré.',
            sourceChunkIds: ['chunk-unknown'],
          },
        ],
        keyPoints: ['Point clé'],
      },
    });

    await expect(
      new GenkitRevisionSheetGenerator().generate({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte.', pageNumber: null }],
        knowledgeUnits: [],
      }),
    ).rejects.toThrow('REVISION_SHEET_SOURCE_INVALID');
  });

  it('limits revision sheet input before prompting', async () => {
    process.env.REVISION_SHEET_GENERATION_MAX_CHUNKS = '1';
    process.env.REVISION_SHEET_GENERATION_MAX_CHARS = '8';
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        title: 'Fiche',
        sections: [
          {
            title: 'Principe',
            content: 'Contenu structuré.',
            sourceChunkIds: ['chunk-1'],
          },
        ],
        keyPoints: ['Point clé'],
      },
    });

    await new GenkitRevisionSheetGenerator().generate({
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
