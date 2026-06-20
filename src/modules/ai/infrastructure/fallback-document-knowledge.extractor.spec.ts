import type {
  DocumentKnowledgeExtractor,
  ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';
import { FallbackDocumentKnowledgeExtractor } from './fallback-document-knowledge.extractor';

describe('FallbackDocumentKnowledgeExtractor', () => {
  const units: ExtractedKnowledgeUnit[] = [
    {
      title: 'Unit',
      summary: 'Summary',
      sourceChunkIds: ['chunk-1'],
      extractionPromptVersion: 'document-knowledge-v2',
      extractionSchemaVersion: 'extracted-knowledge-v2',
    },
  ];

  it('uses the first successful extractor after a provider failure', async () => {
    const primaryExtract = jest
      .fn()
      .mockRejectedValue(new Error('stream closed'));
    const fallbackExtract = jest.fn().mockResolvedValue(units);
    const primary = fakeExtractor(primaryExtract);
    const fallback = fakeExtractor(fallbackExtract);

    await expect(
      new FallbackDocumentKnowledgeExtractor([primary, fallback]).extract({
        documentId: 'document-1',
        chunks: [{ id: 'chunk-1', index: 0, text: 'content' }],
      }),
    ).resolves.toEqual(units);

    expect(primaryExtract).toHaveBeenCalledTimes(1);
    expect(fallbackExtract).toHaveBeenCalledTimes(1);
  });

  it('does not call fallback extractors when the primary succeeds', async () => {
    const primaryExtract = jest.fn().mockResolvedValue(units);
    const fallbackExtract = jest.fn().mockResolvedValue([]);
    const primary = fakeExtractor(primaryExtract);
    const fallback = fakeExtractor(fallbackExtract);

    await new FallbackDocumentKnowledgeExtractor([primary, fallback]).extract({
      documentId: 'document-1',
      chunks: [{ id: 'chunk-1', index: 0, text: 'content' }],
    });

    expect(primaryExtract).toHaveBeenCalledTimes(1);
    expect(fallbackExtract).not.toHaveBeenCalled();
  });
});

function fakeExtractor(
  extract: jest.MockedFunction<DocumentKnowledgeExtractor['extract']>,
): DocumentKnowledgeExtractor {
  return { extract };
}
