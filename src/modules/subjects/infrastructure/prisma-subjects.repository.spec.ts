import { PrismaSubjectsRepository } from './prisma-subjects.repository';

type SubjectRecord = {
  id: string;
  studentId: string;
  name: string;
  priority: number;
  createdAt: Date;
};

describe('PrismaSubjectsRepository', () => {
  const createdAt = new Date('2026-06-12T10:00:00.000Z');

  const createRepository = () => {
    const prisma = {
      subject: {
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      course: { count: jest.fn() },
      document: { count: jest.fn() },
      knowledgeUnit: { count: jest.fn() },
      masteryState: { count: jest.fn() },
      activitySession: { count: jest.fn() },
      revisionSession: { count: jest.fn() },
      summary: { count: jest.fn() },
      revisionSheet: { count: jest.fn() },
      openQuestion: { count: jest.fn() },
      openAnswerEvaluation: { count: jest.fn() },
      questionBankItem: { count: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) =>
        Promise.resolve(callback(prisma)),
    );

    return {
      prisma,
      repository: new PrismaSubjectsRepository(prisma as never),
    };
  };

  const record = (input: Partial<SubjectRecord> = {}): SubjectRecord => ({
    id: 'subject-1',
    studentId: 'student-1',
    name: 'Anatomie',
    priority: 2,
    createdAt,
    ...input,
  });

  it('creates a subject through Prisma and returns the domain entity', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.create.mockResolvedValue(record());

    const subject = await repository.create({
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 2,
    });

    expect(prisma.subject.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        name: 'Anatomie',
        priority: 2,
      },
    });
    expect(subject).toMatchObject({
      id: 'subject-1',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 2,
      createdAt,
    });
  });

  it('rejects invalid subject details before writing to Prisma', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.create({
        studentId: 'student-1',
        name: 'A',
        priority: 2,
      }),
    ).rejects.toThrow('Subject name must contain at least 2 characters');

    await expect(
      repository.create({
        studentId: 'student-1',
        name: 'Anatomie',
        priority: 6 as 1,
      }),
    ).rejects.toThrow('Subject priority must be between 1 and 5');

    expect(prisma.subject.create).not.toHaveBeenCalled();
  });

  it('finds subjects for a student ordered by creation time', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findMany.mockResolvedValue([
      record({ id: 'subject-1', name: 'Anatomie' }),
      record({ id: 'subject-2', name: 'Physique', priority: 4 }),
    ]);

    const subjects = await repository.findByStudent('student-1');

    expect(prisma.subject.findMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    expect(subjects).toHaveLength(2);
    expect(subjects[1]).toMatchObject({
      id: 'subject-2',
      studentId: 'student-1',
      name: 'Physique',
      priority: 4,
      createdAt,
    });
  });

  it('finds one subject by id for a student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(record({ id: 'subject-2' }));

    const subject = await repository.findByIdForStudent({
      subjectId: 'subject-2',
      studentId: 'student-1',
    });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-2',
        studentId: 'student-1',
        archivedAt: null,
      },
    });
    expect(subject).toMatchObject({
      id: 'subject-2',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 2,
      createdAt,
    });
  });

  it('returns null when a subject does not belong to the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.findByIdForStudent({
        subjectId: 'subject-2',
        studentId: 'student-1',
      }),
    ).resolves.toBeNull();
  });

  it('deletes one subject owned by a student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({
      id: 'subject-1',
      archivedAt: null,
    });
    mockSubjectLifecycleCounts(prisma, 0);
    prisma.subject.delete.mockResolvedValue(record());

    await expect(
      repository.deleteForStudent({
        subjectId: 'subject-1',
        studentId: 'student-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.subject.delete).toHaveBeenCalledWith({
      where: { id: 'subject-1' },
    });
  });

  it('returns false when deleting an unknown or cross-student subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteForStudent({
        subjectId: 'subject-2',
        studentId: 'student-1',
      }),
    ).resolves.toBe(false);
  });

  it('blocks deleting a subject with courses and keeps the database intact', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({
      id: 'subject-1',
      archivedAt: null,
    });
    mockSubjectLifecycleCounts(prisma, 0);
    prisma.course.count.mockResolvedValue(1);

    try {
      await repository.deleteForStudent({
        subjectId: 'subject-1',
        studentId: 'student-1',
      });
      throw new Error('Expected subject deletion to be blocked');
    } catch (error: unknown) {
      const blocked = error as {
        code: string;
        decision: {
          recommendedAction: string;
          blockingReasons: string[];
        };
      };
      expect(blocked.code).toBe('SUBJECT_DELETE_BLOCKED');
      expect(blocked.decision.recommendedAction).toBe('ARCHIVE');
      expect(blocked.decision.blockingReasons).toEqual(['HAS_COURSES']);
    }

    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });

  it('archives a used subject without deleting it', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({
      id: 'subject-1',
      archivedAt: null,
    });
    mockSubjectLifecycleCounts(prisma, 0);
    prisma.course.count.mockResolvedValue(1);
    prisma.subject.update.mockResolvedValue(record());

    const decision = await repository.archiveForStudent({
      subjectId: 'subject-1',
      studentId: 'student-1',
      reason: 'USER_ARCHIVED',
    });

    expect(decision).toMatchObject({
      subjectId: 'subject-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
    });
    const [updateInput] = prisma.subject.update.mock.calls[0] as [
      {
        where: { id: string };
        data: { archivedAt: Date; archivedReason: string };
      },
    ];
    expect(updateInput.where).toEqual({ id: 'subject-1' });
    expect(updateInput.data.archivedAt).toBeInstanceOf(Date);
    expect(updateInput.data.archivedReason).toBe('USER_ARCHIVED');
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });
});

type CountDelegateMock = { count: jest.Mock };

type SubjectLifecycleCountsMock = {
  course: CountDelegateMock;
  document: CountDelegateMock;
  knowledgeUnit: CountDelegateMock;
  masteryState: CountDelegateMock;
  activitySession: CountDelegateMock;
  revisionSession: CountDelegateMock;
  summary: CountDelegateMock;
  revisionSheet: CountDelegateMock;
  openQuestion: CountDelegateMock;
  openAnswerEvaluation: CountDelegateMock;
  questionBankItem: CountDelegateMock;
};

function mockSubjectLifecycleCounts(
  prisma: SubjectLifecycleCountsMock,
  value: number,
) {
  prisma.course.count.mockResolvedValue(value);
  prisma.document.count.mockResolvedValue(value);
  prisma.knowledgeUnit.count.mockResolvedValue(value);
  prisma.masteryState.count.mockResolvedValue(value);
  prisma.activitySession.count.mockResolvedValue(value);
  prisma.revisionSession.count.mockResolvedValue(value);
  prisma.summary.count.mockResolvedValue(value);
  prisma.revisionSheet.count.mockResolvedValue(value);
  prisma.openQuestion.count.mockResolvedValue(value);
  prisma.openAnswerEvaluation.count.mockResolvedValue(value);
  prisma.questionBankItem.count.mockResolvedValue(value);
}
