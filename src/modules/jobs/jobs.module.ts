import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { AiModule } from '../ai/ai.module';
import { DOCUMENT_CONTENT_READER } from '../documents/application/document-content-reader';
import { DOCUMENT_FILE_CLEANUP_REPOSITORY } from '../documents/application/document-file-cleanup.repository';
import { DOCUMENT_FILE_STORAGE } from '../documents/application/document-file-storage';
import { DOCUMENT_TEXT_CHUNKER } from '../documents/application/document-text-chunker';
import { DOCUMENT_TEXT_EXTRACTOR } from '../documents/application/document-text-extractor';
import { DOCUMENTS_REPOSITORY } from '../documents/application/documents.repository';
import {
  ProcessDocumentFileCleanupJobUseCase,
  ProcessPendingDocumentFileCleanupJobsUseCase,
} from '../documents/application/process-document-file-cleanup.use-case';
import { DeterministicDocumentTextChunker } from '../documents/infrastructure/deterministic-document-text.chunker';
import { LocalDocumentFileStorage } from '../documents/infrastructure/local-document-file-storage';
import { PrismaDocumentFileCleanupRepository } from '../documents/infrastructure/prisma-document-file-cleanup.repository';
import { PdfParseDocumentTextExtractor } from '../documents/infrastructure/pdf-parse-document-text.extractor';
import { PrismaDocumentsRepository } from '../documents/infrastructure/prisma-documents.repository';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import {
  DOCUMENT_FILE_CLEANUP_QUEUE,
  type DocumentFileCleanupQueue,
} from './application/document-file-cleanup.queue';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from './application/document-processing.queue';
import {
  BullMqDocumentFileCleanupQueue,
  DOCUMENT_FILE_CLEANUP_QUEUE_NAME,
} from './infrastructure/bullmq-document-file-cleanup.queue';
import {
  BullMqDocumentProcessingQueue,
  DOCUMENT_PROCESSING_QUEUE_NAME,
} from './infrastructure/bullmq-document-processing.queue';
import { DocumentFileCleanupConsumer } from './infrastructure/document-file-cleanup.consumer';
import { DocumentProcessingConsumer } from './infrastructure/document-processing.consumer';

const isQueueDisabled =
  process.env.NODE_ENV === 'test' ||
  process.env.DOCUMENT_PROCESSING_QUEUE_DISABLED === 'true';

class NoopDocumentProcessingQueue implements DocumentProcessingQueue {
  async enqueue(): Promise<void> {}
}

class NoopDocumentFileCleanupQueue implements DocumentFileCleanupQueue {
  async enqueue(): Promise<void> {}
}

const isDocumentProcessingWorkerEnabled =
  !isQueueDisabled && process.env.DOCUMENT_PROCESSING_WORKER_ENABLED === 'true';

const isDocumentFileCleanupWorkerEnabled =
  !isQueueDisabled &&
  (process.env.DOCUMENT_FILE_CLEANUP_WORKER_ENABLED ??
    process.env.DOCUMENT_PROCESSING_WORKER_ENABLED) === 'true';

const documentProcessingConsumerProviders = isDocumentProcessingWorkerEnabled
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
      {
        provide: DOCUMENT_TEXT_CHUNKER,
        useFactory: () => new DeterministicDocumentTextChunker(),
      },
      DocumentProcessingConsumer,
    ]
  : [];

const documentProcessingWorkerImports = isDocumentProcessingWorkerEnabled
  ? [PrismaModule, AiModule]
  : [];

const documentFileCleanupConsumerProviders = isDocumentFileCleanupWorkerEnabled
  ? [
      {
        provide: DOCUMENT_FILE_CLEANUP_REPOSITORY,
        useClass: PrismaDocumentFileCleanupRepository,
      },
      {
        provide: DOCUMENT_FILE_STORAGE,
        useClass: LocalDocumentFileStorage,
      },
      ProcessDocumentFileCleanupJobUseCase,
      ProcessPendingDocumentFileCleanupJobsUseCase,
      DocumentFileCleanupConsumer,
    ]
  : [];

const documentFileCleanupWorkerImports =
  !isDocumentProcessingWorkerEnabled && isDocumentFileCleanupWorkerEnabled
    ? [PrismaModule]
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
        BullModule.registerQueue({
          name: DOCUMENT_FILE_CLEANUP_QUEUE_NAME,
        }),
        ...documentProcessingWorkerImports,
        ...documentFileCleanupWorkerImports,
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
    isQueueDisabled
      ? {
          provide: DOCUMENT_FILE_CLEANUP_QUEUE,
          useClass: NoopDocumentFileCleanupQueue,
        }
      : {
          provide: DOCUMENT_FILE_CLEANUP_QUEUE,
          useClass: BullMqDocumentFileCleanupQueue,
        },
    ...documentProcessingConsumerProviders,
    ...documentFileCleanupConsumerProviders,
  ],
  exports: [DOCUMENT_PROCESSING_QUEUE, DOCUMENT_FILE_CLEANUP_QUEUE],
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
