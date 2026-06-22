import { BullModule } from '@nestjs/bullmq';
import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { AiModule } from '../ai/ai.module';
import { ACTIVITIES_REPOSITORY } from '../activities/application/activities.repository';
import { DIAGNOSTIC_QUIZ_GENERATOR } from '../activities/application/diagnostic-quiz-generator';
import { QuestionBankService } from '../activities/application/question-bank.service';
import { GenkitDiagnosticQuizGenerator } from '../activities/infrastructure/genkit-diagnostic-quiz.generator';
import { PrismaActivitiesRepository } from '../activities/infrastructure/prisma-activities.repository';
import { COURSE_QUESTION_BANK_PREPARATION_REPOSITORY } from '../courses/application/course-question-bank-preparation.repository';
import { ProcessCourseQuestionBankPreparationJobUseCase } from '../courses/application/process-course-question-bank-preparation-job.use-case';
import { PrismaCourseQuestionBankPreparationRepository } from '../courses/infrastructure/prisma-course-question-bank-preparation.repository';
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
  COURSE_QUESTION_BANK_PREPARATION_QUEUE,
  type CourseQuestionBankPreparationQueue,
} from './application/course-question-bank-preparation.queue';
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
import {
  BullMqCourseQuestionBankPreparationQueue,
  COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
} from './infrastructure/bullmq-course-question-bank-preparation.queue';
import { CourseQuestionBankPreparationConsumer } from './infrastructure/course-question-bank-preparation.consumer';
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

class NoopCourseQuestionBankPreparationQueue implements CourseQuestionBankPreparationQueue {
  async enqueue(): Promise<void> {}
}

@Injectable()
class JobsRuntimeConfigurationLogger implements OnModuleInit {
  private readonly logger = new Logger(JobsRuntimeConfigurationLogger.name);

  onModuleInit() {
    this.logger.log({
      event: 'course_question_bank_worker_runtime_configuration',
      nodeEnv: process.env.NODE_ENV ?? null,
      queueDisabled: isQueueDisabled,
      questionBankWorkerEnabled: isCourseQuestionBankPreparationWorkerEnabled,
      redisConfigured: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST),
      redisConnectionMode: process.env.REDIS_URL ? 'url' : 'host-port',
      consumerRegistered: isCourseQuestionBankPreparationWorkerEnabled,
    });
  }
}

const isDocumentProcessingWorkerEnabled =
  !isQueueDisabled && process.env.DOCUMENT_PROCESSING_WORKER_ENABLED === 'true';

const isDocumentFileCleanupWorkerEnabled =
  !isQueueDisabled &&
  (process.env.DOCUMENT_FILE_CLEANUP_WORKER_ENABLED ??
    process.env.DOCUMENT_PROCESSING_WORKER_ENABLED) === 'true';

const isCourseQuestionBankPreparationWorkerEnabled =
  !isQueueDisabled &&
  process.env.COURSE_QUESTION_BANK_PREPARATION_WORKER_ENABLED === 'true';

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

const courseQuestionBankPreparationConsumerProviders =
  isCourseQuestionBankPreparationWorkerEnabled
    ? [
        QuestionBankService,
        {
          provide: ACTIVITIES_REPOSITORY,
          useClass: PrismaActivitiesRepository,
        },
        {
          provide: DIAGNOSTIC_QUIZ_GENERATOR,
          useClass: GenkitDiagnosticQuizGenerator,
        },
        {
          provide: COURSE_QUESTION_BANK_PREPARATION_REPOSITORY,
          useClass: PrismaCourseQuestionBankPreparationRepository,
        },
        ProcessCourseQuestionBankPreparationJobUseCase,
        CourseQuestionBankPreparationConsumer,
      ]
    : [];

const courseQuestionBankPreparationWorkerImports =
  isCourseQuestionBankPreparationWorkerEnabled ? [PrismaModule, AiModule] : [];

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
        BullModule.registerQueue({
          name: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
        }),
        ...documentProcessingWorkerImports,
        ...documentFileCleanupWorkerImports,
        ...courseQuestionBankPreparationWorkerImports,
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
    isQueueDisabled
      ? {
          provide: COURSE_QUESTION_BANK_PREPARATION_QUEUE,
          useClass: NoopCourseQuestionBankPreparationQueue,
        }
      : {
          provide: COURSE_QUESTION_BANK_PREPARATION_QUEUE,
          useClass: BullMqCourseQuestionBankPreparationQueue,
        },
    ...documentProcessingConsumerProviders,
    ...documentFileCleanupConsumerProviders,
    ...courseQuestionBankPreparationConsumerProviders,
    JobsRuntimeConfigurationLogger,
  ],
  exports: [
    DOCUMENT_PROCESSING_QUEUE,
    DOCUMENT_FILE_CLEANUP_QUEUE,
    COURSE_QUESTION_BANK_PREPARATION_QUEUE,
  ],
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
