import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { GenerateDocumentSummaryUseCase } from '../application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../application/get-revision-sheet.use-case';
import { StudyArtifactsController } from './study-artifacts.controller';

describe('StudyArtifactsController', () => {
  const student: AuthenticatedStudent = {
    id: 'student-1',
    firebaseUid: 'firebase-1',
    email: 'student@example.com',
    displayName: 'Student One',
  };

  const metadata = {
    flowName: 'documentSummaryGeneration',
    provider: 'google-genai',
    model: 'googleai/gemini-2.5-flash',
    promptVersion: 'generate-summary-v1',
    schemaVersion: 'summary-v1',
    generatedAt: new Date('2026-06-14T10:00:00.000Z'),
    inputSize: 1200,
    sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS' as const,
  };

  const readySummary = {
    id: 'summary-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY' as const,
    title: 'Résumé du cours',
    content: 'Texte synthétique.',
    keyPoints: ['Point clé'],
    limits: 'Ce résumé ne remplace pas le cours complet.',
    metadata,
    errorCode: null,
    sources: [
      {
        chunkId: 'chunk-1',
        text: 'Extrait issu du chunk.',
        pageNumber: null,
        index: 0,
        relevanceScore: 0.8,
      },
    ],
  };

  const readySheet = {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY' as const,
    title: 'Fiche de révision',
    introduction: "Vue d'ensemble.",
    keyPoints: ['À retenir'],
    commonMistakes: ['Piège classique'],
    mustKnow: ['Indispensable'],
    practiceSuggestions: ['Relire la section 1'],
    metadata: {
      ...metadata,
      flowName: 'documentRevisionSheetGeneration',
      promptVersion: 'generate-revision-sheet-v1',
      schemaVersion: 'revision-sheet-v1',
    },
    errorCode: null,
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Principe clé',
        content: 'Explication structurée.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait issu du chunk.',
            pageNumber: null,
            index: 0,
            relevanceScore: 0.9,
          },
        ],
      },
    ],
  };

  function createController() {
    const getSummary = {
      execute: jest.fn().mockResolvedValue(readySummary),
    } as unknown as jest.Mocked<GetDocumentSummaryUseCase>;
    const generateSummary = {
      execute: jest.fn().mockResolvedValue(readySummary),
    } as unknown as jest.Mocked<GenerateDocumentSummaryUseCase>;
    const getRevisionSheet = {
      execute: jest.fn().mockResolvedValue(readySheet),
    } as unknown as jest.Mocked<GetRevisionSheetUseCase>;
    const generateRevisionSheet = {
      execute: jest.fn().mockResolvedValue(readySheet),
    } as unknown as jest.Mocked<GenerateRevisionSheetUseCase>;

    return {
      controller: new StudyArtifactsController(
        getSummary,
        generateSummary,
        getRevisionSheet,
        generateRevisionSheet,
      ),
      getSummary,
      generateSummary,
      getRevisionSheet,
      generateRevisionSheet,
    };
  }

  it('gets a public summary without internal metadata or storage data', async () => {
    const { controller, getSummary } = createController();

    const summary = await controller.getSummary(student, ' document-1 ');

    expect(getSummary.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          documentId: 'document-1',
        },
      ],
    ]);
    expect(summary).toEqual({
      id: 'summary-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Résumé du cours',
      content: 'Texte synthétique.',
      keyPoints: ['Point clé'],
      limits: 'Ce résumé ne remplace pas le cours complet.',
      errorCode: null,
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'Extrait issu du chunk.',
          pageNumber: null,
          index: 0,
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain('provider');
    expect(JSON.stringify(summary)).not.toContain('promptVersion');
    expect(JSON.stringify(summary)).not.toContain('storagePath');
    expect(JSON.stringify(summary)).not.toContain('relevanceScore');
  });

  it('returns 404 when no summary exists', async () => {
    const { controller, getSummary } = createController();
    getSummary.execute.mockResolvedValue(null);

    await expect(controller.getSummary(student, 'document-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('generates a summary through the generation use case', async () => {
    const { controller, generateSummary } = createController();

    const summary = await controller.generateSummary(student, 'document-1');

    expect(generateSummary.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          documentId: 'document-1',
        },
      ],
    ]);
    expect(summary.id).toBe('summary-1');
  });

  it('gets a public revision sheet without internal metadata or storage data', async () => {
    const { controller, getRevisionSheet } = createController();

    const sheet = await controller.getRevisionSheet(student, ' document-1 ');

    expect(getRevisionSheet.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          documentId: 'document-1',
        },
      ],
    ]);
    expect(sheet).toEqual({
      id: 'sheet-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Fiche de révision',
      introduction: "Vue d'ensemble.",
      keyPoints: ['À retenir'],
      commonMistakes: ['Piège classique'],
      mustKnow: ['Indispensable'],
      practiceSuggestions: ['Relire la section 1'],
      errorCode: null,
      sections: [
        {
          id: 'section-1',
          displayOrder: 0,
          title: 'Principe clé',
          content: 'Explication structurée.',
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait issu du chunk.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(sheet)).not.toContain('provider');
    expect(JSON.stringify(sheet)).not.toContain('schemaVersion');
    expect(JSON.stringify(sheet)).not.toContain('storagePath');
    expect(JSON.stringify(sheet)).not.toContain('relevanceScore');
  });

  it('returns 404 when no revision sheet exists', async () => {
    const { controller, getRevisionSheet } = createController();
    getRevisionSheet.execute.mockResolvedValue(null);

    await expect(
      controller.getRevisionSheet(student, 'document-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('generates a revision sheet through the generation use case', async () => {
    const { controller, generateRevisionSheet } = createController();

    const sheet = await controller.generateRevisionSheet(student, 'document-1');

    expect(generateRevisionSheet.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          documentId: 'document-1',
        },
      ],
    ]);
    expect(sheet.id).toBe('sheet-1');
  });

  it('rejects blank document identifiers', async () => {
    const { controller } = createController();

    await expect(controller.getSummary(student, ' ')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.generateSummary(student, '')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.getRevisionSheet(student, ' ')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.generateRevisionSheet(student, '')).rejects.toThrow(
      BadRequestException,
    );
  });
});
