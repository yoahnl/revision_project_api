import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessDocumentFileCleanupJobUseCase } from '../../documents/application/process-document-file-cleanup.use-case';
import { DOCUMENT_FILE_CLEANUP_QUEUE_NAME } from './bullmq-document-file-cleanup.queue';

@Injectable()
@Processor(DOCUMENT_FILE_CLEANUP_QUEUE_NAME)
export class DocumentFileCleanupConsumer extends WorkerHost {
  constructor(
    private readonly processCleanupJob: ProcessDocumentFileCleanupJobUseCase,
  ) {
    super();
  }

  async process(job: Job<{ cleanupJobId: string }>): Promise<void> {
    const data = job.data as { cleanupJobId?: unknown } | null;
    const cleanupJobId = data?.cleanupJobId;

    if (typeof cleanupJobId !== 'string' || cleanupJobId.trim().length === 0) {
      throw new Error('Document file cleanup job requires cleanupJobId');
    }

    await this.processCleanupJob.execute({ cleanupJobId });
  }
}
