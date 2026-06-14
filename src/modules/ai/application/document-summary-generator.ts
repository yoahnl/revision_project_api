import type { StudyArtifactSourceStrategy } from '../../study-artifacts/application/study-artifacts.repository';

export const DOCUMENT_SUMMARY_GENERATOR = Symbol('DOCUMENT_SUMMARY_GENERATOR');

export const DOCUMENT_SUMMARY_FLOW_NAME = 'documentSummaryGeneration';
export const DOCUMENT_SUMMARY_PROMPT_VERSION = 'generate-summary-v1';
export const DOCUMENT_SUMMARY_SCHEMA_VERSION = 'summary-v1';

export type DocumentArtifactChunk = {
  id: string;
  index: number;
  text: string;
  pageNumber: number | null;
};

export type DocumentArtifactKnowledgeUnit = {
  id: string;
  title: string;
  summary: string;
  sourceChunkIds: string[];
};

export type GeneratedArtifactMetadata = {
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: Date;
  inputSize: number;
  sourceStrategy: StudyArtifactSourceStrategy;
};

export type GeneratedDocumentSummary = {
  title: string;
  content: string;
  keyPoints: string[];
  limits: string | null;
  sourceChunkIds: string[];
  metadata: GeneratedArtifactMetadata;
};

export interface DocumentSummaryGenerator {
  generate(input: {
    documentId: string;
    chunks: DocumentArtifactChunk[];
    knowledgeUnits: DocumentArtifactKnowledgeUnit[];
  }): Promise<GeneratedDocumentSummary>;
}
