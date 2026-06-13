import { DocumentProcessingQueue } from '../../jobs/application/document-processing.queue';
import {
  type DocumentFileStorage,
  type StoredDocumentFile,
} from './document-file-storage';
import { DocumentsRepository } from './documents.repository';
import { UploadCoursePdfUseCase } from './upload-course-pdf.use-case';

describe('UploadCoursePdfUseCase', () => {
  it('stores the PDF, creates a document, and enqueues processing', async () => {
    const stored: StoredDocumentFile = {
      fileName: '1710000000000-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-1/1710000000000-cours.pdf',
      mimeType: 'application/pdf',
    };
    const storage = createStorage(stored);
    const documentsRepository = createDocumentsRepository();
    const queue = createQueue();

    const result = await new UploadCoursePdfUseCase(
      storage.service,
      documentsRepository.service,
      queue.service,
    ).execute({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      subjectId: 'subject-1',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });

    expect(result.id).toBe('document-1');
    expect(storage.saveCoursePdf).toHaveBeenCalledWith({
      firebaseUid: 'firebase-1',
      subjectId: 'subject-1',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
    expect(documentsRepository.create).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: stored.fileName,
      storagePath: stored.storagePath,
      mimeType: 'application/pdf',
    });
    expect(queue.enqueue).toHaveBeenCalledWith({ documentId: 'document-1' });
  });

  it('deletes the stored file if document registration fails', async () => {
    const stored: StoredDocumentFile = {
      fileName: '1710000000000-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-2/1710000000000-cours.pdf',
      mimeType: 'application/pdf',
    };
    const storage = createStorage(stored);
    const documentsRepository = createDocumentsRepository({
      create: jest
        .fn()
        .mockRejectedValue(new Error('Subject does not belong to student')),
    });
    const queue = createQueue();

    await expect(
      new UploadCoursePdfUseCase(
        storage.service,
        documentsRepository.service,
        queue.service,
      ).execute({
        studentId: 'student-1',
        firebaseUid: 'firebase-1',
        subjectId: 'subject-2',
        originalFileName: 'cours.pdf',
        content: Buffer.from('%PDF-1.7'),
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(storage.deleteFile).toHaveBeenCalledWith({
      storagePath: stored.storagePath,
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});

function createStorage(stored: StoredDocumentFile): {
  service: DocumentFileStorage;
  saveCoursePdf: jest.Mock;
  deleteFile: jest.Mock;
} {
  const saveCoursePdf = jest.fn().mockResolvedValue(stored);
  const deleteFile = jest.fn().mockResolvedValue(undefined);

  return {
    service: {
      saveCoursePdf,
      delete: deleteFile,
    },
    saveCoursePdf,
    deleteFile,
  };
}

function createDocumentsRepository(overrides?: { create?: jest.Mock }): {
  service: DocumentsRepository;
  create: jest.Mock;
} {
  const create =
    overrides?.create ??
    jest.fn().mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: '1710000000000-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-1/1710000000000-cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

  return {
    service: {
      create,
      findBySubjectForStudent: jest.fn(),
      findByIdForStudent: jest.fn(),
      findById: jest.fn(),
      markProcessing: jest.fn(),
      markReadyWithKnowledgeUnits: jest.fn(),
      markFailed: jest.fn(),
    },
    create,
  };
}

function createQueue(): {
  service: DocumentProcessingQueue;
  enqueue: jest.Mock;
} {
  const enqueue = jest.fn().mockResolvedValue(undefined);

  return {
    service: {
      enqueue,
    },
    enqueue,
  };
}
