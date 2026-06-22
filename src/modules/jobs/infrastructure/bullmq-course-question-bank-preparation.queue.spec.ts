import { Logger } from '@nestjs/common';
import { BullMqCourseQuestionBankPreparationQueue } from './bullmq-course-question-bank-preparation.queue';

describe('BullMqCourseQuestionBankPreparationQueue', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('adds prepare-course-question-bank jobs with stable retry options', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'prep-1' });
    const queue = { add };

    await new BullMqCourseQuestionBankPreparationQueue(queue as never).enqueue({
      preparationJobId: 'prep-1',
    });

    expect(add).toHaveBeenCalledWith(
      'prepare-course-question-bank',
      { preparationJobId: 'prep-1' },
      {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: 'prep-1',
        removeOnComplete: 100,
        removeOnFail: 250,
      },
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'course_question_bank_enqueue_completed',
        preparationJobId: 'prep-1',
        queueName: 'course-question-bank-preparation',
      }),
    );
  });
});
