import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DocumentProcessingQueue } from '../application/document-processing.queue';

export const DOCUMENT_PROCESSING_QUEUE_NAME = 'document-processing';
const DOCUMENT_PROCESSING_ATTEMPTS = 3;
const DOCUMENT_PROCESSING_BACKOFF_DELAY_MS = 5000;

@Injectable()
export class BullMqDocumentProcessingQueue implements DocumentProcessingQueue {
  constructor(
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE_NAME)
    private readonly queue: Queue<{ documentId: string }>,
  ) {}

  async enqueue(input: { documentId: string }): Promise<void> {
    await this.queue.add('process-document', input, {
      attempts: DOCUMENT_PROCESSING_ATTEMPTS,
      backoff: {
        delay: DOCUMENT_PROCESSING_BACKOFF_DELAY_MS,
        type: 'exponential',
      },
      jobId: input.documentId,
      removeOnComplete: 100,
      removeOnFail: 250,
    });
  }
}
