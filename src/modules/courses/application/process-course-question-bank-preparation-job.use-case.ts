import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { QuestionBankService } from '../../activities/application/question-bank.service';
import {
  COURSE_QUESTION_BANK_PREPARATION_REPOSITORY,
  type CourseQuestionBankPreparationRepository,
} from './course-question-bank-preparation.repository';

const DEFAULT_PREPARATION_MAX_ATTEMPTS = 3;

@Injectable()
export class ProcessCourseQuestionBankPreparationJobUseCase {
  private readonly logger = new Logger(
    ProcessCourseQuestionBankPreparationJobUseCase.name,
  );

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
    this.logger.log({
      event: 'course_question_bank_worker_received',
      preparationJobId: input.preparationJobId ?? null,
      maxAttempts,
    });
    const job = await this.preparationRepository.claimNextPending({
      preparationJobId: input.preparationJobId,
      maxAttempts,
    });

    if (!job) {
      this.logger.log({
        event: 'course_question_bank_worker_not_claimed',
        preparationJobId: input.preparationJobId ?? null,
      });
      return {
        processed: false,
        preparationJobId: input.preparationJobId ?? null,
      };
    }

    try {
      const readyBefore =
        await this.questionBank.countActiveCourseQuickQuestions(job);
      let stats = {
        activeBefore: readyBefore,
        activeAfter: readyBefore,
        generatedCount: 0,
        persistedCount: 0,
        duplicateSkippedCount: 0,
        structureSkippedCount: 0,
      };

      this.logger.log({
        event: 'course_question_bank_worker_claimed',
        preparationJobId: job.id,
        courseId: job.courseId,
        knowledgeUnitId: job.knowledgeUnitId,
        studentRef: safeStudentRef(job.studentId),
        targetQuestionCount: job.targetQuestionCount,
        readyBefore,
      });

      if (readyBefore < job.targetQuestionCount) {
        stats = await this.questionBank.prepareCourseQuickQuestionBank({
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
        throw new Error(
          `Question bank preparation did not reach target: readyAfter=${readyAfter}; target=${job.targetQuestionCount}; persisted=${stats.persistedCount}; duplicateSkipped=${stats.duplicateSkippedCount}; structureSkipped=${stats.structureSkippedCount}`,
        );
      }

      await this.preparationRepository.markCompleted({
        preparationJobId: job.id,
      });
      this.logger.log({
        event: 'course_question_bank_worker_completed',
        preparationJobId: job.id,
        courseId: job.courseId,
        knowledgeUnitId: job.knowledgeUnitId,
        studentRef: safeStudentRef(job.studentId),
        targetQuestionCount: job.targetQuestionCount,
        readyBefore,
        readyAfter,
        generatedCount: stats.generatedCount,
        persistedCount: stats.persistedCount,
        duplicateSkippedCount: stats.duplicateSkippedCount,
        structureSkippedCount: stats.structureSkippedCount,
        status: 'COMPLETED',
      });

      return { processed: true, preparationJobId: job.id };
    } catch (error) {
      await this.preparationRepository.markFailed({
        preparationJobId: job.id,
        error,
        maxAttempts,
      });
      this.logger.error({
        event: 'course_question_bank_worker_failed',
        preparationJobId: job.id,
        courseId: job.courseId,
        knowledgeUnitId: job.knowledgeUnitId,
        studentRef: safeStudentRef(job.studentId),
        targetQuestionCount: job.targetQuestionCount,
        lastError: error instanceof Error ? error.message : String(error),
        status: 'FAILED',
      });
      throw error;
    }
  }
}

function safeStudentRef(studentId: string) {
  return createHash('sha256').update(studentId).digest('hex').slice(0, 12);
}
