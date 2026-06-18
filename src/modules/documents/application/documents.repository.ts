import { StudentId } from '../../../shared/domain/student-id';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';

export type { DocumentKind, DocumentStatus };

export interface RevisionDocumentDto {
  id: string;
  studentId: StudentId;
  subjectId: string;
  courseId: string | null;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRevisionDocumentDto {
  id: string;
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
}

export type KnowledgeUnitDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KnowledgeUnitPersistenceInput {
  title: string;
  summary: string;
  difficulty?: KnowledgeUnitDifficulty | null;
  displayOrder?: number | null;
  confidence?: number | null;
  extractionPromptVersion?: string | null;
  extractionSchemaVersion?: string | null;
  sourceChunkIds?: string[] | null;
}

export interface DocumentChunkPersistenceInput {
  index: number;
  text: string;
  charStart?: number | null;
  charEnd?: number | null;
  pageNumber?: number | null;
}

export interface RevisionDocumentChunkDto {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
  createdAt: Date;
}

export interface KnowledgeUnitSourcePersistenceInput {
  chunkId: string;
  relevanceScore?: number | null;
}

export interface DocumentKnowledgeUnitSourceDto {
  chunkId: string;
  text: string;
  pageNumber: number | null;
  index: number;
}

export interface DocumentKnowledgeUnitDto {
  id: string;
  title: string;
  summary: string;
  difficulty: KnowledgeUnitDifficulty | null;
  displayOrder: number | null;
  confidence: number | null;
  sources: DocumentKnowledgeUnitSourceDto[];
}

export interface DocumentKnowledgeUnitsDto {
  documentId: string;
  documentStatus: DocumentStatus;
  items: DocumentKnowledgeUnitDto[];
}

export const DOCUMENTS_REPOSITORY = Symbol('DOCUMENTS_REPOSITORY');

export interface DocumentsRepository {
  create(input: {
    studentId: StudentId;
    subjectId: string;
    courseId?: string | null;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto>;

  findBySubjectForStudent(input: {
    studentId: StudentId;
    subjectId: string;
  }): Promise<RevisionDocumentDto[]>;

  findByIdForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<RevisionDocumentDto | null>;

  deleteForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<boolean>;

  deleteCourseDocumentForStudent(input: {
    studentId: StudentId;
    courseId: string;
    documentId: string;
  }): Promise<boolean>;

  findById(documentId: string): Promise<RevisionDocumentDto | null>;

  markProcessing(documentId: string): Promise<void>;

  markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: KnowledgeUnitPersistenceInput[];
  }): Promise<void>;

  replaceChunks(input: {
    documentId: string;
    chunks: DocumentChunkPersistenceInput[];
  }): Promise<void>;

  findChunksByDocumentId(
    documentId: string,
  ): Promise<RevisionDocumentChunkDto[]>;

  findKnowledgeUnitsByDocumentForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<DocumentKnowledgeUnitsDto | null>;

  replaceKnowledgeUnitSources(input: {
    knowledgeUnitId: string;
    subjectId: string;
    sources: KnowledgeUnitSourcePersistenceInput[];
  }): Promise<void>;

  markFailed(input: { documentId: string; errorCode: string }): Promise<void>;
}
