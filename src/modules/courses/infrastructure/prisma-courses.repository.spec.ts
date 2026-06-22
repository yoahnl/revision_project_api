import { PrismaCoursesRepository } from './prisma-courses.repository';

describe('PrismaCoursesRepository', () => {
  it('creates a course only when the subject belongs to the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.aggregate.mockResolvedValue({ _max: { displayOrder: 1 } });
    prisma.course.create.mockResolvedValue(courseRecord({ displayOrder: 2 }));

    const result = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Loi normale',
      description: null,
      chapterLabel: 'Chapitre 3',
      estimatedMinutes: 20,
    });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-1', studentId: 'student-1', archivedAt: null },
      select: { id: true },
    });
    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Loi normale',
        description: null,
        chapterLabel: 'Chapitre 3',
        estimatedMinutes: 20,
        displayOrder: 2,
      },
    });
    expect(result.displayOrder).toBe(2);
  });

  it('refuses course creation for a subject owned by another student', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        studentId: 'student-2',
        subjectId: 'subject-1',
        title: 'Loi normale',
      }),
    ).rejects.toThrow('Course subject not found');

    expect(prisma.course.create).not.toHaveBeenCalled();
  });

  it('lists courses for one owned subject sorted by display order and creation date', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1' }),
      courseRecord({ id: 'course-2', title: 'Loi binomiale' }),
    ]);

    const result = await repository.listBySubjectForStudent({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(prisma.course.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        archivedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    expect(result.map((course) => course.id)).toEqual(['course-1', 'course-2']);
  });

  it('does not return a course owned by another student', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      repository.findByIdForStudent({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();

    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
        studentId: 'student-2',
        archivedAt: null,
        subject: { archivedAt: null },
      },
    });
  });

  it('does not return a course when its parent subject is archived', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      repository.findByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();

    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
        studentId: 'student-1',
        archivedAt: null,
        subject: { archivedAt: null },
      },
    });
  });

  it('allows duplicate titles in the same subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.aggregate.mockResolvedValue({ _max: { displayOrder: 0 } });
    prisma.course.create
      .mockResolvedValueOnce(courseRecord({ id: 'course-1', displayOrder: 1 }))
      .mockResolvedValueOnce(courseRecord({ id: 'course-2', displayOrder: 2 }));

    await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Loi normale',
    });
    await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Loi normale',
    });

    expect(prisma.course.create).toHaveBeenCalledTimes(2);
  });

  it('deletes an empty course without deleting documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(
      courseRecord({ archivedAt: null }),
    );
    prisma.document.count.mockResolvedValue(0);
    prisma.revisionSession.count.mockResolvedValue(0);
    prisma.questionBankItem.count.mockResolvedValue(0);
    prisma.course.delete.mockResolvedValue(courseRecord());

    await expect(
      repository.deleteIfEmpty({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.document.count).toHaveBeenCalledWith({
      where: { courseId: 'course-1', studentId: 'student-1' },
    });
    expect(prisma.course.delete).toHaveBeenCalledWith({
      where: { id: 'course-1' },
    });
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks deleting a used course and returns the lifecycle decision', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(
      courseRecord({ archivedAt: null }),
    );
    prisma.document.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prisma.revisionSession.count.mockResolvedValue(1);
    prisma.questionBankItem.count.mockResolvedValue(1);

    try {
      await repository.deleteIfEmpty({
        studentId: 'student-1',
        courseId: 'course-1',
      });
      throw new Error('Expected course deletion to be blocked');
    } catch (error: unknown) {
      const blocked = error as {
        code: string;
        decision: {
          recommendedAction: string;
          blockingReasons: string[];
        };
      };
      expect(blocked.code).toBe('COURSE_DELETE_BLOCKED');
      expect(blocked.decision.recommendedAction).toBe('ARCHIVE');
      expect(blocked.decision.blockingReasons).toEqual([
        'HAS_DOCUMENTS',
        'HAS_REVISION_SESSIONS',
        'HAS_QUESTION_BANK_ITEMS',
      ]);
    }

    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('archives a used course without deleting it', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(
      courseRecord({ archivedAt: null }),
    );
    prisma.document.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prisma.revisionSession.count.mockResolvedValue(0);
    prisma.questionBankItem.count.mockResolvedValue(0);
    prisma.course.update.mockResolvedValue(courseRecord());

    const decision = await repository.archiveForStudent({
      studentId: 'student-1',
      courseId: 'course-1',
      reason: 'USER_ARCHIVED',
    });

    expect(decision).toMatchObject({
      courseId: 'course-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
    });
    const [updateInput] = prisma.course.update.mock.calls[0] as [
      {
        where: { id: string };
        data: { archivedAt: Date; archivedReason: string };
      },
    ];
    expect(updateInput.where).toEqual({ id: 'course-1' });
    expect(updateInput.data.archivedAt).toBeInstanceOf(Date);
    expect(updateInput.data.archivedReason).toBe('USER_ARCHIVED');
    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('updates a course and returns active source counters', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(courseRecord({ id: 'course-1' }));
    prisma.course.update.mockResolvedValue(
      courseRecord({ id: 'course-1', title: 'Droit public' }),
    );
    prisma.document.findMany.mockResolvedValue([
      documentRecord({ courseId: 'course-1', status: 'READY' }),
      documentRecord({
        id: 'document-2',
        courseId: 'course-1',
        status: 'PROCESSING',
      }),
      documentRecord({
        id: 'document-3',
        courseId: 'course-1',
        status: 'FAILED',
      }),
    ]);

    const updated = await repository.updateForStudent({
      studentId: 'student-1',
      courseId: 'course-1',
      title: 'Droit public',
    });

    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
        studentId: 'student-1',
        archivedAt: null,
        subject: { archivedAt: null },
      },
      select: { id: true },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        archivedAt: null,
      },
      select: {
        status: true,
      },
    });
    expect(updated).toMatchObject({
      title: 'Droit public',
      sourceCount: 3,
      readySourceCount: 1,
      processingSourceCount: 1,
      failedSourceCount: 1,
    });
  });

  it('keeps document/course ownership coherent when attaching a document', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({ subjectId: 'subject-1' }),
    );
    prisma.document.update.mockResolvedValue(
      documentRecord({ courseId: 'course-1' }),
    );

    await expect(
      repository.attachDocumentToCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toMatchObject({
      id: 'document-1',
      courseId: 'course-1',
      subjectId: 'subject-1',
    });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: { courseId: 'course-1' },
    });
  });

  it('refuses active course ownership when the parent subject is archived', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      repository.findCourseOwnershipContext({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();

    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
        studentId: 'student-1',
        archivedAt: null,
        subject: { archivedAt: null },
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
      },
    });
  });

  it('refuses to attach a document to a course from another subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({ subjectId: 'subject-2' }),
    );

    await expect(
      repository.attachDocumentToCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).rejects.toThrow('Document subject does not match course');

    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('refuses to attach a document owned by another student', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.attachDocumentToCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-2',
      }),
    ).rejects.toThrow('Document not found');

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'document-2', studentId: 'student-1' },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        fileName: true,
      },
    });
  });

  it('rejects course detail documents missing courseId instead of returning an empty courseId', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(
      courseRecord({
        subject: { id: 'subject-1', name: 'Droit constitutionnel' },
        documents: [
          {
            id: 'document-1',
            courseId: null,
            fileName: 'cours.pdf',
            kind: 'COURSE_PDF',
            status: 'READY',
            errorCode: null,
            createdAt: new Date('2026-06-18T12:00:00.000Z'),
            updatedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
    );

    await expect(
      repository.findDetailByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Attached course document is missing courseId');
  });

  it('selects the first READY course PDF source deterministically', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({
        id: 'document-ready-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-18T10:00:00.000Z'),
        updatedAt: new Date('2026-06-18T10:00:00.000Z'),
      }),
    );

    await expect(
      repository.findFirstReadyCoursePdfDocumentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toMatchObject({
      id: 'document-ready-1',
      documentId: 'document-ready-1',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      status: 'READY',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        status: 'READY',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        fileName: true,
        kind: true,
        status: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('returns null when a course has no READY course PDF source', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.findFirstReadyCoursePdfDocumentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();
  });

  it('selects a quick revision knowledge unit from the READY course document', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      knowledgeUnitRecord({
        id: 'unit-strong',
        displayOrder: 0,
        mastery: [{ score: 0.8, lastPracticedAt: null }],
      }),
      knowledgeUnitRecord({
        id: 'unit-weak',
        displayOrder: 1,
        mastery: [
          {
            score: 0.2,
            lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
          },
        ],
      }),
    ]);

    await expect(
      repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument({
        studentId: 'student-1',
        courseId: 'course-1',
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
      }),
    ).resolves.toMatchObject({
      id: 'unit-weak',
      subjectId: 'subject-1',
      documentId: 'document-ready-1',
    });

    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
        subject: { studentId: 'student-1' },
        document: {
          id: 'document-ready-1',
          studentId: 'student-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        subjectId: true,
        documentId: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        mastery: {
          where: { studentId: 'student-1' },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    });
  });

  it('returns all quick revision knowledge units from READY course documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      knowledgeUnitRecord({
        id: 'unit-strong',
        documentId: 'document-ready-1',
        displayOrder: 0,
        mastery: [{ score: 0.8, lastPracticedAt: null }],
      }),
      knowledgeUnitRecord({
        id: 'unit-weak',
        documentId: 'document-ready-2',
        displayOrder: 1,
        mastery: [
          {
            score: 0.2,
            lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
          },
        ],
      }),
    ]);

    await expect(
      repository.findReadyQuickRevisionKnowledgeUnitsForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        subjectId: 'subject-1',
      }),
    ).resolves.toEqual([
      {
        id: 'unit-weak',
        subjectId: 'subject-1',
        documentId: 'document-ready-2',
        title: 'Contrôle parlementaire',
      },
      {
        id: 'unit-strong',
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
        title: 'Contrôle parlementaire',
      },
    ]);

    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1', archivedAt: null },
        document: {
          studentId: 'student-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        subjectId: true,
        documentId: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        mastery: {
          where: { studentId: 'student-1' },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    });
  });

  it('returns null when a READY course document has no knowledge unit', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findMany.mockResolvedValue([]);

    await expect(
      repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument({
        studentId: 'student-1',
        courseId: 'course-1',
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
      }),
    ).resolves.toBeNull();
  });

  it('computes course progress from READY course PDF knowledge units only', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findMany.mockResolvedValue([
      progressDocument({ id: 'ready-doc', status: 'READY' }),
      progressDocument({ id: 'uploaded-doc', status: 'UPLOADED' }),
      progressDocument({ id: 'failed-doc', status: 'FAILED' }),
    ]);
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      progressKnowledgeUnit({
        id: 'unit-1',
        documentId: 'ready-doc',
        mastery: [
          {
            score: 0.8,
            lastPracticedAt: new Date('2026-06-18T10:00:00.000Z'),
          },
        ],
      }),
      progressKnowledgeUnit({
        id: 'unit-2',
        documentId: 'ready-doc',
        mastery: [
          {
            score: 0.6,
            lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
      progressKnowledgeUnit({
        id: 'unit-3',
        documentId: 'ready-doc',
        mastery: [],
      }),
      progressKnowledgeUnit({
        id: 'unit-4',
        documentId: 'ready-doc',
        mastery: [],
      }),
    ]);

    await expect(
      repository.findCourseProgressByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toEqual({
      courseId: 'course-1',
      subjectId: 'subject-1',
      knowledgeUnitCount: 4,
      practicedKnowledgeUnitCount: 2,
      coverage: 0.5,
      mastery: 0.7,
      estimatedGlobalMastery: 0.35,
      readySourceCount: 1,
      processingSourceCount: 1,
      failedSourceCount: 1,
      lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
      state: 'PRACTICED',
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        documentId: { in: ['ready-doc'] },
        subject: { studentId: 'student-1' },
        document: {
          studentId: 'student-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        documentId: true,
        mastery: {
          where: { studentId: 'student-1' },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    });
  });

  it.each([
    {
      label: 'NO_SOURCE',
      documents: [],
      knowledgeUnits: [],
      expected: {
        state: 'NO_SOURCE',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 0,
        processingSourceCount: 0,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
    {
      label: 'PROCESSING',
      documents: [
        progressDocument({ id: 'uploaded-doc', status: 'UPLOADED' }),
        progressDocument({ id: 'processing-doc', status: 'PROCESSING' }),
      ],
      knowledgeUnits: [],
      expected: {
        state: 'PROCESSING',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 0,
        processingSourceCount: 2,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
    {
      label: 'FAILED_ONLY',
      documents: [progressDocument({ id: 'failed-doc', status: 'FAILED' })],
      knowledgeUnits: [],
      expected: {
        state: 'FAILED_ONLY',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 0,
        processingSourceCount: 0,
        failedSourceCount: 1,
        lastPracticedAt: null,
      },
    },
    {
      label: 'NO_KNOWLEDGE_UNITS',
      documents: [progressDocument({ id: 'ready-doc', status: 'READY' })],
      knowledgeUnits: [],
      expected: {
        state: 'NO_KNOWLEDGE_UNITS',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 1,
        processingSourceCount: 0,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
    {
      label: 'READY_NOT_PRACTICED',
      documents: [progressDocument({ id: 'ready-doc', status: 'READY' })],
      knowledgeUnits: [
        progressKnowledgeUnit({ id: 'unit-1', documentId: 'ready-doc' }),
      ],
      expected: {
        state: 'READY_NOT_PRACTICED',
        knowledgeUnitCount: 1,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 1,
        processingSourceCount: 0,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
  ])('computes $label course progress state', async (scenario) => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findMany.mockResolvedValue(scenario.documents);
    prisma.knowledgeUnit.findMany.mockResolvedValue(scenario.knowledgeUnits);

    await expect(
      repository.findCourseProgressByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toEqual({
      courseId: 'course-1',
      subjectId: 'subject-1',
      ...scenario.expected,
    });

    if (scenario.documents.some((document) => document.status === 'READY')) {
      expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledTimes(1);
    } else {
      expect(prisma.knowledgeUnit.findMany).not.toHaveBeenCalled();
    }
  });

  it('aggregates subject progress across real courses without legacy documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1', title: 'Institutions' }),
      courseRecord({ id: 'course-2', title: 'Procédure' }),
    ]);
    prisma.document.findMany.mockResolvedValue([
      progressDocument({ id: 'doc-1', courseId: 'course-1', status: 'READY' }),
      progressDocument({
        id: 'doc-2',
        courseId: 'course-2',
        status: 'PROCESSING',
      }),
    ]);
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      progressKnowledgeUnit({
        id: 'unit-1',
        documentId: 'doc-1',
        mastery: [
          {
            score: 0.75,
            lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
      progressKnowledgeUnit({
        id: 'unit-2',
        documentId: 'doc-1',
        mastery: [],
      }),
    ]);

    await expect(
      repository.findSubjectProgressForStudent({
        studentId: 'student-1',
        subjectId: 'subject-1',
      }),
    ).resolves.toMatchObject({
      subjectId: 'subject-1',
      knowledgeUnitCount: 2,
      practicedKnowledgeUnitCount: 1,
      coverage: 0.5,
      mastery: 0.75,
      estimatedGlobalMastery: 0.375,
      courseCount: 2,
      readyCourseCount: 1,
      courses: [
        {
          courseId: 'course-1',
          title: 'Institutions',
          state: 'PRACTICED',
        },
        {
          courseId: 'course-2',
          title: 'Procédure',
          state: 'PROCESSING',
        },
      ],
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: { in: ['course-1', 'course-2'] },
        kind: 'COURSE_PDF',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    });
  });

  it('produces an idempotent dry-run backfill without writes', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findMany.mockResolvedValue([
      documentRecord({ id: 'document-1', fileName: 'Cours_stats_S1.pdf' }),
      documentRecord({ id: 'document-2', fileName: 'TD loi normale.PDF' }),
    ]);

    const result = await repository.backfillFromExistingDocumentsDryRun();

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { kind: 'COURSE_PDF', courseId: null, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        fileName: true,
      },
    });
    expect(result).toEqual({
      documentsWithoutCourseCount: 2,
      coursesToCreateCount: 2,
      documentsToAttachCount: 2,
      items: [
        {
          documentId: 'document-1',
          studentId: 'student-1',
          subjectId: 'subject-1',
          proposedTitle: 'Cours stats S1',
        },
        {
          documentId: 'document-2',
          studentId: 'student-1',
          subjectId: 'subject-1',
          proposedTitle: 'TD loi normale',
        },
      ],
    });
    expect(prisma.course.create).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});

type PrismaCoursesMock = ReturnType<typeof createPrismaMock>;
type TransactionCallback = (tx: PrismaCoursesMock) => Promise<unknown>;

function createRepository() {
  const prisma = createPrismaMock();

  return {
    prisma,
    repository: new PrismaCoursesRepository(prisma as never),
  };
}

function createPrismaMock() {
  return {
    subject: {
      findFirst: jest.fn(),
    },
    course: {
      aggregate: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    document: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    knowledgeUnit: {
      findMany: jest.fn(),
    },
    revisionSession: {
      count: jest.fn(),
    },
    questionBankItem: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Loi normale',
    description: null,
    chapterLabel: null,
    estimatedMinutes: 20,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    fileName: 'Cours stats S1.pdf',
    ...overrides,
  };
}

function progressDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    status: 'READY',
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function progressKnowledgeUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    documentId: 'document-1',
    mastery: [],
    ...overrides,
  };
}

function knowledgeUnitRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    subjectId: 'subject-1',
    documentId: 'document-ready-1',
    title: 'Contrôle parlementaire',
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    mastery: [],
    ...overrides,
  };
}
