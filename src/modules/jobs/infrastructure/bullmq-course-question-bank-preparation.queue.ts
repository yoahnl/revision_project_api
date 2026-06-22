import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CourseQuestionBankPreparationQueue } from '../application/course-question-bank-preparation.queue';

export const COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME =
  'course-question-bank-preparation';
const COURSE_QUESTION_BANK_PREPARATION_ATTEMPTS = 3;
const COURSE_QUESTION_BANK_PREPARATION_BACKOFF_DELAY_MS = 5000;

@Injectable()
export class BullMqCourseQuestionBankPreparationQueue implements CourseQuestionBankPreparationQueue {
  constructor(
    @InjectQueue(COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME)
    private readonly queue: Queue<{ preparationJobId: string }>,
  ) {}

  async enqueue(input: { preparationJobId: string }): Promise<void> {
    await this.queue.add('prepare-course-question-bank', input, {
      attempts: COURSE_QUESTION_BANK_PREPARATION_ATTEMPTS,
      backoff: {
        delay: COURSE_QUESTION_BANK_PREPARATION_BACKOFF_DELAY_MS,
        type: 'exponential',
      },
      jobId: input.preparationJobId,
      removeOnComplete: 100,
      removeOnFail: 250,
    });
  }
}
