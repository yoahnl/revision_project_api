import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
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
  JobsModule,
  resolveCourseQuestionBankPreparationWorkerEnabled,
} from './jobs.module';

describe('JobsModule', () => {
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
