import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { DocumentSummaryGenerator } from '../../ai/application/document-summary-generator';
import type { DocumentsRepository } from '../../documents/application/documents.repository';
import { GenerateDocumentSummaryUseCase } from './generate-document-summary.use-case';
import { GetDocumentSummaryUseCase } from './get-document-summary.use-case';
import { SaveDocumentSummaryUseCase } from './save-document-summary.use-case';
import type { SummaryDto } from './study-artifacts.repository';

describe('GenerateDocumentSummaryUseCase', () => {
  const metadata = {
    flowName: 'documentSummaryGeneration',
    provider: 'google-genai',
    model: 'googleai/gemini-2.5-flash',
    promptVersion: 'generate-summary-v1',
    schemaVersion: 'summary-v1',
    generatedAt: new Date('2026-06-14T10:00:00.000Z'),
    inputSize: 1024,
    sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS' as const,
  };

  const readySummary: SummaryDto = {
    id: 'summary-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Résumé',
    content: 'Contenu',
    keyPoints: ['Point clé'],
    limits: null,
    metadata,
    errorCode: null,
    sources: [
      {
        chunkId: 'chunk-1',
        text: 'Source',
        pageNumber: null,
        index: 0,
        relevanceScore: null,
      },
    ],
  };

  function createUseCase() {
    const documentsRepository = {
      findByIdForStudent: jest.fn(),
      findChunksByDocumentId: jest.fn(),
      findKnowledgeUnitsByDocumentForStudent: jest.fn(),
    } as unknown as jest.Mocked<DocumentsRepository>;
    const generator = {
      generate: jest.fn(),
    } as jest.Mocked<DocumentSummaryGenerator>;
    const getSummary = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetDocumentSummaryUseCase>;
    const saveSummary = {
      saveReady: jest.fn(),
      saveFailed: jest.fn(),
    } as unknown as jest.Mocked<SaveDocumentSummaryUseCase>;

    return {
      useCase: new GenerateDocumentSummaryUseCase(
        documentsRepository,
        generator,
        getSummary,
        saveSummary,
      ),
      documentsRepository,
      generator,
      getSummary,
      saveSummary,
    };
  }

  it('returns an existing ready summary without regenerating', async () => {
    const { useCase, getSummary, generator, saveSummary } = createUseCase();
    getSummary.execute.mockResolvedValue(readySummary);

    const summary = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(summary).toBe(readySummary);
    expect(generator.generate.mock.calls).toHaveLength(0);
    expect(saveSummary.saveReady.mock.calls).toHaveLength(0);
  });

  it('generates and persists a summary when none is ready', async () => {
    const { useCase, documentsRepository, generator, getSummary, saveSummary } =
      createUseCase();
    getSummary.execute
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(readySummary);
    documentsRepository.findByIdForStudent.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'internal/path.pdf',
      mimeType: 'application/pdf',
      status: 'READY',
      errorCode: null,
    });
    documentsRepository.findChunksByDocumentId.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Texte source.',
        charStart: null,
        charEnd: null,
        pageNumber: null,
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
      },
    ]);
    documentsRepository.findKnowledgeUnitsByDocumentForStudent.mockResolvedValue(
      {
        documentId: 'document-1',
        documentStatus: 'READY',
        items: [
          {
            id: 'unit-1',
            title: 'Séparation des pouvoirs',
            summary: 'Résumé de notion',
            difficulty: 'MEDIUM',
            displayOrder: 0,
            confidence: 0.8,
            sources: [
              {
                chunkId: 'chunk-1',
                text: 'Texte source.',
                pageNumber: null,
                index: 0,
              },
            ],
          },
        ],
      },
    );
    generator.generate.mockResolvedValue({
      title: 'Résumé',
      content: 'Contenu',
      keyPoints: ['Point clé'],
      limits: null,
      sourceChunkIds: ['chunk-1'],
      metadata,
    });
    saveSummary.saveReady.mockResolvedValue(readySummary);

    const summary = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(generator.generate.mock.calls).toEqual([
      [
        {
          documentId: 'document-1',
          chunks: [
            {
              id: 'chunk-1',
              index: 0,
              text: 'Texte source.',
              pageNumber: null,
            },
          ],
          knowledgeUnits: [
            {
              id: 'unit-1',
              title: 'Séparation des pouvoirs',
              summary: 'Résumé de notion',
              sourceChunkIds: ['chunk-1'],
            },
          ],
        },
      ],
    ]);
    expect(saveSummary.saveReady.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          documentId: 'document-1',
          title: 'Résumé',
          content: 'Contenu',
          keyPoints: ['Point clé'],
          limits: null,
          metadata,
          sources: [{ chunkId: 'chunk-1', relevanceScore: null }],
        },
      ],
    ]);
    expect(summary).toBe(readySummary);
    expect(JSON.stringify(saveSummary.saveReady.mock.calls)).not.toContain(
      'internal/path.pdf',
    );
  });

  it('rejects absent documents', async () => {
    const { useCase, getSummary, documentsRepository } = createUseCase();
    getSummary.execute.mockResolvedValue(null);
    documentsRepository.findByIdForStudent.mockResolvedValue(null);

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects documents that are not ready', async () => {
    const { useCase, getSummary, documentsRepository } = createUseCase();
    getSummary.execute.mockResolvedValue(null);
    documentsRepository.findByIdForStudent.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'internal/path.pdf',
      mimeType: 'application/pdf',
      status: 'PROCESSING',
      errorCode: null,
    });

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects missing chunks or sourced knowledge units', async () => {
    const { useCase, getSummary, documentsRepository } = createUseCase();
    getSummary.execute.mockResolvedValue(null);
    documentsRepository.findByIdForStudent.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'internal/path.pdf',
      mimeType: 'application/pdf',
      status: 'READY',
      errorCode: null,
    });
    documentsRepository.findChunksByDocumentId.mockResolvedValue([]);

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(ConflictException);

    documentsRepository.findChunksByDocumentId.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Texte source.',
        charStart: null,
        charEnd: null,
        pageNumber: null,
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
      },
    ]);
    documentsRepository.findKnowledgeUnitsByDocumentForStudent.mockResolvedValue(
      {
        documentId: 'document-1',
        documentStatus: 'READY',
        items: [],
      },
    );

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('maps invalid generated sources to an unprocessable response', async () => {
    const { useCase, getSummary, documentsRepository, generator } =
      createUseCase();
    getSummary.execute.mockResolvedValue(null);
    documentsRepository.findByIdForStudent.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'internal/path.pdf',
      mimeType: 'application/pdf',
      status: 'READY',
      errorCode: null,
    });
    documentsRepository.findChunksByDocumentId.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Texte source.',
        charStart: null,
        charEnd: null,
        pageNumber: null,
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
      },
    ]);
    documentsRepository.findKnowledgeUnitsByDocumentForStudent.mockResolvedValue(
      {
        documentId: 'document-1',
        documentStatus: 'READY',
        items: [
          {
            id: 'unit-1',
            title: 'Notion',
            summary: 'Résumé',
            difficulty: null,
            displayOrder: null,
            confidence: null,
            sources: [
              {
                chunkId: 'chunk-1',
                text: 'Texte source.',
                pageNumber: null,
                index: 0,
              },
            ],
          },
        ],
      },
    );
    generator.generate.mockRejectedValue(new Error('SUMMARY_SOURCE_INVALID'));

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('maps provider failures to a bad gateway response', async () => {
    const { useCase, getSummary, documentsRepository, generator } =
      createUseCase();
    getSummary.execute.mockResolvedValue(null);
    documentsRepository.findByIdForStudent.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'internal/path.pdf',
      mimeType: 'application/pdf',
      status: 'READY',
      errorCode: null,
    });
    documentsRepository.findChunksByDocumentId.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Texte source.',
        charStart: null,
        charEnd: null,
        pageNumber: null,
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
      },
    ]);
    documentsRepository.findKnowledgeUnitsByDocumentForStudent.mockResolvedValue(
      {
        documentId: 'document-1',
        documentStatus: 'READY',
        items: [
          {
            id: 'unit-1',
            title: 'Notion',
            summary: 'Résumé',
            difficulty: null,
            displayOrder: null,
            confidence: null,
            sources: [
              {
                chunkId: 'chunk-1',
                text: 'Texte source.',
                pageNumber: null,
                index: 0,
              },
            ],
          },
        ],
      },
    );
    generator.generate.mockRejectedValue(new Error('provider down'));

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(BadGatewayException);
  });
});
