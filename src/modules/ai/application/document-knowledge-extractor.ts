export interface ExtractedKnowledgeUnit {
  title: string;
  summary: string;
  sourceChunkIds: string[];
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder?: number;
  confidence?: number;
  extractionPromptVersion: string;
  extractionSchemaVersion: string;
}

export interface DocumentKnowledgeChunk {
  id: string;
  index: number;
  text: string;
}

export const DOCUMENT_KNOWLEDGE_PROMPT_VERSION = 'document-knowledge-v2';
export const DOCUMENT_KNOWLEDGE_SCHEMA_VERSION = 'extracted-knowledge-v2';

export const DOCUMENT_KNOWLEDGE_EXTRACTOR = Symbol(
  'DOCUMENT_KNOWLEDGE_EXTRACTOR',
);

export interface DocumentKnowledgeExtractor {
  extract(input: {
    documentId: string;
    chunks: DocumentKnowledgeChunk[];
  }): Promise<ExtractedKnowledgeUnit[]>;
}
