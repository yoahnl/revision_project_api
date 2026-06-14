type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    units: Array<{
      title: string;
      summary: string;
      sourceChunkIds?: string[];
      difficulty?: 'LOW' | 'MEDIUM' | 'HIGH';
      displayOrder?: number;
      confidence?: number;
    }>;
  };
};

type GenkitInput = {
  plugins: unknown[];
  model: string;
};

const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
}));

import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../application/ai-generation-observer';

describe('GenkitDocumentKnowledgeExtractor', () => {
  const originalGenkitModel = process.env.GENKIT_MODEL;

  afterEach(() => {
    if (originalGenkitModel === undefined) {
      delete process.env.GENKIT_MODEL;
    } else {
      process.env.GENKIT_MODEL = originalGenkitModel;
    }
  });

  it('does not initialize Genkit when imported or constructed', () => {
    new GenkitDocumentKnowledgeExtractor();

    expect(mockGenkit).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('initializes Genkit lazily on first extraction', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Cycle cardiaque',
            summary: 'Phases principales du cycle cardiaque.',
            sourceChunkIds: ['chunk-1'],
            difficulty: 'MEDIUM',
            displayOrder: 1,
            confidence: 0.8,
          },
        ],
      },
    });

    const extractor = new GenkitDocumentKnowledgeExtractor();

    const units = await extractor.extract({
      documentId: 'document-1',
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'Contenu du document.',
        },
      ],
    });

    expect(mockGenkit).toHaveBeenCalledTimes(1);
    const genkitCall = mockGenkit.mock.calls[0];
    if (!genkitCall) {
      throw new Error('Expected genkit to be called');
    }
    const [genkitInput] = genkitCall;
    expect(genkitInput.plugins).toHaveLength(1);
    expect(genkitInput.model).toBe('googleai/gemini-2.5-flash');
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const generateCall = mockGenerate.mock.calls[0];
    if (!generateCall) {
      throw new Error('Expected generate to be called');
    }
    const [generateInput] = generateCall;
    expect(generateInput.prompt).toContain('Contenu du document.');
    expect(generateInput.prompt).toContain('chunk-1');
    expect(generateInput.output.schema).toBeDefined();
    expect(units).toEqual([
      {
        title: 'Cycle cardiaque',
        summary: 'Phases principales du cycle cardiaque.',
        sourceChunkIds: ['chunk-1'],
        difficulty: 'MEDIUM',
        displayOrder: 1,
        confidence: 0.8,
        extractionPromptVersion: 'document-knowledge-v2',
        extractionSchemaVersion: 'extracted-knowledge-v2',
      },
    ]);
  });

  it('uses GENKIT_MODEL when configured', async () => {
    process.env.GENKIT_MODEL = 'googleai/custom-model';
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({ output: { units: [] } });

    const extractor = new GenkitDocumentKnowledgeExtractor();

    await extractor.extract({
      documentId: 'document-1',
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'Contenu du document.',
        },
      ],
    });

    expect(mockGenkit).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'googleai/custom-model' }),
    );
  });

  it('observes successful extractions without sending document text', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'SENTINEL_OUTPUT_TITLE',
            summary: 'SENTINEL_OUTPUT_SUMMARY',
            sourceChunkIds: ['chunk-1'],
          },
        ],
      },
    });
    const observer = createObserver();

    await new GenkitDocumentKnowledgeExtractor(observer).extract({
      documentId: 'document-1',
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'SENTINEL_FULL_CHUNK_TEXT',
        },
      ],
    });

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation.inputSize).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'documentKnowledgeExtraction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'document-knowledge-v2',
      schemaVersion: 'extracted-knowledge-v2',
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: 'success',
      documentId: 'document-1',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(observedPayload).not.toContain('SENTINEL_OUTPUT_TITLE');
    expect(observedPayload).not.toContain('SENTINEL_OUTPUT_SUMMARY');
  });

  it('rejects generated sources that do not match provided chunks', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: ['chunk-unknown'],
          },
        ],
      },
    });

    await expect(
      new GenkitDocumentKnowledgeExtractor().extract({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte source.' }],
      }),
    ).rejects.toThrow('Generated knowledge references unknown chunk');
  });

  it('rejects generated units without source chunk ids', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
          },
        ],
      },
    });

    await expect(
      new GenkitDocumentKnowledgeExtractor().extract({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte source.' }],
      }),
    ).rejects.toThrow();
  });

  it('rejects generated units with empty source chunk ids', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: [],
          },
        ],
      },
    });

    await expect(
      new GenkitDocumentKnowledgeExtractor().extract({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte source.' }],
      }),
    ).rejects.toThrow();
  });

  it('rejects generated confidence outside allowed bounds', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: ['chunk-1'],
            confidence: 1.2,
          },
        ],
      },
    });

    await expect(
      new GenkitDocumentKnowledgeExtractor().extract({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'Texte source.' }],
      }),
    ).rejects.toThrow();
  });

  it('limits chunk input sent to Genkit', async () => {
    const originalMaxChunks = process.env.DOCUMENT_KNOWLEDGE_MAX_CHUNKS;
    const originalMaxChars = process.env.DOCUMENT_KNOWLEDGE_MAX_CHARS;
    process.env.DOCUMENT_KNOWLEDGE_MAX_CHUNKS = '1';
    process.env.DOCUMENT_KNOWLEDGE_MAX_CHARS = '20';
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      output: {
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: ['chunk-1'],
          },
        ],
      },
    });

    try {
      await new GenkitDocumentKnowledgeExtractor().extract({
        documentId: 'document-1',
        chunks: [
          {
            id: 'chunk-1',
            index: 0,
            text: 'Premier chunk avec beaucoup de contenu.',
          },
          {
            id: 'chunk-2',
            index: 1,
            text: 'Deuxieme chunk qui ne doit pas etre envoye.',
          },
        ],
      });
    } finally {
      restoreEnv('DOCUMENT_KNOWLEDGE_MAX_CHUNKS', originalMaxChunks);
      restoreEnv('DOCUMENT_KNOWLEDGE_MAX_CHARS', originalMaxChars);
    }

    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    if (!generateInput) {
      throw new Error('Expected generate to be called');
    }
    expect(generateInput.prompt).toContain('chunk-1');
    expect(generateInput.prompt).not.toContain('chunk-2');
    expect(generateInput.prompt).not.toContain('Deuxieme chunk');
  });

  it('observes extraction errors without logging provider error messages', async () => {
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    mockGenerate.mockRejectedValue(
      new Error('SENTINEL_PROVIDER_ERROR_WITH_COURSE_TEXT'),
    );
    const observer = createObserver();

    await expect(
      new GenkitDocumentKnowledgeExtractor(observer).extract({
        documentId: 'document-1',
        chunks: [
          {
            id: 'chunk-1',
            index: 0,
            text: 'SENTINEL_FULL_CHUNK_TEXT',
          },
        ],
      }),
    ).rejects.toThrow('SENTINEL_PROVIDER_ERROR_WITH_COURSE_TEXT');

    const observation = getObservedObservation(observer);
    expect(observation.durationMs).toEqual(expect.any(Number));
    expect(observation).toEqual({
      flowName: 'documentKnowledgeExtraction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'document-knowledge-v2',
      schemaVersion: 'extracted-knowledge-v2',
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: 'error',
      errorCode: 'GENKIT_GENERATION_FAILED',
      documentId: 'document-1',
    });
    const observedPayload = JSON.stringify(observer.observe.mock.calls);
    expect(observedPayload).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(observedPayload).not.toContain(
      'SENTINEL_PROVIDER_ERROR_WITH_COURSE_TEXT',
    );
  });
});

type TestAiGenerationObserver = {
  observe: jest.Mock<void, [AiGenerationObservation]>;
} & AiGenerationObserver;

function createObserver(): TestAiGenerationObserver {
  return {
    observe: jest.fn(),
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
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
