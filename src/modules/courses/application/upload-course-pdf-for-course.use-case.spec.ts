import { DocumentProcessingQueue } from '../../jobs/application/document-processing.queue';
import {
  type DocumentFileStorage,
  type StoredDocumentFile,
} from '../../documents/application/document-file-storage';
import type { DocumentsRepository } from '../../documents/application/documents.repository';
import type {
  CourseDocumentDto,
  CoursesRepository,
} from './courses.repository';
import { UploadCoursePdfForCourseUseCase } from './upload-course-pdf-for-course.use-case';

describe('UploadCoursePdfForCourseUseCase', () => {
  it('loads the owned course context before storing the PDF', async () => {
    const harness = createHarness();

    harness.storage.saveCoursePdf.mockImplementation(() => {
      expect(
        harness.coursesRepository.findCourseOwnershipContext,
      ).toHaveBeenCalledWith({
        studentId: 'student-1',
        courseId: 'course-1',
      });
      return storedFile();
    });

    await harness.useCase.execute(validInput());

    expect(harness.storage.saveCoursePdf).toHaveBeenCalledTimes(1);
  });

  it('refuses unknown or cross-student courses without storing the file', async () => {
    const harness = createHarness();
    harness.coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      null,
    );

    await expect(harness.useCase.execute(validInput())).rejects.toThrow(
      'Course not found',
    );

    expect(harness.storage.saveCoursePdf).not.toHaveBeenCalled();
    expect(harness.documentsRepository.create).not.toHaveBeenCalled();
    expect(harness.queue.enqueue).not.toHaveBeenCalled();
  });

  it('stores the PDF with the subject derived from the course and creates an attached document', async () => {
    const harness = createHarness();

    const result = await harness.useCase.execute(validInput());

    expect(result).toEqual(courseDocument());
    expect(harness.storage.saveCoursePdf).toHaveBeenCalledWith({
      firebaseUid: 'firebase-1',
      subjectId: 'subject-from-course',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
    expect(harness.documentsRepository.create).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-from-course',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      fileName: 'stored-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-from-course/stored-cours.pdf',
      mimeType: 'application/pdf',
    });
    expect(harness.queue.enqueue).toHaveBeenCalledWith({
      documentId: 'document-1',
    });
  });

  it('cleans up storage if document creation fails', async () => {
    const harness = createHarness();
    harness.documentsRepository.create.mockRejectedValue(
      new Error('DB unavailable'),
    );

    await expect(harness.useCase.execute(validInput())).rejects.toThrow(
      'DB unavailable',
    );

    expect(harness.storage.deleteFile).toHaveBeenCalledWith({
      storagePath: storedFile().storagePath,
    });
    expect(harness.queue.enqueue).not.toHaveBeenCalled();
  });

  it('cleans up storage if processing enqueue fails', async () => {
    const harness = createHarness();
    harness.queue.enqueue.mockRejectedValue(new Error('Queue unavailable'));

    await expect(harness.useCase.execute(validInput())).rejects.toThrow(
      'Queue unavailable',
    );

    expect(harness.storage.deleteFile).toHaveBeenCalledWith({
      storagePath: storedFile().storagePath,
    });
  });

  it('rejects blank identifiers before reaching repositories', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({ ...validInput(), courseId: ' ' }),
    ).rejects.toThrow('courseId is required');

    expect(
      harness.coursesRepository.findCourseOwnershipContext,
    ).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const coursesRepository = createCoursesRepository();
  const documentsRepository = createDocumentsRepository();
  const storage = createStorage();
  const queue = createQueue();

  return {
    coursesRepository,
    documentsRepository,
    storage,
    queue,
    useCase: new UploadCoursePdfForCourseUseCase(
      coursesRepository as unknown as CoursesRepository,
      storage.service,
      documentsRepository.service,
      queue.service,
    ),
  };
}

function createCoursesRepository() {
  return {
    findCourseOwnershipContext: jest.fn().mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-from-course',
    }),
  };
}

function createDocumentsRepository(): {
  service: DocumentsRepository;
  create: jest.Mock;
} {
  const create = jest.fn().mockResolvedValue({
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-from-course',
    courseId: 'course-1',
    kind: 'COURSE_PDF',
    fileName: 'stored-cours.pdf',
    storagePath: storedFile().storagePath,
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
  });

  return {
    service: {
      create,
      findBySubjectForStudent: jest.fn(),
      findByIdForStudent: jest.fn(),
      deleteForStudent: jest.fn(),
      findById: jest.fn(),
      markProcessing: jest.fn(),
      markReadyWithKnowledgeUnits: jest.fn(),
      replaceChunks: jest.fn(),
      findChunksByDocumentId: jest.fn(),
      findKnowledgeUnitsByDocumentForStudent: jest.fn(),
      replaceKnowledgeUnitSources: jest.fn(),
      markFailed: jest.fn(),
    },
    create,
  };
}

function createStorage(): {
  service: DocumentFileStorage;
  saveCoursePdf: jest.Mock;
  deleteFile: jest.Mock;
} {
  const saveCoursePdf = jest.fn().mockResolvedValue(storedFile());
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

function createQueue(): {
  service: DocumentProcessingQueue;
  enqueue: jest.Mock;
} {
  const enqueue = jest.fn().mockResolvedValue(undefined);

  return {
    service: { enqueue },
    enqueue,
  };
}

function validInput() {
  return {
    studentId: 'student-1',
    firebaseUid: 'firebase-1',
    courseId: 'course-1',
    originalFileName: 'cours.pdf',
    content: Buffer.from('%PDF-1.7'),
    mimeType: 'application/pdf',
  };
}

function storedFile(): StoredDocumentFile {
  return {
    fileName: 'stored-cours.pdf',
    storagePath:
      'students/firebase-1/subjects/subject-from-course/stored-cours.pdf',
    mimeType: 'application/pdf',
  };
}

function courseDocument(): CourseDocumentDto {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'stored-cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
  };
}
