import { DocumentProcessingQueue } from '../../jobs/application/document-processing.queue';
import { DocumentsRepository } from './documents.repository';
import { RegisterDocumentUseCase } from './register-document.use-case';

describe('RegisterDocumentUseCase', () => {
  it('registers a document and enqueues processing', async () => {
    const documentsRepository: DocumentsRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'document-1',
        subjectId: 'subject-1',
        studentId: 'student-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/cours.pdf',
        mimeType: 'application/pdf',
        status: 'UPLOADED',
      }),
      markProcessing: jest.fn(),
      markReadyWithKnowledgeUnits: jest.fn(),
      markFailed: jest.fn(),
      findBySubjectForStudent: jest.fn(),
      findByIdForStudent: jest.fn(),
      findById: jest.fn(),
    };
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const queue: DocumentProcessingQueue = { enqueue };

    const result = await new RegisterDocumentUseCase(
      documentsRepository,
      queue,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/student-1/cours.pdf',
      mimeType: 'application/pdf',
    });

    expect(result.id).toBe('document-1');
    expect(enqueue).toHaveBeenCalledWith({ documentId: 'document-1' });
  });
});
