import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DocumentFileCleanupQueue } from '../application/document-file-cleanup.queue';

export const DOCUMENT_FILE_CLEANUP_QUEUE_NAME = 'document-file-cleanup';
const DOCUMENT_FILE_CLEANUP_ATTEMPTS = 3;
const DOCUMENT_FILE_CLEANUP_BACKOFF_DELAY_MS = 5000;

@Injectable()
export class BullMqDocumentFileCleanupQueue implements DocumentFileCleanupQueue {
  constructor(
    @InjectQueue(DOCUMENT_FILE_CLEANUP_QUEUE_NAME)
    private readonly queue: Queue<{ cleanupJobId: string }>,
  ) {}

  async enqueue(input: { cleanupJobId: string }): Promise<void> {
    await this.queue.add('cleanup-document-file', input, {
      attempts: DOCUMENT_FILE_CLEANUP_ATTEMPTS,
      backoff: {
        delay: DOCUMENT_FILE_CLEANUP_BACKOFF_DELAY_MS,
        type: 'exponential',
      },
      jobId: input.cleanupJobId,
      removeOnComplete: 100,
      removeOnFail: 250,
    });
  }
}
