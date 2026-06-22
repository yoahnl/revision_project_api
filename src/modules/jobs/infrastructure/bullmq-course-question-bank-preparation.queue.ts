import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CourseQuestionBankPreparationQueue } from '../application/course-question-bank-preparation.queue';

export const COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME =
  'course-question-bank-preparation';
const COURSE_QUESTION_BANK_PREPARATION_ATTEMPTS = 3;
const COURSE_QUESTION_BANK_PREPARATION_BACKOFF_DELAY_MS = 5000;

@Injectable()
export class BullMqCourseQuestionBankPreparationQueue implements CourseQuestionBankPreparationQueue {
  private readonly logger = new Logger(
    BullMqCourseQuestionBankPreparationQueue.name,
  );

  constructor(
    @InjectQueue(COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME)
    private readonly queue: Queue<{ preparationJobId: string }>,
  ) {}

  async enqueue(input: { preparationJobId: string }): Promise<void> {
    this.logger.log({
      event: 'course_question_bank_enqueue_requested',
      preparationJobId: input.preparationJobId,
      queueName: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
    });

    try {
      const job = await this.queue.add('prepare-course-question-bank', input, {
        attempts: COURSE_QUESTION_BANK_PREPARATION_ATTEMPTS,
        backoff: {
          delay: COURSE_QUESTION_BANK_PREPARATION_BACKOFF_DELAY_MS,
          type: 'exponential',
        },
        jobId: input.preparationJobId,
        removeOnComplete: 100,
        removeOnFail: 250,
      });

      this.logger.log({
        event: 'course_question_bank_enqueue_completed',
        preparationJobId: input.preparationJobId,
        queueName: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
        bullJobId: job.id ? String(job.id) : null,
      });
    } catch (error) {
      this.logger.error({
        event: 'course_question_bank_enqueue_failed',
        preparationJobId: input.preparationJobId,
        queueName: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
