import { PrismaCourseQuestionBankPreparationRepository } from './prisma-course-question-bank-preparation.repository';

type PreparationJobRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string;
  documentId: string;
  knowledgeUnitId: string;
  targetQuestionCount: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionCallback = (tx: PrismaPreparationMock) => unknown;

type PrismaPreparationMock = {
  courseQuestionBankPreparationJob: {
    create: jest.Mock<Promise<PreparationJobRecord>, [unknown]>;
    findFirst: jest.Mock<Promise<PreparationJobRecord | null>, [unknown]>;
    findMany: jest.Mock<Promise<PreparationJobRecord[]>, [unknown]>;
    findUnique: jest.Mock<Promise<PreparationJobRecord | null>, [unknown]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

type ClaimInput = {
  where?: {
    id?: string;
    attempts?: { lt: number };
    OR?: unknown;
  };
};

describe('PrismaCourseQuestionBankPreparationRepository', () => {
  it('finds the latest preparation job for a course-level readiness check', async () => {
    const { prisma, repository } = createRepository();
    prisma.courseQuestionBankPreparationJob.findFirst.mockResolvedValue(
      preparationJobRecord({ id: 'prep-latest' }),
    );

    await expect(
      repository.findLatestForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        targetQuestionCount: 10,
      }),
    ).resolves.toMatchObject({
      id: 'prep-latest',
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(
      prisma.courseQuestionBankPreparationJob.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        targetQuestionCount: {
          gte: 10,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('finds recent active and failed jobs without comparing per-KU targets to the course target', async () => {
    const { prisma, repository } = createRepository();
    prisma.courseQuestionBankPreparationJob.findMany.mockResolvedValue([
      preparationJobRecord({ id: 'prep-ku-1', targetQuestionCount: 5 }),
      preparationJobRecord({
        id: 'prep-ku-2',
        knowledgeUnitId: 'unit-2',
        targetQuestionCount: 5,
        status: 'RUNNING',
      }),
      preparationJobRecord({
        id: 'prep-ku-3',
        knowledgeUnitId: 'unit-3',
        targetQuestionCount: 5,
        status: 'FAILED',
      }),
    ]);

    await expect(
      repository.findRecentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toHaveLength(3);

    expect(
      prisma.courseQuestionBankPreparationJob.findMany,
    ).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        status: {
          in: ['PENDING', 'RUNNING', 'FAILED'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  });

  it('returns whether ensurePendingForCourseContext created or reused a job', async () => {
    const { prisma, repository } = createRepository();
    prisma.courseQuestionBankPreparationJob.findFirst
      .mockResolvedValueOnce(preparationJobRecord({ id: 'prep-existing' }))
      .mockResolvedValueOnce(null);
    prisma.courseQuestionBankPreparationJob.create.mockResolvedValue(
      preparationJobRecord({ id: 'prep-created' }),
    );

    await expect(
      repository.ensurePendingForCourseContext({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        targetQuestionCount: 5,
      }),
    ).resolves.toMatchObject({
      created: false,
      job: { id: 'prep-existing' },
    });

    await expect(
      repository.ensurePendingForCourseContext({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        targetQuestionCount: 5,
      }),
    ).resolves.toMatchObject({
      created: true,
      job: { id: 'prep-created' },
    });
  });

  it('claims a stale running job atomically when BullMQ redelivers it', async () => {
    const { prisma, repository } = createRepository();
    const staleBefore = new Date('2026-06-22T10:00:00.000Z');
    const staleJob = preparationJobRecord({
      id: 'prep-stale',
      status: 'RUNNING',
      attempts: 1,
      lockedAt: new Date('2026-06-22T09:00:00.000Z'),
    });
    prisma.courseQuestionBankPreparationJob.findFirst.mockResolvedValue(
      staleJob,
    );
    prisma.courseQuestionBankPreparationJob.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.courseQuestionBankPreparationJob.findUnique.mockResolvedValue({
      ...staleJob,
      lockedAt: new Date('2026-06-22T10:01:00.000Z'),
    });

    await expect(
      repository.claimNextPending({
        preparationJobId: 'prep-stale',
        maxAttempts: 3,
        staleBefore,
      }),
    ).resolves.toMatchObject({
      id: 'prep-stale',
      status: 'RUNNING',
    });

    const findFirstInput = prisma.courseQuestionBankPreparationJob.findFirst
      .mock.calls[0]?.[0] as ClaimInput | undefined;
    const updateManyInput = prisma.courseQuestionBankPreparationJob.updateMany
      .mock.calls[0]?.[0] as ClaimInput | undefined;

    expect(findFirstInput?.where).toMatchObject({
      id: 'prep-stale',
      attempts: { lt: 3 },
    });
    expect(findFirstInput?.where?.OR).toEqual(
      expect.arrayContaining([
        { status: 'PENDING' },
        {
          status: 'RUNNING',
          lockedAt: { lt: staleBefore },
        },
      ]),
    );
    expect(updateManyInput?.where).toMatchObject({
      id: 'prep-stale',
      attempts: { lt: 3 },
    });
    expect(updateManyInput?.where?.OR).toEqual(
      expect.arrayContaining([
        { status: 'PENDING' },
        {
          status: 'RUNNING',
          lockedAt: { lt: staleBefore },
        },
      ]),
    );
  });
});

function createRepository() {
  const prisma: PrismaPreparationMock = {
    courseQuestionBankPreparationJob: {
      create: jest.fn<Promise<PreparationJobRecord>, [unknown]>(),
      findFirst: jest.fn<Promise<PreparationJobRecord | null>, [unknown]>(),
      findMany: jest.fn<Promise<PreparationJobRecord[]>, [unknown]>(),
      findUnique: jest.fn<Promise<PreparationJobRecord | null>, [unknown]>(),
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
    },
    $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
  };
  prisma.$transaction.mockImplementation((callback) =>
    Promise.resolve(callback(prisma)),
  );

  return {
    prisma,
    repository: new PrismaCourseQuestionBankPreparationRepository(
      prisma as never,
    ),
  };
}

function preparationJobRecord(
  overrides: Partial<PreparationJobRecord> = {},
): PreparationJobRecord {
  return {
    id: 'prep-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: 'course-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    targetQuestionCount: 10,
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    lockedAt: null,
    completedAt: null,
    createdAt: new Date('2026-06-22T09:00:00.000Z'),
    updatedAt: new Date('2026-06-22T09:00:00.000Z'),
    ...overrides,
  };
}
