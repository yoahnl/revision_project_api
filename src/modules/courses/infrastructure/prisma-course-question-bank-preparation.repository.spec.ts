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
});

function createRepository() {
  const prisma = {
    courseQuestionBankPreparationJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
