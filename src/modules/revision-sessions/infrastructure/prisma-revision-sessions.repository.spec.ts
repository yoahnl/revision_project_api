import { PrismaRevisionSessionsRepository } from './prisma-revision-sessions.repository';

describe('PrismaRevisionSessionsRepository', () => {
  it('validates subject, document and knowledge unit ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findFirst.mockResolvedValue({ id: 'document-1' });
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      documentId: 'document-1',
      title: 'Notion 1',
    });

    await expect(
      repository.ensureStartContext({
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).resolves.toEqual({
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnitTitle: 'Notion 1',
    });
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-1', studentId: 'student-1' },
      select: { id: true },
    });
  });

  it('rejects cross-student context as not found', async () => {
    const { repository } = createRepository();

    await expect(
      repository.ensureStartContext({
        studentId: 'student-2',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('Revision subject not found');
  });

  it('persists a session and initial action in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(actionRecord());

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        status: 'STARTED',
      },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.history).toHaveLength(1);
    expect(result.currentAction?.kind).toBe('OPEN_QUESTION');
  });

  it('persists a rich closed session action without activity session id', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(
      actionRecord({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
      }),
    );

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(result.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
  });

  it('loads an owned session with sorted action history', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [actionRecord()],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    expect(result.currentAction?.payload).toEqual({
      type: 'open_question',
      sessionId: 'activity-session-1',
    });
  });

  it('loads a planning context with action activity knowledge units and candidates', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [
        {
          ...actionRecord(),
          knowledgeUnitId: null,
          activitySession: { knowledgeUnitId: 'unit-from-activity' },
        },
      ],
    });
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);

    const result = await repository.findPlanningContextByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1' },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });
    expect(result.actions[0]?.knowledgeUnitId).toBe('unit-from-activity');
    expect(result.allowedKnowledgeUnitIds).toEqual([
      'unit-1',
      'unit-from-activity',
    ]);
    expect(result.allowedKnowledgeUnits).toEqual([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);
  });

  it('appends an action with the next display order inside a transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst
      .mockResolvedValueOnce(revisionSessionRecord())
      .mockResolvedValueOnce({
        ...revisionSessionRecord(),
        actions: [
          actionRecord(),
          { ...actionRecord(), id: 'action-2', displayOrder: 1 },
        ],
      });
    prisma.revisionSessionAction.aggregate.mockResolvedValue({
      _max: { displayOrder: 0 },
    });
    prisma.revisionSessionAction.create.mockResolvedValue({
      ...actionRecord(),
      id: 'action-2',
      displayOrder: 1,
      activitySessionId: 'quiz-session-2',
      kind: 'DIAGNOSTIC_QUIZ',
      documentId: null,
      knowledgeUnitId: null,
    });

    const result = await repository.appendAction({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      action: {
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });

    expect(prisma.revisionSessionAction.aggregate).toHaveBeenCalledWith({
      where: { sessionId: 'revision-session-1' },
      _max: { displayOrder: true },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 1,
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });
    expect(result.history).toHaveLength(2);
    expect(result.currentAction?.displayOrder).toBe(1);
  });
});

type PrismaRevisionSessionsMock = ReturnType<typeof createPrismaMock>;
type TransactionCallback = (tx: PrismaRevisionSessionsMock) => Promise<unknown>;

function createRepository() {
  const prisma = createPrismaMock();

  return {
    prisma,
    repository: new PrismaRevisionSessionsRepository(prisma as never),
  };
}

function createPrismaMock() {
  const prisma = {
    subject: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    knowledgeUnit: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    revisionSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    revisionSessionAction: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return prisma;
}

function revisionSessionRecord() {
  return {
    id: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    status: 'STARTED',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    updatedAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}

function actionRecord(
  overrides: Partial<ReturnType<typeof actionRecordShape>> = {},
) {
  return { ...actionRecordShape(), ...overrides };
}

function actionRecordShape() {
  return {
    id: 'action-1',
    sessionId: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    kind: 'OPEN_QUESTION',
    status: 'READY',
    displayOrder: 0,
    activitySessionId: 'activity-session-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}
