import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessCourseQuestionBankPreparationJobUseCase } from '../../courses/application/process-course-question-bank-preparation-job.use-case';
import { COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME } from './bullmq-course-question-bank-preparation.queue';

@Injectable()
@Processor(COURSE_QUESTION_BANK_PREPARATION_QUEUE_NAME)
export class CourseQuestionBankPreparationConsumer extends WorkerHost {
  constructor(
    private readonly processPreparationJob: ProcessCourseQuestionBankPreparationJobUseCase,
  ) {
    super();
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

    await this.processPreparationJob.execute({ preparationJobId });
  }
}
