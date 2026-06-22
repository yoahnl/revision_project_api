import { BullMqCourseQuestionBankPreparationQueue } from './bullmq-course-question-bank-preparation.queue';

describe('BullMqCourseQuestionBankPreparationQueue', () => {
  it('adds prepare-course-question-bank jobs with stable retry options', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
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
  });
});
