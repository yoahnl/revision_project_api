import { NotFoundException } from '@nestjs/common';
import type { DocumentFileCleanupQueue } from '../../jobs/application/document-file-cleanup.queue';
import { DeleteDocumentUseCase } from './delete-document.use-case';
import type {
  DeleteDocumentResult,
  DocumentsRepository,
} from './documents.repository';

describe('DeleteDocumentUseCase', () => {
  function createUseCase(result: DeleteDocumentResult) {
    const deleteForStudent = jest.fn().mockResolvedValue(result);
    const repository = {
      deleteForStudent,
    } as unknown as DocumentsRepository;
    const cleanupQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } satisfies DocumentFileCleanupQueue;

    return {
      deleteForStudent,
      cleanupQueue,
      repository,
      useCase: new DeleteDocumentUseCase(repository, cleanupQueue),
    };
  }

  it('deletes a document owned by the student and enqueues cleanup after DB commit', async () => {
    const { deleteForStudent, cleanupQueue, useCase } = createUseCase({
      deleted: true,
      cleanupJobId: 'cleanup-1',
    });

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).resolves.toBeUndefined();

    expect(deleteForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(cleanupQueue.enqueue).toHaveBeenCalledWith({
      cleanupJobId: 'cleanup-1',
    });
  });

  it('throws 404 for unknown or cross-student documents', async () => {
    const { cleanupQueue, useCase } = createUseCase({
      deleted: false,
      cleanupJobId: null,
    });

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-2' }),
    ).rejects.toThrow(NotFoundException);
    expect(cleanupQueue.enqueue).not.toHaveBeenCalled();
  });

  it('does not enqueue when a delete reports no cleanup job', async () => {
    const { cleanupQueue, useCase } = createUseCase({
      deleted: true,
      cleanupJobId: null,
    });

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).resolves.toBeUndefined();

    expect(cleanupQueue.enqueue).not.toHaveBeenCalled();
  });
});
