import { PrismaStudyArtifactsRepository } from './prisma-study-artifacts.repository';

type TransactionCallback = (tx: PrismaStudyArtifactsMock) => unknown;

type PrismaStudyArtifactsMock = {
  document: {
    findFirst: jest.Mock;
  };
  documentChunk: {
    findMany: jest.Mock;
  };
  summary: {
    findFirst: jest.Mock;
    upsert: jest.Mock;
  };
  summarySource: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  revisionSheet: {
    findFirst: jest.Mock;
    upsert: jest.Mock;
  };
  revisionSheetSection: {
    deleteMany: jest.Mock;
    create: jest.Mock;
  };
  revisionSheetSectionSource: {
    createMany: jest.Mock;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

describe('PrismaStudyArtifactsRepository', () => {
  const metadata = {
    flowName: 'generateSummaryFlow',
    provider: 'google-genai',
    model: 'googleai/gemini-2.5-flash',
    promptVersion: 'generate-summary-v1',
    schemaVersion: 'summary-v1',
    generatedAt: new Date('2026-06-14T10:00:00.000Z'),
    inputSize: 1024,
    sourceStrategy: 'DOCUMENT_CHUNKS' as const,
  };

  function createRepository() {
    const prisma: PrismaStudyArtifactsMock = {
      document: {
        findFirst: jest.fn(),
      },
      documentChunk: {
        findMany: jest.fn(),
      },
      summary: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      summarySource: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      revisionSheet: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      revisionSheetSection: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      revisionSheetSectionSource: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
    };
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prisma)),
    );

    return {
      prisma,
      repository: new PrismaStudyArtifactsRepository(prisma as never),
    };
  }

  const readyDocument = {
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    status: 'READY',
  };

  const chunks = [
    {
      id: 'chunk-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      index: 0,
      text: 'Premier extrait.',
      pageNumber: null,
    },
    {
      id: 'chunk-2',
      documentId: 'document-1',
      subjectId: 'subject-1',
      index: 1,
      text: 'Second extrait.',
      pageNumber: null,
    },
  ];

  it('saves a ready summary with validated document chunks', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(readyDocument);
    prisma.documentChunk.findMany.mockResolvedValue(chunks);
    prisma.summary.upsert.mockResolvedValue({
      id: 'summary-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Résumé',
      content: 'Contenu',
      keyPoints: ['Point clé'],
      limits: null,
      flowName: metadata.flowName,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      generatedAt: metadata.generatedAt,
      inputSize: metadata.inputSize,
      sourceStrategy: metadata.sourceStrategy,
      errorCode: null,
      sources: [],
    });

    await repository.saveReadySummary({
      studentId: 'student-1',
      documentId: 'document-1',
      title: 'Résumé',
      content: 'Contenu',
      keyPoints: ['Point clé'],
      limits: null,
      metadata,
      sources: [
        { chunkId: 'chunk-1', relevanceScore: 0.9 },
        { chunkId: 'chunk-2', relevanceScore: null },
        { chunkId: 'chunk-1', relevanceScore: 0.9 },
      ],
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-1', 'chunk-2'] },
        documentId: 'document-1',
        subjectId: 'subject-1',
      },
      select: { id: true },
    });
    expect(prisma.summary.upsert).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
      create: {
        documentId: 'document-1',
        subjectId: 'subject-1',
        studentId: 'student-1',
        status: 'READY',
        title: 'Résumé',
        content: 'Contenu',
        keyPoints: ['Point clé'],
        limits: null,
        generatedAt: metadata.generatedAt,
        flowName: metadata.flowName,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: metadata.promptVersion,
        schemaVersion: metadata.schemaVersion,
        inputSize: metadata.inputSize,
        sourceStrategy: metadata.sourceStrategy,
        errorCode: null,
      },
      update: {
        status: 'READY',
        title: 'Résumé',
        content: 'Contenu',
        keyPoints: ['Point clé'],
        limits: null,
        generatedAt: metadata.generatedAt,
        flowName: metadata.flowName,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: metadata.promptVersion,
        schemaVersion: metadata.schemaVersion,
        inputSize: metadata.inputSize,
        sourceStrategy: metadata.sourceStrategy,
        errorCode: null,
      },
    });
    expect(prisma.summarySource.deleteMany).toHaveBeenCalledWith({
      where: { summaryId: 'summary-1' },
    });
    expect(prisma.summarySource.createMany).toHaveBeenCalledWith({
      data: [
        {
          summaryId: 'summary-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: 0.9,
        },
        {
          summaryId: 'summary-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: null,
        },
      ],
    });
  });

  it('rejects a ready summary without sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(readyDocument);

    await expect(
      repository.saveReadySummary({
        studentId: 'student-1',
        documentId: 'document-1',
        title: 'Résumé',
        content: 'Contenu',
        keyPoints: [],
        limits: null,
        metadata,
        sources: [],
      }),
    ).rejects.toThrow('Summary sources are required');

    expect(prisma.summary.upsert).not.toHaveBeenCalled();
  });

  it('rejects a ready summary for a document that is not ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue({
      ...readyDocument,
      status: 'PROCESSING',
    });

    await expect(
      repository.saveReadySummary({
        studentId: 'student-1',
        documentId: 'document-1',
        title: 'Résumé',
        content: 'Contenu',
        keyPoints: [],
        limits: null,
        metadata,
        sources: [{ chunkId: 'chunk-1', relevanceScore: null }],
      }),
    ).rejects.toThrow('Document is not ready');

    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
    expect(prisma.summary.upsert).not.toHaveBeenCalled();
  });

  it('rejects a summary source from another document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(readyDocument);
    prisma.documentChunk.findMany.mockResolvedValue([chunks[0]]);

    await expect(
      repository.saveReadySummary({
        studentId: 'student-1',
        documentId: 'document-1',
        title: 'Résumé',
        content: 'Contenu',
        keyPoints: [],
        limits: null,
        metadata,
        sources: [
          { chunkId: 'chunk-1', relevanceScore: null },
          { chunkId: 'chunk-other-document', relevanceScore: null },
        ],
      }),
    ).rejects.toThrow('Summary source chunk not found');
  });

  it('saves a failed summary without sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue({
      ...readyDocument,
      status: 'FAILED',
    });
    prisma.summary.upsert.mockResolvedValue({
      id: 'summary-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'FAILED',
      title: null,
      content: null,
      keyPoints: null,
      limits: null,
      flowName: metadata.flowName,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      generatedAt: metadata.generatedAt,
      inputSize: metadata.inputSize,
      sourceStrategy: metadata.sourceStrategy,
      errorCode: 'SUMMARY_GENERATION_FAILED',
      sources: [],
    });

    await repository.saveFailedSummary({
      studentId: 'student-1',
      documentId: 'document-1',
      metadata,
      errorCode: 'SUMMARY_GENERATION_FAILED',
    });

    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
    expect(prisma.summarySource.deleteMany).toHaveBeenCalledWith({
      where: { summaryId: 'summary-1' },
    });
  });

  it('finds a summary with sorted sources and no storage path', async () => {
    const { prisma, repository } = createRepository();
    prisma.summary.findFirst.mockResolvedValue({
      id: 'summary-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Résumé',
      content: 'Contenu',
      keyPoints: ['Point clé'],
      limits: null,
      flowName: metadata.flowName,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      generatedAt: metadata.generatedAt,
      inputSize: metadata.inputSize,
      sourceStrategy: metadata.sourceStrategy,
      errorCode: null,
      sources: [
        { chunkId: 'chunk-2', relevanceScore: null, chunk: chunks[1] },
        { chunkId: 'chunk-1', relevanceScore: 0.9, chunk: chunks[0] },
      ],
    });

    const summary = await repository.findSummaryByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        studentId: 'student-1',
      },
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });
    expect(summary?.sources.map((source) => source.chunkId)).toEqual([
      'chunk-1',
      'chunk-2',
    ]);
    expect(JSON.stringify(summary)).not.toContain('storagePath');
  });

  it('saves a ready revision sheet with sourced sections', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(readyDocument);
    prisma.documentChunk.findMany.mockResolvedValue(chunks);
    prisma.revisionSheet.upsert.mockResolvedValue({
      id: 'sheet-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Fiche',
      introduction: 'Intro',
      keyPoints: ['Point clé'],
      commonMistakes: ['Erreur'],
      mustKnow: ['Essentiel'],
      practiceSuggestions: ['Pratiquer'],
      flowName: metadata.flowName,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      generatedAt: metadata.generatedAt,
      inputSize: metadata.inputSize,
      sourceStrategy: metadata.sourceStrategy,
      errorCode: null,
      sections: [],
    });
    prisma.revisionSheetSection.create.mockResolvedValueOnce({
      id: 'section-1',
      revisionSheetId: 'sheet-1',
      subjectId: 'subject-1',
      displayOrder: 0,
      title: 'Section',
      content: 'Contenu',
    });

    await repository.saveReadyRevisionSheet({
      studentId: 'student-1',
      documentId: 'document-1',
      title: 'Fiche',
      introduction: 'Intro',
      keyPoints: ['Point clé'],
      commonMistakes: ['Erreur'],
      mustKnow: ['Essentiel'],
      practiceSuggestions: ['Pratiquer'],
      metadata,
      sections: [
        {
          displayOrder: 0,
          title: 'Section',
          content: 'Contenu',
          sources: [
            { chunkId: 'chunk-2', relevanceScore: null },
            { chunkId: 'chunk-1', relevanceScore: 0.8 },
          ],
        },
      ],
    });

    expect(prisma.revisionSheetSection.deleteMany).toHaveBeenCalledWith({
      where: { revisionSheetId: 'sheet-1' },
    });
    expect(prisma.revisionSheetSection.create).toHaveBeenCalledWith({
      data: {
        revisionSheetId: 'sheet-1',
        subjectId: 'subject-1',
        displayOrder: 0,
        title: 'Section',
        content: 'Contenu',
      },
    });
    expect(prisma.revisionSheetSectionSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          sectionId: 'section-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: null,
        },
        {
          sectionId: 'section-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: 0.8,
        },
      ],
    });
  });

  it('rejects a ready revision sheet section without sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(readyDocument);

    await expect(
      repository.saveReadyRevisionSheet({
        studentId: 'student-1',
        documentId: 'document-1',
        title: 'Fiche',
        introduction: null,
        keyPoints: [],
        commonMistakes: [],
        mustKnow: [],
        practiceSuggestions: [],
        metadata,
        sections: [
          {
            displayOrder: 0,
            title: 'Section',
            content: 'Contenu',
            sources: [],
          },
        ],
      }),
    ).rejects.toThrow('Revision sheet section sources are required');
  });

  it('rejects a ready revision sheet for a document that is not ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue({
      ...readyDocument,
      status: 'PROCESSING',
    });

    await expect(
      repository.saveReadyRevisionSheet({
        studentId: 'student-1',
        documentId: 'document-1',
        title: 'Fiche',
        introduction: null,
        keyPoints: [],
        commonMistakes: [],
        mustKnow: [],
        practiceSuggestions: [],
        metadata,
        sections: [
          {
            displayOrder: 0,
            title: 'Section',
            content: 'Contenu',
            sources: [{ chunkId: 'chunk-1', relevanceScore: null }],
          },
        ],
      }),
    ).rejects.toThrow('Document is not ready');

    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
    expect(prisma.revisionSheet.upsert).not.toHaveBeenCalled();
  });

  it('saves a failed revision sheet without sections', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(readyDocument);
    prisma.revisionSheet.upsert.mockResolvedValue({
      id: 'sheet-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'FAILED',
      title: null,
      introduction: null,
      keyPoints: null,
      commonMistakes: null,
      mustKnow: null,
      practiceSuggestions: null,
      flowName: metadata.flowName,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      generatedAt: metadata.generatedAt,
      inputSize: metadata.inputSize,
      sourceStrategy: metadata.sourceStrategy,
      errorCode: 'REVISION_SHEET_GENERATION_FAILED',
      sections: [],
    });

    await repository.saveFailedRevisionSheet({
      studentId: 'student-1',
      documentId: 'document-1',
      metadata,
      errorCode: 'REVISION_SHEET_GENERATION_FAILED',
    });

    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
    expect(prisma.revisionSheetSection.deleteMany).toHaveBeenCalledWith({
      where: { revisionSheetId: 'sheet-1' },
    });
  });

  it('finds a revision sheet with sorted sections and sorted sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSheet.findFirst.mockResolvedValue({
      id: 'sheet-1',
      documentId: 'document-1',
      subjectId: 'subject-1',
      status: 'READY',
      title: 'Fiche',
      introduction: 'Intro',
      keyPoints: ['Point clé'],
      commonMistakes: [],
      mustKnow: [],
      practiceSuggestions: [],
      flowName: metadata.flowName,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      generatedAt: metadata.generatedAt,
      inputSize: metadata.inputSize,
      sourceStrategy: metadata.sourceStrategy,
      errorCode: null,
      sections: [
        {
          id: 'section-2',
          displayOrder: 1,
          title: 'Deuxième',
          content: 'Contenu',
          sources: [],
        },
        {
          id: 'section-1',
          displayOrder: 0,
          title: 'Première',
          content: 'Contenu',
          sources: [
            { chunkId: 'chunk-2', relevanceScore: null, chunk: chunks[1] },
            { chunkId: 'chunk-1', relevanceScore: 0.7, chunk: chunks[0] },
          ],
        },
      ],
    });

    const sheet = await repository.findRevisionSheetByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(sheet?.sections.map((section) => section.id)).toEqual([
      'section-1',
      'section-2',
    ]);
    expect(sheet?.sections[0]?.sources.map((source) => source.chunkId)).toEqual(
      ['chunk-1', 'chunk-2'],
    );
    expect(JSON.stringify(sheet)).not.toContain('storagePath');
  });
});
