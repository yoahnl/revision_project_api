import { StudentId } from '../../../shared/domain/student-id';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';

export type { DocumentKind, DocumentStatus };

export interface RevisionDocumentDto {
  id: string;
  studentId: StudentId;
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
}

export const DOCUMENTS_REPOSITORY = Symbol('DOCUMENTS_REPOSITORY');

export interface DocumentsRepository {
  create(input: {
    studentId: StudentId;
    subjectId: string;
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

  findById(documentId: string): Promise<RevisionDocumentDto | null>;

  markProcessing(documentId: string): Promise<void>;

  markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: Array<{ title: string; summary: string }>;
  }): Promise<void>;

  markFailed(input: { documentId: string; errorCode: string }): Promise<void>;
}
