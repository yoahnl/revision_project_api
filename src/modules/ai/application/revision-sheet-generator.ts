import type {
  DocumentArtifactChunk,
  DocumentArtifactKnowledgeUnit,
  GeneratedArtifactMetadata,
} from './document-summary-generator';

export const REVISION_SHEET_GENERATOR = Symbol('REVISION_SHEET_GENERATOR');

export const REVISION_SHEET_FLOW_NAME = 'documentRevisionSheetGeneration';
export const REVISION_SHEET_PROMPT_VERSION = 'generate-revision-sheet-v1';
export const REVISION_SHEET_SCHEMA_VERSION = 'revision-sheet-v1';

export type GeneratedRevisionSheetSection = {
  displayOrder: number;
  title: string;
  content: string;
  sourceChunkIds: string[];
};

export type GeneratedRevisionSheet = {
  title: string;
  introduction: string | null;
  sections: GeneratedRevisionSheetSection[];
  keyPoints: string[];
  commonMistakes: string[];
  mustKnow: string[];
  practiceSuggestions: string[];
  metadata: GeneratedArtifactMetadata;
};

export interface RevisionSheetGenerator {
  generate(input: {
    documentId: string;
    chunks: DocumentArtifactChunk[];
    knowledgeUnits: DocumentArtifactKnowledgeUnit[];
  }): Promise<GeneratedRevisionSheet>;
}
