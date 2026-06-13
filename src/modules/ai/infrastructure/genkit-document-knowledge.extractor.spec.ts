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

const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
}));

import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';

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
          },
        ],
      },
    });

    const extractor = new GenkitDocumentKnowledgeExtractor();

    const units = await extractor.extract({
      documentId: 'document-1',
      fileName: 'cours.pdf',
      text: 'Contenu du document.',
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
    expect(generateInput.output.schema).toBeDefined();
    expect(units).toEqual([
      {
        title: 'Cycle cardiaque',
        summary: 'Phases principales du cycle cardiaque.',
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
      fileName: 'cours.pdf',
      text: 'Contenu du document.',
    });

    expect(mockGenkit).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'googleai/custom-model' }),
    );
  });
});
