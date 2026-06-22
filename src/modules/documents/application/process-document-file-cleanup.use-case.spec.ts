import type { DocumentFileStorage } from './document-file-storage';
import type { DocumentFileCleanupRepository } from './document-file-cleanup.repository';
import {
  ProcessDocumentFileCleanupJobUseCase,
  ProcessPendingDocumentFileCleanupJobsUseCase,
} from './process-document-file-cleanup.use-case';

describe('ProcessDocumentFileCleanupJobUseCase', () => {
  it('deletes the stored file through the storage port and marks the job completed', async () => {
    const { cleanupRepository, storage, useCase } = createUseCase();
    cleanupRepository.claimNextPending.mockResolvedValue(cleanupJob());

    await expect(
      useCase.execute({ cleanupJobId: 'cleanup-1' }),
    ).resolves.toEqual({
      processed: true,
      cleanupJobId: 'cleanup-1',
    });

    expect(cleanupRepository.claimNextPending).toHaveBeenCalledWith({
      cleanupJobId: 'cleanup-1',
      maxAttempts: 3,
    });
    expect(storage.delete).toHaveBeenCalledWith({
      storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    });
    expect(cleanupRepository.markCompleted).toHaveBeenCalledWith({
      cleanupJobId: 'cleanup-1',
    });
    expect(cleanupRepository.markFailed).not.toHaveBeenCalled();
  });

  it('ignores completed or already-claimed jobs', async () => {
    const { cleanupRepository, storage, useCase } = createUseCase();
    cleanupRepository.claimNextPending.mockResolvedValue(null);

    await expect(
      useCase.execute({ cleanupJobId: 'cleanup-1' }),
    ).resolves.toEqual({
      processed: false,
      cleanupJobId: 'cleanup-1',
    });

    expect(storage.delete).not.toHaveBeenCalled();
    expect(cleanupRepository.markCompleted).not.toHaveBeenCalled();
    expect(cleanupRepository.markFailed).not.toHaveBeenCalled();
  });

  it('records storage failures without hiding the failed processing result', async () => {
    const { cleanupRepository, storage, useCase } = createUseCase();
    const failure = new Error('disk is read-only');
    cleanupRepository.claimNextPending.mockResolvedValue(cleanupJob());
    storage.delete.mockRejectedValue(failure);

    await expect(
      useCase.execute({ cleanupJobId: 'cleanup-1' }),
    ).rejects.toThrow('disk is read-only');

    expect(cleanupRepository.markFailed).toHaveBeenCalledWith({
      cleanupJobId: 'cleanup-1',
      error: failure,
      maxAttempts: 3,
    });
    expect(cleanupRepository.markCompleted).not.toHaveBeenCalled();
  });
});

describe('ProcessPendingDocumentFileCleanupJobsUseCase', () => {
  it('processes a bounded batch of pending jobs', async () => {
    const first = createUseCase();
    first.cleanupRepository.claimNextPending
      .mockResolvedValueOnce(cleanupJob({ id: 'cleanup-1' }))
      .mockResolvedValueOnce(cleanupJob({ id: 'cleanup-2' }))
      .mockResolvedValueOnce(null);

    const batchUseCase = new ProcessPendingDocumentFileCleanupJobsUseCase(
      first.useCase,
    );

    await expect(batchUseCase.execute({ limit: 5 })).resolves.toEqual({
      processed: 2,
    });

    expect(first.storage.delete).toHaveBeenCalledTimes(2);
    expect(first.cleanupRepository.markCompleted).toHaveBeenNthCalledWith(1, {
      cleanupJobId: 'cleanup-1',
    });
    expect(first.cleanupRepository.markCompleted).toHaveBeenNthCalledWith(2, {
      cleanupJobId: 'cleanup-2',
    });
  });
});

function createUseCase() {
  const cleanupRepository = {
    claimNextPending: jest.fn(),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  } satisfies {
    [K in keyof DocumentFileCleanupRepository]: jest.Mock;
  };
  const storage = {
    delete: jest.fn().mockResolvedValue(undefined),
  } satisfies Pick<DocumentFileStorage, 'delete'>;

  return {
    cleanupRepository,
    storage,
    useCase: new ProcessDocumentFileCleanupJobUseCase(
      cleanupRepository,
      storage,
    ),
  };
}

function cleanupJob(input: Partial<ReturnType<typeof cleanupJobBase>> = {}) {
  return {
    ...cleanupJobBase(),
    ...input,
  };
}

function cleanupJobBase() {
  return {
    id: 'cleanup-1',
    documentId: 'document-1',
    studentId: 'student-1',
    storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    reason: 'DOCUMENT_SAFE_DELETE',
    status: 'RUNNING' as const,
    attempts: 0,
    lastError: null,
    lockedAt: new Date('2026-06-22T10:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-06-22T09:00:00.000Z'),
    updatedAt: new Date('2026-06-22T10:00:00.000Z'),
  };
}
