import { Test } from '@nestjs/testing';
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
import { JobsModule } from './jobs.module';

describe('JobsModule', () => {
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
