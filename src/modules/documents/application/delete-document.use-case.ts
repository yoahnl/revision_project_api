import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTS_REPOSITORY } from './documents.repository';
import type { DocumentsRepository } from './documents.repository';
import {
  DOCUMENT_FILE_CLEANUP_QUEUE,
  type DocumentFileCleanupQueue,
} from '../../jobs/application/document-file-cleanup.queue';

@Injectable()
export class DeleteDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_FILE_CLEANUP_QUEUE)
    private readonly cleanupQueue: DocumentFileCleanupQueue,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<void> {
    const result = await this.documentsRepository.deleteForStudent(input);

    if (!result.deleted) {
      throw new NotFoundException('Document not found');
    }

    if (result.cleanupJobId !== null) {
      await this.cleanupQueue.enqueue({ cleanupJobId: result.cleanupJobId });
    }
  }
}
