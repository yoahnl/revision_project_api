import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentKind,
  type DocumentsRepository,
  type RevisionDocumentDto,
} from './documents.repository';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from '../../jobs/application/document-processing.queue';

@Injectable()
export class RegisterDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_PROCESSING_QUEUE)
    private readonly documentProcessingQueue: DocumentProcessingQueue,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto> {
    const document = await this.documentsRepository.create(input);
    await this.documentProcessingQueue.enqueue({ documentId: document.id });

    return document;
  }
}
