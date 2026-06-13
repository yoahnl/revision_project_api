import { PrismaRevisionRepository } from './prisma-revision.repository';

type RevisionGoalRecord = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
  createdAt: Date;
};

type KnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  title: string;
  summary: string;
  createdAt: Date;
};

type MasteryStateRecord = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
  updatedAt: Date;
};

describe('PrismaRevisionRepository', () => {
  const targetDate = new Date('2026-06-30T00:00:00.000Z');
  const createdAt = new Date('2026-06-12T10:00:00.000Z');
  const practicedAt = new Date('2026-06-12T12:00:00.000Z');

  const createRepository = () => {
    const prisma = {
      revisionGoal: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      knowledgeUnit: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      masteryState: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    return {
      prisma,
      repository: new PrismaRevisionRepository(prisma as never),
    };
  };

  const goalRecord = (
    input: Partial<RevisionGoalRecord> = {},
  ): RevisionGoalRecord => ({
    id: 'goal-1',
    studentId: 'student-1',
    targetDate,
    weeklyMinutes: 240,
    createdAt,
    ...input,
  });

  const knowledgeUnitRecord = (
    input: Partial<KnowledgeUnitRecord> = {},
  ): KnowledgeUnitRecord => ({
    id: 'unit-1',
    subjectId: 'subject-1',
    title: 'Cellules',
    summary: 'Bases de biologie cellulaire',
    createdAt,
    ...input,
  });

  const masteryRecord = (
    input: Partial<MasteryStateRecord> = {},
  ): MasteryStateRecord => ({
    studentId: 'student-1',
    subjectId: 'subject-1',
    knowledgeUnitId: 'unit-1',
    score: 0.6,
    lastPracticedAt: practicedAt,
    updatedAt: createdAt,
    ...input,
  });

  it('saves a valid revision goal through Prisma', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionGoal.create.mockResolvedValue(goalRecord());

    const goal = await repository.saveGoal({
      studentId: 'student-1',
      targetDate,
      weeklyMinutes: 240,
    });

    expect(prisma.revisionGoal.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        targetDate,
        weeklyMinutes: 240,
      },
    });
    expect(goal).toMatchObject({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate,
      weeklyMinutes: 240,
      createdAt,
    });
  });

  it('rejects invalid revision goals before writing to Prisma', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.saveGoal({
        studentId: 'student-1',
        targetDate,
        weeklyMinutes: 10,
      }),
    ).rejects.toThrow('Weekly revision time must be at least 30 minutes');

    expect(prisma.revisionGoal.create).not.toHaveBeenCalled();
  });

  it('rejects invalid mastery before ownership lookup or upsert', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.upsertMastery({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 1.2,
        lastPracticedAt: practicedAt,
      }),
    ).rejects.toThrow('Mastery score must be between 0 and 1');

    expect(prisma.knowledgeUnit.findFirst).not.toHaveBeenCalled();
    expect(prisma.masteryState.upsert).not.toHaveBeenCalled();
  });

  it('does not upsert mastery when the knowledge unit is not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue(null);

    await expect(
      repository.upsertMastery({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-2',
        score: 0.6,
        lastPracticedAt: practicedAt,
      }),
    ).rejects.toThrow('Knowledge unit does not belong to student');

    expect(prisma.knowledgeUnit.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unit-2',
        subject: {
          studentId: 'student-1',
        },
      },
    });
    expect(prisma.masteryState.upsert).not.toHaveBeenCalled();
  });

  it('upserts mastery after verifying the student owns the knowledge unit', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue(knowledgeUnitRecord());
    prisma.masteryState.upsert.mockResolvedValue(masteryRecord());

    const mastery = await repository.upsertMastery({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.6,
      lastPracticedAt: practicedAt,
    });

    expect(prisma.knowledgeUnit.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unit-1',
        subject: {
          studentId: 'student-1',
        },
      },
    });
    expect(prisma.masteryState.upsert).toHaveBeenCalledWith({
      where: {
        studentId_knowledgeUnitId: {
          studentId: 'student-1',
          knowledgeUnitId: 'unit-1',
        },
      },
      create: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        score: 0.6,
        lastPracticedAt: practicedAt,
      },
      update: {
        subjectId: 'subject-1',
        score: 0.6,
        lastPracticedAt: practicedAt,
      },
    });
    expect(mastery).toMatchObject({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.6,
      lastPracticedAt: practicedAt,
    });
  });
});
