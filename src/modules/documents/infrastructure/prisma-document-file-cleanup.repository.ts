import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  type DocumentFileCleanupJobDto,
  type DocumentFileCleanupRepository,
} from '../application/document-file-cleanup.repository';

@Injectable()
export class PrismaDocumentFileCleanupRepository implements DocumentFileCleanupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimNextPending(input: {
    cleanupJobId?: string;
    maxAttempts: number;
  }): Promise<DocumentFileCleanupJobDto | null> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.documentFileCleanupJob.findFirst({
        where: {
          ...(input.cleanupJobId ? { id: input.cleanupJobId } : {}),
          status: 'PENDING',
          attempts: { lt: input.maxAttempts },
        },
        orderBy: [{ createdAt: 'asc' }],
      });

      if (!job) {
        return null;
      }

      const result = await tx.documentFileCleanupJob.updateMany({
        where: {
          id: job.id,
          status: 'PENDING',
          attempts: { lt: input.maxAttempts },
        },
        data: {
          status: 'RUNNING',
          lockedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        return null;
      }

      const claimed = await tx.documentFileCleanupJob.findUnique({
        where: { id: job.id },
      });

      return claimed ? this.toDto(claimed) : null;
    });
  }

  async markCompleted(input: {
    cleanupJobId: string;
    completedAt?: Date;
  }): Promise<void> {
    await this.prisma.documentFileCleanupJob.updateMany({
      where: {
        id: input.cleanupJobId,
        status: 'RUNNING',
      },
      data: {
        status: 'COMPLETED',
        completedAt: input.completedAt ?? new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  async markFailed(input: {
    cleanupJobId: string;
    error: unknown;
    maxAttempts: number;
  }): Promise<void> {
    const job = await this.prisma.documentFileCleanupJob.findUnique({
      where: { id: input.cleanupJobId },
    });

    if (!job) {
      return;
    }

    const attempts = job.attempts + 1;

    await this.prisma.documentFileCleanupJob.updateMany({
      where: {
        id: input.cleanupJobId,
        status: 'RUNNING',
      },
      data: {
        status: attempts >= input.maxAttempts ? 'FAILED' : 'PENDING',
        attempts,
        lastError: formatCleanupError(input.error),
        lockedAt: null,
      },
    });
  }

  private toDto(record: DocumentFileCleanupJobDto): DocumentFileCleanupJobDto {
    return record;
  }
}

function formatCleanupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return 'Unknown storage cleanup error';
  }

  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
}
