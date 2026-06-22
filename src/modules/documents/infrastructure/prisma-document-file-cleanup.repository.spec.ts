import { PrismaDocumentFileCleanupRepository } from './prisma-document-file-cleanup.repository';

type CleanupJobRecord = {
  id: string;
  documentId: string | null;
  studentId: string;
  storagePath: string;
  reason: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionCallback = (tx: PrismaCleanupMock) => unknown;

type PrismaCleanupMock = {
  documentFileCleanupJob: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

describe('PrismaDocumentFileCleanupRepository', () => {
  it('claims the oldest pending cleanup job with a conditional transition', async () => {
    const { prisma, repository } = createRepository();
    const anyDate = expect.any(Date) as unknown as Date;
    prisma.documentFileCleanupJob.findFirst.mockResolvedValue(cleanupJob());
    prisma.documentFileCleanupJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentFileCleanupJob.findUnique.mockResolvedValue(
      cleanupJob({ status: 'RUNNING' }),
    );

    await expect(
      repository.claimNextPending({ maxAttempts: 3 }),
    ).resolves.toMatchObject({
      id: 'cleanup-1',
      status: 'RUNNING',
      storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    });

    expect(prisma.documentFileCleanupJob.findFirst).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        attempts: { lt: 3 },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(prisma.documentFileCleanupJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cleanup-1',
        status: 'PENDING',
        attempts: { lt: 3 },
      },
      data: {
        status: 'RUNNING',
        lockedAt: anyDate,
      },
    });
  });

  it('does not claim a job that was already claimed by another worker', async () => {
    const { prisma, repository } = createRepository();
    prisma.documentFileCleanupJob.findFirst.mockResolvedValue(cleanupJob());
    prisma.documentFileCleanupJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.claimNextPending({ maxAttempts: 3 }),
    ).resolves.toBeNull();

    expect(prisma.documentFileCleanupJob.findUnique).not.toHaveBeenCalled();
  });

  it('marks a running job as completed', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-22T10:30:00.000Z');

    await repository.markCompleted({
      cleanupJobId: 'cleanup-1',
      completedAt,
    });

    expect(prisma.documentFileCleanupJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cleanup-1',
        status: 'RUNNING',
      },
      data: {
        status: 'COMPLETED',
        completedAt,
        lockedAt: null,
        lastError: null,
      },
    });
  });

  it('returns failed jobs to pending while attempts remain', async () => {
    const { prisma, repository } = createRepository();
    prisma.documentFileCleanupJob.findUnique.mockResolvedValue(
      cleanupJob({ attempts: 1 }),
    );

    await repository.markFailed({
      cleanupJobId: 'cleanup-1',
      error: new Error('disk unavailable'),
      maxAttempts: 3,
    });

    expect(prisma.documentFileCleanupJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cleanup-1',
        status: 'RUNNING',
      },
      data: {
        status: 'PENDING',
        attempts: 2,
        lastError: 'disk unavailable',
        lockedAt: null,
      },
    });
  });

  it('marks failed after max attempts', async () => {
    const { prisma, repository } = createRepository();
    prisma.documentFileCleanupJob.findUnique.mockResolvedValue(
      cleanupJob({ attempts: 2 }),
    );

    await repository.markFailed({
      cleanupJobId: 'cleanup-1',
      error: new Error('permission denied'),
      maxAttempts: 3,
    });

    expect(prisma.documentFileCleanupJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cleanup-1',
        status: 'RUNNING',
      },
      data: {
        status: 'FAILED',
        attempts: 3,
        lastError: 'permission denied',
        lockedAt: null,
      },
    });
  });
});

function createRepository() {
  const prisma: PrismaCleanupMock = {
    documentFileCleanupJob: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
  };
  prisma.$transaction.mockImplementation((callback) =>
    Promise.resolve(callback(prisma)),
  );

  return {
    prisma,
    repository: new PrismaDocumentFileCleanupRepository(prisma as never),
  };
}

function cleanupJob(input: Partial<CleanupJobRecord> = {}): CleanupJobRecord {
  return {
    id: 'cleanup-1',
    documentId: 'document-1',
    studentId: 'student-1',
    storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    reason: 'DOCUMENT_SAFE_DELETE',
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    lockedAt: null,
    completedAt: null,
    createdAt: new Date('2026-06-22T09:00:00.000Z'),
    updatedAt: new Date('2026-06-22T09:00:00.000Z'),
    ...input,
  };
}
