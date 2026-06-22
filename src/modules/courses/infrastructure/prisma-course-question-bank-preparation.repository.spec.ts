import { PrismaCourseQuestionBankPreparationRepository } from './prisma-course-question-bank-preparation.repository';

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
});

function createRepository() {
  const prisma = {
    courseQuestionBankPreparationJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return {
    prisma,
    repository: new PrismaCourseQuestionBankPreparationRepository(
      prisma as never,
    ),
  };
}

function preparationJobRecord(overrides: Record<string, unknown> = {}) {
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
