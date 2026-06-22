import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessCourseQuestionBankPreparationJobUseCase } from '../../courses/application/process-course-question-bank-preparation-job.use-case';
import { COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME } from './bullmq-course-question-bank-preparation.queue';

@Injectable()
@Processor(COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME)
export class CourseQuestionBankPreparationConsumer extends WorkerHost {
  private readonly logger = new Logger(
    CourseQuestionBankPreparationConsumer.name,
  );

  constructor(
    private readonly processPreparationJob: ProcessCourseQuestionBankPreparationJobUseCase,
  ) {
    super();
    this.logger.log({
      event: 'course_question_bank_worker_started',
      queueName: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
    });
  }

  async process(job: Job<{ preparationJobId: string }>): Promise<void> {
    const data = job.data as { preparationJobId?: unknown } | null;
    const preparationJobId = data?.preparationJobId;

    if (
      typeof preparationJobId !== 'string' ||
      preparationJobId.trim().length === 0
    ) {
      throw new Error(
        'Question bank preparation job requires preparationJobId',
      );
    }

    this.logger.log({
      event: 'course_question_bank_worker_received',
      preparationJobId,
      queueName: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
      bullJobId: job.id ? String(job.id) : null,
    });

    const result = await this.processPreparationJob.execute({
      preparationJobId,
    });

    this.logger.log({
      event: 'course_question_bank_worker_processed',
      preparationJobId,
      queueName: COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME,
      processed: result.processed,
    });
  }
}
