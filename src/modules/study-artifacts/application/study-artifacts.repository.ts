export const STUDY_ARTIFACTS_REPOSITORY = Symbol('StudyArtifactsRepository');

export type StudyArtifactStatus = 'READY' | 'FAILED';

export type StudyArtifactSourceStrategy =
  | 'DOCUMENT_CHUNKS'
  | 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS';

export type StudyArtifactMetadata = {
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: Date;
  inputSize?: number | null;
  sourceStrategy: StudyArtifactSourceStrategy;
};

export type StudyArtifactSourceInput = {
  chunkId: string;
  relevanceScore?: number | null;
};

export type StudyArtifactSourceDto = {
  chunkId: string;
  text: string;
  pageNumber: number | null;
  index: number;
  relevanceScore: number | null;
};

export type SummaryDto = {
  id: string;
  documentId: string;
  subjectId: string;
  status: StudyArtifactStatus;
  title: string | null;
  content: string | null;
  keyPoints: string[];
  limits: string | null;
  metadata: StudyArtifactMetadata;
  errorCode: string | null;
  sources: StudyArtifactSourceDto[];
};

export type ReadySummaryInput = {
  studentId: string;
  documentId: string;
  title: string;
  content: string;
  keyPoints: string[];
  limits: string | null;
  metadata: StudyArtifactMetadata;
  sources: StudyArtifactSourceInput[];
};

export type FailedSummaryInput = {
  studentId: string;
  documentId: string;
  metadata: StudyArtifactMetadata;
  errorCode: string;
};

export type RevisionSheetSectionInput = {
  displayOrder: number;
  title: string;
  content: string;
  sources: StudyArtifactSourceInput[];
};

export type RevisionSheetSectionDto = {
  id: string;
  displayOrder: number;
  title: string;
  content: string;
  sources: StudyArtifactSourceDto[];
};

export type RevisionSheetDto = {
  id: string;
  documentId: string;
  subjectId: string;
  status: StudyArtifactStatus;
  title: string | null;
  introduction: string | null;
  keyPoints: string[];
  commonMistakes: string[];
  mustKnow: string[];
  practiceSuggestions: string[];
  metadata: StudyArtifactMetadata;
  errorCode: string | null;
  sections: RevisionSheetSectionDto[];
};

export type ReadyRevisionSheetInput = {
  studentId: string;
  documentId: string;
  title: string;
  introduction: string | null;
  keyPoints: string[];
  commonMistakes: string[];
  mustKnow: string[];
  practiceSuggestions: string[];
  metadata: StudyArtifactMetadata;
  sections: RevisionSheetSectionInput[];
};

export type FailedRevisionSheetInput = {
  studentId: string;
  documentId: string;
  metadata: StudyArtifactMetadata;
  errorCode: string;
};

export type DocumentArtifactLookupInput = {
  studentId: string;
  documentId: string;
};

export interface StudyArtifactsRepository {
  findSummaryByDocumentForStudent(
    this: void,
    input: DocumentArtifactLookupInput,
  ): Promise<SummaryDto | null>;

  saveReadySummary(this: void, input: ReadySummaryInput): Promise<SummaryDto>;

  saveFailedSummary(this: void, input: FailedSummaryInput): Promise<SummaryDto>;

  findRevisionSheetByDocumentForStudent(
    this: void,
    input: DocumentArtifactLookupInput,
  ): Promise<RevisionSheetDto | null>;

  saveReadyRevisionSheet(
    this: void,
    input: ReadyRevisionSheetInput,
  ): Promise<RevisionSheetDto>;

  saveFailedRevisionSheet(
    this: void,
    input: FailedRevisionSheetInput,
  ): Promise<RevisionSheetDto>;
}
