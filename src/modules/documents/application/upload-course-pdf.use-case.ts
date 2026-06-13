import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENT_FILE_STORAGE,
  type DocumentFileStorage,
} from './document-file-storage';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
  type RevisionDocumentDto,
} from './documents.repository';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from '../../jobs/application/document-processing.queue';

@Injectable()
export class UploadCoursePdfUseCase {
  constructor(
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
    subjectId: string;
    originalFileName: string;
    content: Buffer;
    mimeType: string;
  }): Promise<RevisionDocumentDto> {
    const stored = await this.storage.saveCoursePdf({
      firebaseUid: input.firebaseUid,
      subjectId: input.subjectId,
      originalFileName: input.originalFileName,
      content: input.content,
      mimeType: input.mimeType,
    });

    try {
      const document = await this.documentsRepository.create({
        studentId: input.studentId,
        subjectId: input.subjectId,
        kind: 'COURSE_PDF',
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
      });

      await this.documentProcessingQueue.enqueue({ documentId: document.id });

      return document;
    } catch (error) {
      await this.storage.delete({ storagePath: stored.storagePath });
      throw error;
    }
  }
}
