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
        findMany: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

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
      where: { studentId: 'student-1' },
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
    prisma.subject.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteForStudent({
        subjectId: 'subject-1',
        studentId: 'student-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.subject.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
  });

  it('returns false when deleting an unknown or cross-student subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.deleteForStudent({
        subjectId: 'subject-2',
        studentId: 'student-1',
      }),
    ).resolves.toBe(false);
  });
});
