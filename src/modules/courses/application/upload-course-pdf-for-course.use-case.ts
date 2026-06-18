import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENT_FILE_STORAGE,
  type DocumentFileStorage,
} from '../../documents/application/document-file-storage';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
  type RevisionDocumentDto,
} from '../../documents/application/documents.repository';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from '../../jobs/application/document-processing.queue';
import {
  COURSES_REPOSITORY,
  type CourseDocumentDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class UploadCoursePdfForCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(DOCUMENT_FILE_STORAGE)
    private readonly storage: DocumentFileStorage,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_PROCESSING_QUEUE)
    private readonly documentProcessingQueue: DocumentProcessingQueue,
  ) {}

  async execute(input: {
    studentId: string;
    firebaseUid: string;
    courseId: string;
    originalFileName: string;
    content: Buffer;
    mimeType: string;
  }): Promise<CourseDocumentDto> {
    const studentId = requireNonEmpty(input.studentId, 'studentId is required');
    const firebaseUid = requireNonEmpty(
      input.firebaseUid,
      'firebaseUid is required',
    );
    const courseId = requireNonEmpty(input.courseId, 'courseId is required');

    if (!Buffer.isBuffer(input.content) || input.content.length === 0) {
      throw new Error('Document content is required');
    }

    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId,
      courseId,
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const stored = await this.storage.saveCoursePdf({
      firebaseUid,
      subjectId: course.subjectId,
      originalFileName: input.originalFileName,
      content: input.content,
      mimeType: input.mimeType,
    });

    try {
      const document = await this.documentsRepository.create({
        studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        kind: 'COURSE_PDF',
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
      });

      await this.documentProcessingQueue.enqueue({ documentId: document.id });

      return toCourseDocumentDto(document);
    } catch (error) {
      // Storage is outside the DB transaction: delete the saved blob if DB or
      // queue registration fails, then surface the original failure.
      await this.storage
        .delete({ storagePath: stored.storagePath })
        .catch(() => {
          // Best-effort cleanup: preserving the DB/queue error is more useful to
          // callers than replacing it with a secondary storage delete failure.
        });
      throw error;
    }
  }
}

function requireNonEmpty(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  return value.trim();
}

function toCourseDocumentDto(document: RevisionDocumentDto): CourseDocumentDto {
  if (!document.courseId) {
    throw new Error('Course upload document is missing courseId');
  }

  return {
    id: document.id,
    courseId: document.courseId,
    documentId: document.id,
    fileName: document.fileName,
    kind: document.kind,
    status: document.status,
    errorCode: document.errorCode,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
