import { PrismaDocumentsRepository } from './prisma-documents.repository';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  errorCode?: string | null;
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
  };
  documentProcessingJob: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  knowledgeUnit: {
    findUnique: jest.Mock;
    createMany: jest.Mock;
  };
  documentChunk: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
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
      },
      documentProcessingJob: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      knowledgeUnit: {
        findUnique: jest.fn(),
        createMany: jest.fn(),
      },
      documentChunk: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      knowledgeUnitSource: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
    };
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prisma)),
    );

    return {
      prisma,
      repository: new PrismaDocumentsRepository(prisma as never),
    };
  };

  const record = (input: Partial<DocumentRecord> = {}): DocumentRecord => ({
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    kind: 'COURSE_PDF',
    fileName: 'cours.pdf',
    storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    ...input,
  });

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
