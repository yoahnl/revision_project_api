import { NotFoundException } from '@nestjs/common';
import { DeleteDocumentUseCase } from './delete-document.use-case';
import type { DocumentsRepository } from './documents.repository';

describe('DeleteDocumentUseCase', () => {
  function createUseCase(deleted: boolean) {
    const deleteForStudent = jest.fn().mockResolvedValue(deleted);
    const repository = {
      deleteForStudent,
    } as unknown as DocumentsRepository;

    return {
      deleteForStudent,
      repository,
      useCase: new DeleteDocumentUseCase(repository),
    };
  }

  it('deletes a document owned by the student', async () => {
    const { deleteForStudent, useCase } = createUseCase(true);

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).resolves.toBeUndefined();

    expect(deleteForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('throws 404 for unknown or cross-student documents', async () => {
    const { useCase } = createUseCase(false);

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-2' }),
    ).rejects.toThrow(NotFoundException);
  });
});
