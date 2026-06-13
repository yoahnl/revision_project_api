export interface ExtractedKnowledgeUnit {
  title: string;
  summary: string;
  sourceExcerpt?: string;
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const DOCUMENT_KNOWLEDGE_EXTRACTOR = Symbol(
  'DOCUMENT_KNOWLEDGE_EXTRACTOR',
);

export interface DocumentKnowledgeExtractor {
  extract(input: {
    documentId: string;
    fileName: string;
    text: string;
  }): Promise<ExtractedKnowledgeUnit[]>;
}
