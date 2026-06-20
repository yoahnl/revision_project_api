import type {
  DocumentKnowledgeChunk,
  DocumentKnowledgeExtractor,
  ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';

export class FallbackDocumentKnowledgeExtractor implements DocumentKnowledgeExtractor {
  constructor(private readonly extractors: DocumentKnowledgeExtractor[]) {
    if (extractors.length === 0) {
      throw new Error('At least one document knowledge extractor is required');
    }
  }

  async extract(input: {
    documentId: string;
    chunks: DocumentKnowledgeChunk[];
  }): Promise<ExtractedKnowledgeUnit[]> {
    let lastError: unknown;

    for (const extractor of this.extractors) {
      try {
        return await extractor.extract(input);
      } catch (error) {
        // Each concrete extractor already records provider/model/error details.
        // The wrapper only controls failover so a transient stream close on one
        // OpenAI-compatible provider does not fail the whole document pipeline.
        lastError = error;
      }
    }

    throw lastError;
  }
}
