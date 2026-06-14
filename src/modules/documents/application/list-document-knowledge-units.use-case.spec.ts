import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DocumentsRepository } from './documents.repository';
import { ListDocumentKnowledgeUnitsUseCase } from './list-document-knowledge-units.use-case';

describe('ListDocumentKnowledgeUnitsUseCase', () => {
  type FindKnowledgeUnitsByDocumentForStudent =
    DocumentsRepository['findKnowledgeUnitsByDocumentForStudent'];

  function createUseCase(
    response: Awaited<ReturnType<FindKnowledgeUnitsByDocumentForStudent>>,
  ) {
    const findKnowledgeUnitsByDocumentForStudent = jest
      .fn()
      .mockResolvedValue(response);
    const repository = {
      findKnowledgeUnitsByDocumentForStudent,
    } as unknown as DocumentsRepository;

    return {
      useCase: new ListDocumentKnowledgeUnitsUseCase(repository),
      findKnowledgeUnitsByDocumentForStudent,
    };
  }

  it('returns sourced knowledge units for ready documents', async () => {
    const { useCase, findKnowledgeUnitsByDocumentForStudent } = createUseCase({
      documentId: 'document-1',
      documentStatus: 'READY',
      items: [
        {
          id: 'unit-1',
          title: 'Constitution',
          summary: 'Norme fondamentale.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.8,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });

    const response = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(findKnowledgeUnitsByDocumentForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(response.items).toHaveLength(1);
  });

  it('throws 404 for missing or cross-student documents', async () => {
    const { useCase } = createUseCase(null);

    await expect(
      useCase.execute({
        studentId: 'student-2',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 409 for documents that are not ready', async () => {
    const { useCase } = createUseCase({
      documentId: 'document-1',
      documentStatus: 'PROCESSING',
      items: [],
    });

    await expect(
      useCase.execute({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
