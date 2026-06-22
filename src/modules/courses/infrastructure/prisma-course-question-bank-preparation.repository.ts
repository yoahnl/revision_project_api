import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  CourseQuestionBankPreparationJobDto,
  CourseQuestionBankPreparationRepository,
} from '../application/course-question-bank-preparation.repository';

@Injectable()
export class PrismaCourseQuestionBankPreparationRepository implements CourseQuestionBankPreparationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestForCourseContext(input: {
    studentId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    targetQuestionCount: number;
  }): Promise<CourseQuestionBankPreparationJobDto | null> {
    const job = await this.prisma.courseQuestionBankPreparationJob.findFirst({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        documentId: input.documentId,
        knowledgeUnitId: input.knowledgeUnitId,
        targetQuestionCount: {
          gte: input.targetQuestionCount,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return job ? toDto(job) : null;
  }

  async ensurePendingForCourseContext(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    targetQuestionCount: number;
  }): Promise<CourseQuestionBankPreparationJobDto> {
    const existing =
      await this.prisma.courseQuestionBankPreparationJob.findFirst({
        where: {
          studentId: input.studentId,
          courseId: input.courseId,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
          targetQuestionCount: {
            gte: input.targetQuestionCount,
          },
          status: {
            in: ['PENDING', 'RUNNING'],
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

    if (existing) {
      return toDto(existing);
    }

    const created = await this.prisma.courseQuestionBankPreparationJob.create({
      data: input,
    });

    return toDto(created);
  }

  async claimNextPending(input: {
    preparationJobId?: string;
    maxAttempts: number;
  }): Promise<CourseQuestionBankPreparationJobDto | null> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.courseQuestionBankPreparationJob.findFirst({
        where: {
          ...(input.preparationJobId ? { id: input.preparationJobId } : {}),
          status: 'PENDING',
          attempts: { lt: input.maxAttempts },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      if (!job) {
        return null;
      }

      const result = await tx.courseQuestionBankPreparationJob.updateMany({
        where: {
          id: job.id,
          status: 'PENDING',
          attempts: { lt: input.maxAttempts },
        },
        data: {
          status: 'RUNNING',
          lockedAt: new Date(),
          lastError: null,
        },
      });

      if (result.count !== 1) {
        return null;
      }

      const claimed = await tx.courseQuestionBankPreparationJob.findUnique({
        where: { id: job.id },
      });

      return claimed ? toDto(claimed) : null;
    });
  }

  async markCompleted(input: { preparationJobId: string }): Promise<void> {
    await this.prisma.courseQuestionBankPreparationJob.updateMany({
      where: {
        id: input.preparationJobId,
        status: 'RUNNING',
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  async markFailed(input: {
    preparationJobId: string;
    error: unknown;
    maxAttempts: number;
  }): Promise<void> {
    const job = await this.prisma.courseQuestionBankPreparationJob.findUnique({
      where: { id: input.preparationJobId },
    });

    if (!job) {
      return;
    }

    const attempts = job.attempts + 1;

    await this.prisma.courseQuestionBankPreparationJob.updateMany({
      where: {
        id: input.preparationJobId,
        status: 'RUNNING',
      },
      data: {
        status: attempts >= input.maxAttempts ? 'FAILED' : 'PENDING',
        attempts,
        lastError: formatPreparationError(input.error),
        lockedAt: null,
      },
    });
  }
}

function toDto(
  record: CourseQuestionBankPreparationJobDto,
): CourseQuestionBankPreparationJobDto {
  return record;
}

function formatPreparationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return 'Unknown question bank preparation error';
  }

  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
}
