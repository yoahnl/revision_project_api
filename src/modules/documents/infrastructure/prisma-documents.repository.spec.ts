import { PrismaDocumentsRepository } from './prisma-documents.repository';
import { SourceDeleteBlockedError } from '../domain/source-lifecycle.entity';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  errorCode?: string | null;
  archivedAt?: Date | null;
  archivedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaDocumentsMock = {
  subject: {
    findFirst: jest.Mock;
  };
  document: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  documentProcessingJob: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  documentFileCleanupJob: {
    create: jest.Mock;
  };
  knowledgeUnit: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  documentChunk: {
    count: jest.Mock;
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
  summary: {
    count: jest.Mock;
  };
  revisionSheet: {
    count: jest.Mock;
  };
  questionBankItem: {
    count: jest.Mock;
  };
  revisionSession: {
    count: jest.Mock;
  };
  revisionSessionAction: {
    count: jest.Mock;
  };
  openQuestion: {
    count: jest.Mock;
  };
  activitySession: {
    count: jest.Mock;
  };
  question: {
    count: jest.Mock;
  };
  richClosedExercisePayload: {
    count: jest.Mock;
  };
  knowledgeUnitSource: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

type TransactionCallback = (tx: PrismaDocumentsMock) => unknown;

describe('PrismaDocumentsRepository', () => {
  const createRepository = () => {
    const prisma: PrismaDocumentsMock = {
      subject: {
        findFirst: jest.fn(),
      },
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentProcessingJob: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      documentFileCleanupJob: {
        create: jest.fn(),
      },
      knowledgeUnit: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentChunk: {
        count: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      summary: { count: jest.fn() },
      revisionSheet: { count: jest.fn() },
      questionBankItem: { count: jest.fn() },
      revisionSession: { count: jest.fn() },
      revisionSessionAction: { count: jest.fn() },
      openQuestion: { count: jest.fn() },
      activitySession: { count: jest.fn() },
      question: { count: jest.fn() },
      richClosedExercisePayload: { count: jest.fn() },
      knowledgeUnitSource: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
    };
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prisma)),
    );
    mockZeroDependencyCounts(prisma);

    return {
      prisma,
      repository: new PrismaDocumentsRepository(prisma as never),
    };
  };

  const record = (input: Partial<DocumentRecord> = {}): DocumentRecord => ({
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    kind: 'COURSE_PDF',
    fileName: 'cours.pdf',
    storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    errorCode: null,
    archivedAt: null,
    archivedReason: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...input,
  });

  const mockZeroDependencyCounts = (prisma: PrismaDocumentsMock) => {
    prisma.documentChunk.count.mockResolvedValue(0);
    prisma.knowledgeUnit.count.mockResolvedValue(0);
    prisma.summary.count.mockResolvedValue(0);
    prisma.revisionSheet.count.mockResolvedValue(0);
    prisma.questionBankItem.count.mockResolvedValue(0);
    prisma.revisionSession.count.mockResolvedValue(0);
    prisma.revisionSessionAction.count.mockResolvedValue(0);
    prisma.openQuestion.count.mockResolvedValue(0);
    prisma.activitySession.count.mockResolvedValue(0);
    prisma.question.count.mockResolvedValue(0);
    prisma.richClosedExercisePayload.count.mockResolvedValue(0);
  };

  it('creates a document and pending processing job in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.create.mockResolvedValue(record());

    const document = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: ' cours.pdf ',
      storagePath: ' students/student-1/subjects/subject-1/cours.pdf ',
      mimeType: ' application/pdf ',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: null,
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(prisma.documentProcessingJob.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        status: 'PENDING',
      },
    });
    expect(document).toMatchObject({
      id: 'document-1',
      status: 'UPLOADED',
    });
  });

  it('creates a course-attached document when courseId is provided', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.create.mockResolvedValue(record({ courseId: 'course-1' }));

    const document = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
    });

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(document.courseId).toBe('course-1');
  });

  it('does not create a document when the subject is not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        studentId: 'student-1',
        subjectId: 'subject-2',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-2/cours.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.create).not.toHaveBeenCalled();
  });

  it('lists documents for a subject owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findMany.mockResolvedValue([
      record({ id: 'document-1' }),
      record({ id: 'document-2', status: 'READY' }),
    ]);

    const documents = await repository.findBySubjectForStudent({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        archivedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(documents.map((document) => document.id)).toEqual([
      'document-1',
      'document-2',
    ]);
  });

  it('rejects document listing for subjects not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.findBySubjectForStudent({
        studentId: 'student-1',
        subjectId: 'subject-2',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  it('finds a document by id for its student owner', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record());

    const document = await repository.findByIdForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        archivedAt: null,
      },
    });
    expect(document?.id).toBe('document-1');
  });

  it('finds a document by id for internal worker processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record());

    const document = await repository.findById('document-1');

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    expect(document?.storagePath).toBe(
      'students/student-1/subjects/subject-1/cours.pdf',
    );
  });

  it('returns the stored processing error code for failed documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({
        status: 'FAILED',
        errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
      }),
    );

    const document = await repository.findByIdForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(document).toMatchObject({
      id: 'document-1',
      status: 'FAILED',
      errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
    });
  });

  it('deletes a safe document owned by a student and creates a cleanup job transactionally', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'FAILED' }));
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });
    prisma.documentFileCleanupJob.create.mockResolvedValue({
      id: 'cleanup-1',
    });

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).resolves.toEqual({
      deleted: true,
      cleanupJobId: 'cleanup-1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        storagePath: true,
        status: true,
        archivedAt: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.documentFileCleanupJob.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        studentId: 'student-1',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        reason: 'DOCUMENT_SAFE_DELETE',
        status: 'PENDING',
      },
      select: { id: true },
    });
  });

  it('returns false without deleting dependents for unknown or cross-student documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-2',
      }),
    ).resolves.toEqual({
      deleted: false,
      cleanupJobId: null,
    });

    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentFileCleanupJob.create).not.toHaveBeenCalled();
  });

  it('does not create cleanup when the safe delete loses a concurrent race', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'FAILED' }));
    prisma.document.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).resolves.toEqual({
      deleted: false,
      cleanupJobId: null,
    });

    expect(prisma.documentFileCleanupJob.create).not.toHaveBeenCalled();
  });

  it('blocks deletion and recommends archive when a document has learning history', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.count.mockResolvedValue(2);

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(SourceDeleteBlockedError);

    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentFileCleanupJob.create).not.toHaveBeenCalled();
  });

  it('returns a lifecycle decision for a source with learning dependencies', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ status: 'READY', courseId: 'course-1' }),
    );
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.revisionSession.count.mockResolvedValue(1);

    await expect(
      repository.getLifecycleDecisionForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      courseId: 'course-1',
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      blockingReasons: ['HAS_DOCUMENT_CHUNKS', 'HAS_REVISION_SESSIONS'],
    });
  });

  it('archives an active source without deleting dependents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ status: 'READY', courseId: 'course-1' }),
    );
    prisma.knowledgeUnit.count.mockResolvedValue(1);
    prisma.document.updateMany.mockResolvedValue({ count: 1 });

    const decision = await repository.archiveForStudent({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
      reason: 'USER_ARCHIVED_COURSE_SOURCE',
    });

    expect(decision).toMatchObject({
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
    });
    expect(prisma.document.updateMany).toHaveBeenCalledTimes(1);
    const updateManyCalls = prisma.document.updateMany.mock.calls as [
      [
        {
          where: { id: string; studentId: string; archivedAt: null };
          data: { archivedAt: unknown; archivedReason: string };
        },
      ],
    ];
    const updateInput = updateManyCalls[0][0];
    expect(updateInput?.where).toEqual({
      id: 'document-1',
      studentId: 'student-1',
      archivedAt: null,
    });
    expect(updateInput?.data.archivedAt).toBeInstanceOf(Date);
    expect(updateInput?.data.archivedReason).toBe(
      'USER_ARCHIVED_COURSE_SOURCE',
    );
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentFileCleanupJob.create).not.toHaveBeenCalled();
  });

  it('deletes a safe course document and creates a cleanup job with course delete reason', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ courseId: 'course-1', status: 'FAILED' }),
    );
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });
    prisma.documentFileCleanupJob.create.mockResolvedValue({
      id: 'cleanup-course-1',
    });

    await expect(
      repository.deleteCourseDocumentForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toEqual({
      deleted: true,
      cleanupJobId: 'cleanup-course-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        courseId: 'course-1',
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        storagePath: true,
        status: true,
        archivedAt: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        courseId: 'course-1',
      },
    });
    expect(prisma.documentFileCleanupJob.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        studentId: 'student-1',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        reason: 'COURSE_SOURCE_SAFE_DELETE',
        status: 'PENDING',
      },
      select: { id: true },
    });
  });

  it('does not delete a course document when the document is outside the requested course', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteCourseDocumentForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-2',
      }),
    ).resolves.toEqual({
      deleted: false,
      cleanupJobId: null,
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-2',
        studentId: 'student-1',
        courseId: 'course-1',
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        storagePath: true,
        status: true,
        archivedAt: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentFileCleanupJob.create).not.toHaveBeenCalled();
  });

  it('marks uploaded documents as processing and records the running job', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markProcessing('document-1');

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: 'UPLOADED' },
      data: { status: 'PROCESSING', errorCode: null },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1', status: 'PENDING' },
      data: { status: 'RUNNING' },
    });
  });

  it('rejects processing transitions from non-uploaded documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markProcessing('document-1')).rejects.toThrow(
      'Document is not uploaded',
    );

    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects processing transitions when no pending job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markProcessing('document-1')).rejects.toThrow(
      'Document processing job is not pending',
    );
  });

  it('marks processing documents ready with extracted knowledge units', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: ' Cellules ', summary: ' Bases ' }],
    });

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    expect(prisma.knowledgeUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          title: 'Cellules',
          summary: 'Bases',
        },
      ],
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: 'PROCESSING' },
      data: { status: 'READY', errorCode: null },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1', status: 'RUNNING' },
      data: { status: 'COMPLETED' },
    });
  });

  it('persists optional enrichment fields when marking knowledge units ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [
        {
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v1',
          extractionSchemaVersion: 'extracted-knowledge-v1',
        },
      ],
    });

    expect(prisma.knowledgeUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v1',
          extractionSchemaVersion: 'extracted-knowledge-v1',
        },
      ],
    });
  });

  it('creates knowledge unit sources when marking sourced units ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1' },
      { id: 'chunk-2' },
    ]);
    prisma.knowledgeUnit.create.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [
        {
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          sourceChunkIds: ['chunk-2', 'chunk-1', 'chunk-2'],
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v2',
          extractionSchemaVersion: 'extracted-knowledge-v2',
        },
      ],
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-2', 'chunk-1'] },
        subjectId: 'subject-1',
        documentId: 'document-1',
      },
      select: { id: true },
    });
    expect(prisma.knowledgeUnit.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        subjectId: 'subject-1',
        title: 'Séparation des pouvoirs',
        summary: 'Principe structurant les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 2,
        confidence: 0.84,
        extractionPromptVersion: 'document-knowledge-v2',
        extractionSchemaVersion: 'extracted-knowledge-v2',
      },
    });
    expect(prisma.knowledgeUnitSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: null,
        },
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: null,
        },
      ],
    });
    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
  });

  it('rejects sourced ready transitions when a source chunk belongs to another document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.documentChunk.findMany.mockResolvedValue([{ id: 'chunk-1' }]);

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: ['chunk-1', 'chunk-other-document'],
          },
        ],
      }),
    ).rejects.toThrow('Knowledge unit source chunk not found');

    expect(prisma.knowledgeUnit.create).not.toHaveBeenCalled();
    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('does not duplicate knowledge units when a document is already ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: 'Cellules', summary: 'Bases' }],
    });

    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ready transitions from documents that are not processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'UPLOADED' }),
    );

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [{ title: 'Cellules', summary: 'Bases' }],
      }),
    ).rejects.toThrow('Document is not processing');

    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ready transitions when no running job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [],
      }),
    ).rejects.toThrow('Document processing job is not running');
  });

  it('marks uploaded or processing documents failed', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markFailed({
      documentId: 'document-1',
      errorCode: 'EXTRACTION_FAILED',
    });

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: { in: ['UPLOADED', 'PROCESSING'] } },
      data: { status: 'FAILED', errorCode: 'EXTRACTION_FAILED' },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'FAILED' },
    });
  });

  it('does not fail completed documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await expect(
      repository.markFailed({
        documentId: 'document-1',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).rejects.toThrow('Document is already ready');

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects failure transitions when no active job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markFailed({
        documentId: 'document-1',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).rejects.toThrow('Document processing job is not active');
  });

  it('replaces chunks for a processing document in index order', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );

    await repository.replaceChunks({
      documentId: 'document-1',
      chunks: [
        {
          index: 1,
          text: 'Deuxieme bloc',
          charStart: 15,
          charEnd: 28,
          pageNumber: null,
        },
        {
          index: 0,
          text: 'Premier bloc',
          charStart: 0,
          charEnd: 13,
        },
      ],
    });

    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
    });
    expect(prisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          index: 0,
          text: 'Premier bloc',
          charStart: 0,
          charEnd: 13,
          pageNumber: null,
        },
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          index: 1,
          text: 'Deuxieme bloc',
          charStart: 15,
          charEnd: 28,
          pageNumber: null,
        },
      ],
    });
  });

  it('replaces existing chunks with an empty list without creating rows', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );

    await repository.replaceChunks({
      documentId: 'document-1',
      chunks: [],
    });

    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
    });
    expect(prisma.documentChunk.createMany).not.toHaveBeenCalled();
  });

  it('rejects chunk replacement when the document is not processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await expect(
      repository.replaceChunks({
        documentId: 'document-1',
        chunks: [{ index: 0, text: 'Bloc', charStart: 0, charEnd: 4 }],
      }),
    ).rejects.toThrow('Document is not processing');

    expect(prisma.documentChunk.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentChunk.createMany).not.toHaveBeenCalled();
  });

  it('lists document chunks by ascending index', async () => {
    const { prisma, repository } = createRepository();
    const createdAt = new Date('2026-06-14T12:00:00.000Z');
    prisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Premier bloc',
        charStart: 0,
        charEnd: 13,
        pageNumber: null,
        createdAt,
      },
    ]);

    const chunks = await repository.findChunksByDocumentId('document-1');

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
      orderBy: { index: 'asc' },
    });
    expect(chunks).toEqual([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Premier bloc',
        charStart: 0,
        charEnd: 13,
        pageNumber: null,
        createdAt,
      },
    ]);
  });

  it('lists sourced knowledge units for a student document in stable order', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      {
        id: 'unit-1',
        title: 'Séparation des pouvoirs',
        summary: 'Principe structurant les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 1,
        confidence: 0.84,
        sources: [
          {
            chunkId: 'chunk-2',
            chunk: {
              text: 'Second extrait.',
              pageNumber: null,
              index: 1,
            },
          },
          {
            chunkId: 'chunk-1',
            chunk: {
              text: 'Premier extrait.',
              pageNumber: null,
              index: 0,
            },
          },
        ],
      },
    ]);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        archivedAt: null,
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        subject: {
          studentId: 'student-1',
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });
    expect(response).toEqual({
      documentId: 'document-1',
      documentStatus: 'READY',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Premier extrait.',
              pageNumber: null,
              index: 0,
            },
            {
              chunkId: 'chunk-2',
              text: 'Second extrait.',
              pageNumber: null,
              index: 1,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('storagePath');
  });

  it('returns null when listing knowledge units for another student document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-2',
      documentId: 'document-1',
    });

    expect(response).toBeNull();
    expect(prisma.knowledgeUnit.findMany).not.toHaveBeenCalled();
  });

  it('does not return chunks that are not linked as sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      {
        id: 'unit-1',
        title: 'Constitution',
        summary: 'Norme fondamentale.',
        difficulty: null,
        displayOrder: null,
        confidence: null,
        sources: [],
      },
    ]);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(response?.items[0]?.sources).toEqual([]);
  });

  it('persists knowledge unit sources only for chunks in the same subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findUnique.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1' },
      { id: 'chunk-2' },
    ]);

    await repository.replaceKnowledgeUnitSources({
      knowledgeUnitId: 'knowledge-unit-1',
      subjectId: 'subject-1',
      sources: [
        { chunkId: 'chunk-2', relevanceScore: 0.7 },
        { chunkId: 'chunk-1', relevanceScore: null },
      ],
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-2', 'chunk-1'] },
        subjectId: 'subject-1',
      },
      select: { id: true },
    });
    expect(prisma.knowledgeUnitSource.deleteMany).toHaveBeenCalledWith({
      where: {
        knowledgeUnitId: 'knowledge-unit-1',
        subjectId: 'subject-1',
      },
    });
    expect(prisma.knowledgeUnitSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: 0.7,
        },
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: null,
        },
      ],
    });
  });

  it('rejects knowledge unit sources pointing to unknown chunks', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findUnique.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([{ id: 'chunk-1' }]);

    await expect(
      repository.replaceKnowledgeUnitSources({
        knowledgeUnitId: 'knowledge-unit-1',
        subjectId: 'subject-1',
        sources: [
          { chunkId: 'chunk-1', relevanceScore: 0.9 },
          { chunkId: 'chunk-unknown', relevanceScore: 0.5 },
        ],
      }),
    ).rejects.toThrow('Knowledge unit source chunk not found');

    expect(prisma.knowledgeUnitSource.deleteMany).not.toHaveBeenCalled();
    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
  });

  it('does not create knowledge unit sources while marking ready without source ids', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: 'Constitution', summary: 'Norme fondamentale.' }],
    });

    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
  });
});
