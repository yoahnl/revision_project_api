import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ACTIVITIES_REPOSITORY } from '../activities/application/activities.repository';
import { DIAGNOSTIC_QUIZ_GENERATOR } from '../activities/application/diagnostic-quiz-generator';
import { QUESTION_BANK_REPOSITORY } from '../activities/application/question-bank.repository';
import { QuestionBankService } from '../activities/application/question-bank.service';
import { GenkitDiagnosticQuizGenerator } from '../activities/infrastructure/genkit-diagnostic-quiz.generator';
import { PrismaActivitiesRepository } from '../activities/infrastructure/prisma-activities.repository';
import { PrismaQuestionBankRepository } from '../activities/infrastructure/prisma-question-bank.repository';
import { COURSE_QUESTION_BANK_PREPARATION_REPOSITORY } from '../courses/application/course-question-bank-preparation.repository';
import { ProcessCourseQuestionBankPreparationJobUseCase } from '../courses/application/process-course-question-bank-preparation-job.use-case';
import { PrismaCourseQuestionBankPreparationRepository } from '../courses/infrastructure/prisma-course-question-bank-preparation.repository';
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
  buildCourseQuestionBankPreparationConsumerProviders,
  JobsModule,
  resolveCourseQuestionBankPreparationWorkerEnabled,
} from './jobs.module';
import { CourseQuestionBankPreparationConsumer } from './infrastructure/course-question-bank-preparation.consumer';

function providerUsesClass(
  providers: unknown[],
  token: unknown,
  useClass: unknown,
) {
  return providers.some(
    (provider) =>
      typeof provider === 'object' &&
      provider !== null &&
      'provide' in provider &&
      'useClass' in provider &&
      provider.provide === token &&
      provider.useClass === useClass,
  );
}

describe('JobsModule', () => {
  it('registers all question bank worker dependencies when the worker is enabled', () => {
    const providers = buildCourseQuestionBankPreparationConsumerProviders({
      enabled: true,
    });

    expect(providers).toContain(QuestionBankService);
    expect(providers).toContain(ProcessCourseQuestionBankPreparationJobUseCase);
    expect(providers).toContain(CourseQuestionBankPreparationConsumer);
    expect(
      providerUsesClass(
        providers,
        QUESTION_BANK_REPOSITORY,
        PrismaQuestionBankRepository,
      ),
    ).toBe(true);
    expect(
      providerUsesClass(
        providers,
        ACTIVITIES_REPOSITORY,
        PrismaActivitiesRepository,
      ),
    ).toBe(true);
    expect(
      providerUsesClass(
        providers,
        COURSE_QUESTION_BANK_PREPARATION_REPOSITORY,
        PrismaCourseQuestionBankPreparationRepository,
      ),
    ).toBe(true);
    expect(
      providerUsesClass(
        providers,
        DIAGNOSTIC_QUIZ_GENERATOR,
        GenkitDiagnosticQuizGenerator,
      ),
    ).toBe(true);
  });

  it('enables the course question bank worker by default when queues are enabled', () => {
    expect(
      resolveCourseQuestionBankPreparationWorkerEnabled({
        queueDisabled: false,
        envValue: undefined,
      }),
    ).toBe(true);
    expect(
      resolveCourseQuestionBankPreparationWorkerEnabled({
        queueDisabled: false,
        envValue: 'false',
      }),
    ).toBe(false);
    expect(
      resolveCourseQuestionBankPreparationWorkerEnabled({
        queueDisabled: true,
        envValue: 'true',
      }),
    ).toBe(false);
  });

  it('logs safe queue runtime configuration on startup', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    await module.init();

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'course_question_bank_worker_runtime_configuration',
        nodeEnv: 'test',
        queueDisabled: true,
        questionBankWorkerEnabled: false,
        questionBankWorkerEnvValue: 'unset',
        redisConfigured: false,
        redisConnectionMode: 'host-port',
        consumerRegistered: false,
      }),
    );

    await module.close();
    logSpy.mockRestore();
  });

  it('uses in-process document queue providers during tests', async () => {
    const module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const processingQueue = module.get<DocumentProcessingQueue>(
      DOCUMENT_PROCESSING_QUEUE,
    );
    const cleanupQueue = module.get<DocumentFileCleanupQueue>(
      DOCUMENT_FILE_CLEANUP_QUEUE,
    );
    const preparationQueue = module.get<CourseQuestionBankPreparationQueue>(
      COURSE_QUESTION_BANK_PREPARATION_QUEUE,
    );

    await expect(
      processingQueue.enqueue({ documentId: 'document-1' }),
    ).resolves.toBeUndefined();
    await expect(
      cleanupQueue.enqueue({ cleanupJobId: 'cleanup-1' }),
    ).resolves.toBeUndefined();
    await expect(
      preparationQueue.enqueue({ preparationJobId: 'prep-1' }),
    ).resolves.toBeUndefined();

    await module.close();
  });
});
