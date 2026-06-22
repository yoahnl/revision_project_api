export const DOCUMENT_FILE_CLEANUP_REPOSITORY = Symbol(
  'DOCUMENT_FILE_CLEANUP_REPOSITORY',
);

export type DocumentFileCleanupJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface DocumentFileCleanupJobDto {
  id: string;
  documentId: string | null;
  studentId: string;
  storagePath: string;
  reason: string;
  status: DocumentFileCleanupJobStatus;
  attempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFileCleanupRepository {
  claimNextPending(input: {
    cleanupJobId?: string;
    maxAttempts: number;
  }): Promise<DocumentFileCleanupJobDto | null>;

  markCompleted(input: {
    cleanupJobId: string;
    completedAt?: Date;
  }): Promise<void>;

  markFailed(input: {
    cleanupJobId: string;
    error: unknown;
    maxAttempts: number;
  }): Promise<void>;
}
