import type {
  ReadyRevisionSheetInput,
  ReadySummaryInput,
  StudyArtifactsRepository,
} from './study-artifacts.repository';
import { GetDocumentSummaryUseCase } from './get-document-summary.use-case';
import { GetRevisionSheetUseCase } from './get-revision-sheet.use-case';
import { SaveDocumentSummaryUseCase } from './save-document-summary.use-case';
import { SaveRevisionSheetUseCase } from './save-revision-sheet.use-case';

describe('study artifact use cases', () => {
  function createRepository(): jest.Mocked<StudyArtifactsRepository> {
    return {
      findSummaryByDocumentForStudent: jest.fn(),
      saveReadySummary: jest.fn(),
      saveFailedSummary: jest.fn(),
      findRevisionSheetByDocumentForStudent: jest.fn(),
      saveReadyRevisionSheet: jest.fn(),
      saveFailedRevisionSheet: jest.fn(),
    };
  }

  const metadata = {
    flowName: 'generateSummaryFlow',
    provider: 'google-genai',
    model: 'googleai/gemini-2.5-flash',
    promptVersion: 'generate-summary-v1',
    schemaVersion: 'summary-v1',
    generatedAt: new Date('2026-06-14T10:00:00.000Z'),
    inputSize: 1024,
    sourceStrategy: 'DOCUMENT_CHUNKS' as const,
  };

  it('gets a document summary through the repository', async () => {
    const repository = createRepository();
    repository.findSummaryByDocumentForStudent.mockResolvedValue({
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
      sources: [],
    });
    const useCase = new GetDocumentSummaryUseCase(repository);

    const summary = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(repository.findSummaryByDocumentForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(summary?.id).toBe('summary-1');
  });

  it('saves a ready summary through the repository', async () => {
    const repository = createRepository();
    const input: ReadySummaryInput = {
      studentId: 'student-1',
      documentId: 'document-1',
      title: 'Résumé',
      content: 'Contenu',
      keyPoints: ['Point clé'],
      limits: null,
      metadata,
      sources: [{ chunkId: 'chunk-1', relevanceScore: 0.9 }],
    };
    repository.saveReadySummary.mockResolvedValue({
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
      sources: [],
    });
    const useCase = new SaveDocumentSummaryUseCase(repository);

    await useCase.saveReady(input);

    expect(repository.saveReadySummary).toHaveBeenCalledWith(input);
  });

  it('saves a failed summary through the repository', async () => {
    const repository = createRepository();
    const useCase = new SaveDocumentSummaryUseCase(repository);

    await useCase.saveFailed({
      studentId: 'student-1',
      documentId: 'document-1',
      metadata,
      errorCode: 'SUMMARY_GENERATION_FAILED',
    });

    expect(repository.saveFailedSummary).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
      metadata,
      errorCode: 'SUMMARY_GENERATION_FAILED',
    });
  });

  it('gets a revision sheet through the repository', async () => {
    const repository = createRepository();
    repository.findRevisionSheetByDocumentForStudent.mockResolvedValue({
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
      sections: [],
    });
    const useCase = new GetRevisionSheetUseCase(repository);

    const sheet = await useCase.execute({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(
      repository.findRevisionSheetByDocumentForStudent,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(sheet?.id).toBe('sheet-1');
  });

  it('saves a ready revision sheet through the repository', async () => {
    const repository = createRepository();
    const input: ReadyRevisionSheetInput = {
      studentId: 'student-1',
      documentId: 'document-1',
      title: 'Fiche',
      introduction: 'Intro',
      keyPoints: ['Point clé'],
      commonMistakes: ['Erreur classique'],
      mustKnow: ['À connaître'],
      practiceSuggestions: ['S’entraîner'],
      metadata,
      sections: [
        {
          displayOrder: 0,
          title: 'Section',
          content: 'Contenu',
          sources: [{ chunkId: 'chunk-1', relevanceScore: 0.8 }],
        },
      ],
    };
    repository.saveReadyRevisionSheet.mockResolvedValue({
      id: 'sheet-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Fiche',
      introduction: 'Intro',
      keyPoints: ['Point clé'],
      commonMistakes: ['Erreur classique'],
      mustKnow: ['À connaître'],
      practiceSuggestions: ['S’entraîner'],
      metadata,
      errorCode: null,
      sections: [],
    });
    const useCase = new SaveRevisionSheetUseCase(repository);

    await useCase.saveReady(input);

    expect(repository.saveReadyRevisionSheet).toHaveBeenCalledWith(input);
  });

  it('saves a failed revision sheet through the repository', async () => {
    const repository = createRepository();
    const useCase = new SaveRevisionSheetUseCase(repository);

    await useCase.saveFailed({
      studentId: 'student-1',
      documentId: 'document-1',
      metadata,
      errorCode: 'REVISION_SHEET_GENERATION_FAILED',
    });

    expect(repository.saveFailedRevisionSheet).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
      metadata,
      errorCode: 'REVISION_SHEET_GENERATION_FAILED',
    });
  });
});
