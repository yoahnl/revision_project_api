import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RevisionSheetGenerator } from '../../ai/application/revision-sheet-generator';
import type { DocumentsRepository } from '../../documents/application/documents.repository';
import { GenerateRevisionSheetUseCase } from './generate-revision-sheet.use-case';
import { GetRevisionSheetUseCase } from './get-revision-sheet.use-case';
import { SaveRevisionSheetUseCase } from './save-revision-sheet.use-case';
import type { RevisionSheetDto } from './study-artifacts.repository';

describe('GenerateRevisionSheetUseCase', () => {
  const metadata = {
    flowName: 'documentRevisionSheetGeneration',
    provider: 'google-genai',
    model: 'googleai/gemini-2.5-flash',
    promptVersion: 'generate-revision-sheet-v1',
    schemaVersion: 'revision-sheet-v1',
    generatedAt: new Date('2026-06-14T10:00:00.000Z'),
    inputSize: 1024,
    sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS' as const,
  };

  const readySheet: RevisionSheetDto = {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche',
    introduction: 'Intro',
    keyPoints: ['Point clé'],
    commonMistakes: [],
    mustKnow: [],
    practiceSuggestions: [],
    metadata,
    errorCode: null,
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Section',
        content: 'Contenu',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Source',
            pageNumber: null,
            index: 0,
            relevanceScore: null,
          },
        ],
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
    } as jest.Mocked<RevisionSheetGenerator>;
    const getRevisionSheet = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetRevisionSheetUseCase>;
    const saveRevisionSheet = {
      saveReady: jest.fn(),
      saveFailed: jest.fn(),
    } as unknown as jest.Mocked<SaveRevisionSheetUseCase>;

    return {
      useCase: new GenerateRevisionSheetUseCase(
        documentsRepository,
        generator,
        getRevisionSheet,
        saveRevisionSheet,
      ),
      documentsRepository,
      generator,
      getRevisionSheet,
      saveRevisionSheet,
    };
  }

  it('returns an existing ready revision sheet without regenerating', async () => {
    const { useCase, getRevisionSheet, generator, saveRevisionSheet } =
      createUseCase();
    getRevisionSheet.execute.mockResolvedValue(readySheet);

    const sheet = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(sheet).toBe(readySheet);
    expect(generator.generate.mock.calls).toHaveLength(0);
    expect(saveRevisionSheet.saveReady.mock.calls).toHaveLength(0);
  });

  it('generates and persists a revision sheet when none is ready', async () => {
    const {
      useCase,
      documentsRepository,
      generator,
      getRevisionSheet,
      saveRevisionSheet,
    } = createUseCase();
    getRevisionSheet.execute
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(readySheet);
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
      title: 'Fiche',
      introduction: 'Intro',
      keyPoints: ['Point clé'],
      commonMistakes: ['Erreur'],
      mustKnow: ['Essentiel'],
      practiceSuggestions: ['Pratiquer'],
      metadata,
      sections: [
        {
          displayOrder: 0,
          title: 'Section',
          content: 'Contenu',
          sourceChunkIds: ['chunk-1'],
        },
      ],
    });
    saveRevisionSheet.saveReady.mockResolvedValue(readySheet);

    const sheet = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(saveRevisionSheet.saveReady.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          documentId: 'document-1',
          title: 'Fiche',
          introduction: 'Intro',
          keyPoints: ['Point clé'],
          commonMistakes: ['Erreur'],
          mustKnow: ['Essentiel'],
          practiceSuggestions: ['Pratiquer'],
          metadata,
          sections: [
            {
              displayOrder: 0,
              title: 'Section',
              content: 'Contenu',
              sources: [{ chunkId: 'chunk-1', relevanceScore: null }],
            },
          ],
        },
      ],
    ]);
    expect(sheet).toBe(readySheet);
  });

  it('rejects absent documents and documents that are not ready', async () => {
    const { useCase, getRevisionSheet, documentsRepository } = createUseCase();
    getRevisionSheet.execute.mockResolvedValue(null);
    documentsRepository.findByIdForStudent.mockResolvedValue(null);

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(NotFoundException);

    documentsRepository.findByIdForStudent.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'internal/path.pdf',
      mimeType: 'application/pdf',
      status: 'FAILED',
      errorCode: 'PDF_EMPTY',
    });

    await expect(
      useCase.execute({ studentId: 'student-1', documentId: 'document-1' }),
    ).rejects.toThrow(ConflictException);
  });
});
