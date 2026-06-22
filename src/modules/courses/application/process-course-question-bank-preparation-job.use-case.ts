import { Inject, Injectable } from '@nestjs/common';
import { QuestionBankService } from '../../activities/application/question-bank.service';
import {
  COURSE_QUESTION_BANK_PREPARATION_REPOSITORY,
  type CourseQuestionBankPreparationRepository,
} from './course-question-bank-preparation.repository';

const DEFAULT_PREPARATION_MAX_ATTEMPTS = 3;

@Injectable()
export class ProcessCourseQuestionBankPreparationJobUseCase {
  constructor(
    @Inject(COURSE_QUESTION_BANK_PREPARATION_REPOSITORY)
    private readonly preparationRepository: CourseQuestionBankPreparationRepository,
    private readonly questionBank: QuestionBankService,
  ) {}

  async execute(input: {
    preparationJobId?: string;
    maxAttempts?: number;
  }): Promise<{ processed: boolean; preparationJobId: string | null }> {
    const maxAttempts = input.maxAttempts ?? DEFAULT_PREPARATION_MAX_ATTEMPTS;
    const job = await this.preparationRepository.claimNextPending({
      preparationJobId: input.preparationJobId,
      maxAttempts,
    });

    if (!job) {
      return {
        processed: false,
        preparationJobId: input.preparationJobId ?? null,
      };
    }

    try {
      const readyBefore =
        await this.questionBank.countActiveCourseQuickQuestions(job);

      if (readyBefore < job.targetQuestionCount) {
        await this.questionBank.prepareCourseQuickQuestionBank({
          studentId: job.studentId,
          subjectId: job.subjectId,
          courseId: job.courseId,
          documentId: job.documentId,
          knowledgeUnitId: job.knowledgeUnitId,
          questionCount: job.targetQuestionCount,
        });
      }

      const readyAfter =
        await this.questionBank.countActiveCourseQuickQuestions(job);

      if (readyAfter < job.targetQuestionCount) {
        throw new Error('Question bank preparation did not reach target');
      }

      await this.preparationRepository.markCompleted({
        preparationJobId: job.id,
      });

      return { processed: true, preparationJobId: job.id };
    } catch (error) {
      await this.preparationRepository.markFailed({
        preparationJobId: job.id,
        error,
        maxAttempts,
      });
      throw error;
    }
  }
}
