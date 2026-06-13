import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { AiModule } from '../ai/ai.module';
import { DOCUMENT_CONTENT_READER } from '../documents/application/document-content-reader';
import { DOCUMENT_TEXT_EXTRACTOR } from '../documents/application/document-text-extractor';
import { DOCUMENTS_REPOSITORY } from '../documents/application/documents.repository';
import { LocalDocumentFileStorage } from '../documents/infrastructure/local-document-file-storage';
import { PdfParseDocumentTextExtractor } from '../documents/infrastructure/pdf-parse-document-text.extractor';
import { PrismaDocumentsRepository } from '../documents/infrastructure/prisma-documents.repository';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from './application/document-processing.queue';
import {
  BullMqDocumentProcessingQueue,
  DOCUMENT_PROCESSING_QUEUE_NAME,
} from './infrastructure/bullmq-document-processing.queue';
import { DocumentProcessingConsumer } from './infrastructure/document-processing.consumer';

const isQueueDisabled =
  process.env.NODE_ENV === 'test' ||
  process.env.DOCUMENT_PROCESSING_QUEUE_DISABLED === 'true';

class NoopDocumentProcessingQueue implements DocumentProcessingQueue {
  async enqueue(): Promise<void> {}
}

const documentProcessingConsumerProviders =
  !isQueueDisabled && process.env.DOCUMENT_PROCESSING_WORKER_ENABLED === 'true'
    ? [
        {
          provide: DOCUMENTS_REPOSITORY,
          useClass: PrismaDocumentsRepository,
        },
        {
          provide: DOCUMENT_CONTENT_READER,
          useClass: LocalDocumentFileStorage,
        },
        {
          provide: DOCUMENT_TEXT_EXTRACTOR,
          useClass: PdfParseDocumentTextExtractor,
        },
        DocumentProcessingConsumer,
      ]
    : [];

const documentProcessingWorkerImports =
  !isQueueDisabled && process.env.DOCUMENT_PROCESSING_WORKER_ENABLED === 'true'
    ? [PrismaModule, AiModule]
    : [];

@Module({
  imports: isQueueDisabled
    ? []
    : [
        BullModule.forRoot({
          connection: resolveRedisConnection(),
        }),
        BullModule.registerQueue({
          name: DOCUMENT_PROCESSING_QUEUE_NAME,
        }),
        ...documentProcessingWorkerImports,
      ],
  providers: [
    isQueueDisabled
      ? {
          provide: DOCUMENT_PROCESSING_QUEUE,
          useClass: NoopDocumentProcessingQueue,
        }
      : {
          provide: DOCUMENT_PROCESSING_QUEUE,
          useClass: BullMqDocumentProcessingQueue,
        },
    ...documentProcessingConsumerProviders,
  ],
  exports: [DOCUMENT_PROCESSING_QUEUE],
})
export class JobsModule {}

function resolveRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
  }

  const url = new URL(redisUrl);
  const database = Number(url.pathname.replace('/', ''));

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isNaN(database) ? undefined : database,
  };
}
