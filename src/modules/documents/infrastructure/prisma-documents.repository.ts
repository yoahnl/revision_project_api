import { Injectable } from '@nestjs/common';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  type DocumentChunkPersistenceInput,
  type DocumentKnowledgeUnitsDto,
  type DeleteDocumentResult,
  type DocumentsRepository,
  type KnowledgeUnitPersistenceInput,
  type KnowledgeUnitSourcePersistenceInput,
  type RevisionDocumentChunkDto,
  type RevisionDocumentDto,
} from '../application/documents.repository';
import { RevisionDocument } from '../domain/document.entity';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';
import {
  buildSourceLifecycleDecision,
  SourceArchiveBlockedError,
  SourceDeleteBlockedError,
  type SourceLifecycleDecision,
  type SourceLifecycleReason,
} from '../domain/source-lifecycle.entity';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
  archivedAt: Date | null;
  archivedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SourceLifecycleDocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  storagePath: string;
  status: DocumentStatus;
  archivedAt: Date | null;
};

type SourceLifecyclePrismaClient = Pick<
  PrismaService,
  | 'activitySession'
  | 'document'
  | 'documentFileCleanupJob'
  | 'documentChunk'
  | 'knowledgeUnit'
  | 'openQuestion'
  | 'question'
  | 'questionBankItem'
  | 'revisionSession'
  | 'revisionSessionAction'
  | 'revisionSheet'
  | 'richClosedExercisePayload'
  | 'summary'
>;

type DocumentChunkRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
  createdAt: Date;
};

@Injectable()
export class PrismaDocumentsRepository implements DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    studentId: string;
    subjectId: string;
    courseId?: string | null;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto> {
    const document = new RevisionDocument({
      id: 'validation-document',
      studentId: input.studentId,
      subjectId: input.subjectId,
      kind: input.kind,
      fileName: input.fileName,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      status: 'UPLOADED',
    });

    const record = await this.prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findFirst({
        where: {
          id: document.subjectId,
          studentId: document.studentId,
        },
      });

      if (!subject) {
        throw new Error('Subject does not belong to student');
      }

      const createdDocument = await tx.document.create({
        data: {
          studentId: document.studentId,
          subjectId: document.subjectId,
          courseId: input.courseId ?? null,
          kind: document.kind,
          fileName: document.fileName,
          storagePath: document.storagePath,
          mimeType: document.mimeType,
        },
      });

      await tx.documentProcessingJob.create({
        data: {
          documentId: createdDocument.id,
          status: 'PENDING',
        },
      });

      return createdDocument;
    });

    return this.toDto(record);
  }

  async findBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<RevisionDocumentDto[]> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
    });

    if (!subject) {
      throw new Error('Subject does not belong to student');
    }

    const records = await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        archivedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDto(record));
  }

  async findByIdForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<RevisionDocumentDto | null> {
    const record = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
        archivedAt: null,
      },
    });

    return record ? this.toDto(record) : null;
  }

  async getLifecycleDecisionForStudent(input: {
    studentId: string;
    documentId: string;
    courseId?: string | null;
  }): Promise<SourceLifecycleDecision | null> {
    const document = await this.findLifecycleDocument(input);

    if (!document) {
      return null;
    }

    const dependencyCounts = await this.countSourceDependencies(
      this.prisma,
      document,
    );

    return buildSourceLifecycleDecision({
      documentId: document.id,
      courseId: document.courseId,
      status: document.status,
      archivedAt: document.archivedAt,
      dependencyCounts,
    });
  }

  async archiveForStudent(input: {
    studentId: string;
    documentId: string;
    courseId?: string | null;
    reason?: string | null;
  }): Promise<SourceLifecycleDecision | null> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findLifecycleDocument(input, tx);

      if (!document) {
        return null;
      }

      const dependencyCounts = await this.countSourceDependencies(tx, document);
      const decision = buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt: document.archivedAt,
        dependencyCounts,
      });

      if (decision.status === 'ARCHIVED') {
        return decision;
      }

      if (!decision.canArchive) {
        throw new SourceArchiveBlockedError(decision);
      }

      const archivedAt = new Date();

      await tx.document.updateMany({
        where: {
          id: document.id,
          studentId: input.studentId,
          archivedAt: null,
        },
        data: {
          archivedAt,
          archivedReason: input.reason?.trim() || decision.recommendedAction,
        },
      });

      return buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt,
        dependencyCounts,
      });
    });
  }

  async deleteForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<DeleteDocumentResult> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findLifecycleDocument(input, tx);

      if (!document) {
        return { deleted: false, cleanupJobId: null };
      }

      const dependencyCounts = await this.countSourceDependencies(tx, document);
      const decision = buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt: document.archivedAt,
        dependencyCounts,
      });

      if (!decision.canDelete) {
        throw new SourceDeleteBlockedError(decision);
      }

      const result = await tx.document.deleteMany({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
      });

      if (result.count !== 1) {
        return { deleted: false, cleanupJobId: null };
      }

      const cleanupJob = await tx.documentFileCleanupJob.create({
        data: {
          documentId: document.id,
          studentId: document.studentId,
          storagePath: document.storagePath,
          reason: 'DOCUMENT_SAFE_DELETE',
          status: 'PENDING',
        },
        select: { id: true },
      });

      return { deleted: true, cleanupJobId: cleanupJob.id };
    });
  }

  async deleteCourseDocumentForStudent(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<DeleteDocumentResult> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findLifecycleDocument(input, tx);

      if (!document) {
        return { deleted: false, cleanupJobId: null };
      }

      const dependencyCounts = await this.countSourceDependencies(tx, document);
      const decision = buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt: document.archivedAt,
        dependencyCounts,
      });

      if (!decision.canDelete) {
        throw new SourceDeleteBlockedError(decision);
      }

      const result = await tx.document.deleteMany({
        where: {
          id: input.documentId,
          studentId: input.studentId,
          courseId: input.courseId,
        },
      });

      if (result.count !== 1) {
        return { deleted: false, cleanupJobId: null };
      }

      const cleanupJob = await tx.documentFileCleanupJob.create({
        data: {
          documentId: document.id,
          studentId: document.studentId,
          storagePath: document.storagePath,
          reason: 'COURSE_SOURCE_SAFE_DELETE',
          status: 'PENDING',
        },
        select: { id: true },
      });

      return { deleted: true, cleanupJobId: cleanupJob.id };
    });
  }

  async findById(documentId: string): Promise<RevisionDocumentDto | null> {
    const record = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    return record ? this.toDto(record) : null;
  }

  async markProcessing(documentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id: documentId, status: 'UPLOADED' },
        data: { status: 'PROCESSING', errorCode: null },
      });

      if (result.count !== 1) {
        throw new Error('Document is not uploaded');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: { documentId, status: 'PENDING' },
        data: { status: 'RUNNING' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not pending');
      }
    });
  }

  async markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: KnowledgeUnitPersistenceInput[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status === 'READY') {
        return;
      }

      if (document.status !== 'PROCESSING') {
        throw new Error('Document is not processing');
      }

      if (input.units.length > 0) {
        const allSourceChunkIds = [
          ...new Set(input.units.flatMap((unit) => unit.sourceChunkIds ?? [])),
        ];

        if (allSourceChunkIds.length === 0) {
          await tx.knowledgeUnit.createMany({
            data: input.units.map((unit) =>
              this.toKnowledgeUnitCreateData({
                documentId: input.documentId,
                subjectId: document.subjectId,
                unit,
              }),
            ),
          });
        } else {
          const chunks = await tx.documentChunk.findMany({
            where: {
              id: { in: allSourceChunkIds },
              subjectId: document.subjectId,
              documentId: input.documentId,
            },
            select: { id: true },
          });
          const existingChunkIds = new Set(chunks.map((chunk) => chunk.id));

          if (
            allSourceChunkIds.some((chunkId) => !existingChunkIds.has(chunkId))
          ) {
            throw new Error('Knowledge unit source chunk not found');
          }

          for (const unit of input.units) {
            const sourceChunkIds = [...new Set(unit.sourceChunkIds ?? [])];
            const createdKnowledgeUnit = await tx.knowledgeUnit.create({
              data: this.toKnowledgeUnitCreateData({
                documentId: input.documentId,
                subjectId: document.subjectId,
                unit,
              }),
            });

            if (sourceChunkIds.length > 0) {
              await tx.knowledgeUnitSource.createMany({
                data: sourceChunkIds.map((chunkId) => ({
                  knowledgeUnitId: createdKnowledgeUnit.id,
                  subjectId: document.subjectId,
                  chunkId,
                  relevanceScore: null,
                })),
              });
            }
          }
        }
      }

      const result = await tx.document.updateMany({
        where: { id: input.documentId, status: 'PROCESSING' },
        data: { status: 'READY', errorCode: null },
      });

      if (result.count !== 1) {
        throw new Error('Document is not processing');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: { documentId: input.documentId, status: 'RUNNING' },
        data: { status: 'COMPLETED' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not running');
      }
    });
  }

  async replaceChunks(input: {
    documentId: string;
    chunks: DocumentChunkPersistenceInput[];
  }): Promise<void> {
    const chunks = [...input.chunks]
      .map((chunk) => ({
        index: chunk.index,
        text: chunk.text.trim(),
        charStart: chunk.charStart ?? null,
        charEnd: chunk.charEnd ?? null,
        pageNumber: chunk.pageNumber ?? null,
      }))
      .filter((chunk) => chunk.text.length > 0)
      .sort((left, right) => left.index - right.index);

    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status !== 'PROCESSING') {
        throw new Error('Document is not processing');
      }

      await tx.documentChunk.deleteMany({
        where: { documentId: input.documentId },
      });

      if (chunks.length === 0) {
        return;
      }

      await tx.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: input.documentId,
          subjectId: document.subjectId,
          index: chunk.index,
          text: chunk.text,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          pageNumber: chunk.pageNumber,
        })),
      });
    });
  }

  async findChunksByDocumentId(
    documentId: string,
  ): Promise<RevisionDocumentChunkDto[]> {
    const records = await this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
    });

    return records.map((record) => this.toChunkDto(record));
  }

  async findKnowledgeUnitsByDocumentForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<DocumentKnowledgeUnitsDto | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
        archivedAt: null,
      },
    });

    if (!document) {
      return null;
    }

    const knowledgeUnits = await this.prisma.knowledgeUnit.findMany({
      where: {
        documentId: input.documentId,
        subject: {
          studentId: input.studentId,
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

    return {
      documentId: document.id,
      documentStatus: document.status,
      items: knowledgeUnits.map((unit) => ({
        id: unit.id,
        title: unit.title,
        summary: unit.summary,
        difficulty: unit.difficulty,
        displayOrder: unit.displayOrder,
        confidence: unit.confidence,
        sources: unit.sources
          .map((source) => ({
            chunkId: source.chunkId,
            text: source.chunk.text,
            pageNumber: source.chunk.pageNumber,
            index: source.chunk.index,
          }))
          .sort((left, right) => left.index - right.index),
      })),
    };
  }

  async replaceKnowledgeUnitSources(input: {
    knowledgeUnitId: string;
    subjectId: string;
    sources: KnowledgeUnitSourcePersistenceInput[];
  }): Promise<void> {
    const sources = input.sources.map((source) => ({
      chunkId: source.chunkId,
      relevanceScore: source.relevanceScore ?? null,
    }));
    const chunkIds = [...new Set(sources.map((source) => source.chunkId))];

    await this.prisma.$transaction(async (tx) => {
      const knowledgeUnit = await tx.knowledgeUnit.findUnique({
        where: {
          id_subjectId: {
            id: input.knowledgeUnitId,
            subjectId: input.subjectId,
          },
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Knowledge unit not found');
      }

      if (chunkIds.length > 0) {
        const chunks = await tx.documentChunk.findMany({
          where: {
            id: { in: chunkIds },
            subjectId: input.subjectId,
          },
          select: { id: true },
        });
        const existingChunkIds = new Set(chunks.map((chunk) => chunk.id));

        if (chunkIds.some((chunkId) => !existingChunkIds.has(chunkId))) {
          throw new Error('Knowledge unit source chunk not found');
        }
      }

      await tx.knowledgeUnitSource.deleteMany({
        where: {
          knowledgeUnitId: input.knowledgeUnitId,
          subjectId: input.subjectId,
        },
      });

      if (sources.length === 0) {
        return;
      }

      await tx.knowledgeUnitSource.createMany({
        data: sources.map((source) => ({
          knowledgeUnitId: input.knowledgeUnitId,
          subjectId: input.subjectId,
          chunkId: source.chunkId,
          relevanceScore: source.relevanceScore,
        })),
      });
    });
  }

  async markFailed(input: {
    documentId: string;
    errorCode: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status === 'FAILED') {
        return;
      }

      if (document.status === 'READY') {
        throw new Error('Document is already ready');
      }

      const result = await tx.document.updateMany({
        where: {
          id: input.documentId,
          status: { in: ['UPLOADED', 'PROCESSING'] },
        },
        data: { status: 'FAILED', errorCode: input.errorCode },
      });

      if (result.count !== 1) {
        throw new Error('Document is not active');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: {
          documentId: input.documentId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'FAILED' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not active');
      }
    });
  }

  private findLifecycleDocument(
    input: { studentId: string; documentId: string; courseId?: string | null },
    client: SourceLifecyclePrismaClient = this.prisma,
  ): Promise<SourceLifecycleDocumentRecord | null> {
    return client.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
        ...(input.courseId !== undefined ? { courseId: input.courseId } : {}),
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
  }

  private async countSourceDependencies(
    client: SourceLifecyclePrismaClient,
    document: SourceLifecycleDocumentRecord,
  ): Promise<Partial<Record<SourceLifecycleReason, number>>> {
    const whereDocument = {
      documentId: document.id,
      subjectId: document.subjectId,
    };
    const whereStudentDocument = {
      documentId: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
    };

    const [
      chunks,
      knowledgeUnits,
      summaries,
      revisionSheets,
      questionBankItems,
      revisionSessions,
      revisionSessionActions,
      openQuestions,
      activitySessions,
      questions,
      richClosedPayloads,
    ] = await Promise.all([
      client.documentChunk.count({ where: whereDocument }),
      client.knowledgeUnit.count({ where: whereDocument }),
      client.summary.count({ where: whereStudentDocument }),
      client.revisionSheet.count({ where: whereStudentDocument }),
      client.questionBankItem.count({ where: whereStudentDocument }),
      client.revisionSession.count({ where: whereStudentDocument }),
      client.revisionSessionAction.count({ where: whereStudentDocument }),
      client.openQuestion.count({ where: whereStudentDocument }),
      client.activitySession.count({ where: whereStudentDocument }),
      client.question.count({ where: whereDocument }),
      client.richClosedExercisePayload.count({ where: whereDocument }),
    ]);

    return {
      HAS_DOCUMENT_CHUNKS: chunks,
      HAS_KNOWLEDGE_UNITS: knowledgeUnits,
      HAS_SUMMARY: summaries,
      HAS_REVISION_SHEET: revisionSheets,
      HAS_QUESTION_BANK_ITEMS: questionBankItems,
      HAS_REVISION_SESSIONS: revisionSessions,
      HAS_REVISION_SESSION_ACTIONS: revisionSessionActions,
      HAS_OPEN_QUESTIONS: openQuestions,
      HAS_ACTIVITY_SESSIONS: activitySessions,
      HAS_QUESTIONS: questions,
      HAS_RICH_CLOSED_PAYLOADS: richClosedPayloads,
    };
  }

  private toDto(record: DocumentRecord): RevisionDocumentDto {
    const document = new RevisionDocument(record);

    return {
      id: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
      courseId: record.courseId,
      kind: document.kind,
      fileName: document.fileName,
      storagePath: document.storagePath,
      mimeType: document.mimeType,
      status: document.status,
      errorCode: document.errorCode,
      archivedAt: record.archivedAt,
      archivedReason: record.archivedReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toChunkDto(record: DocumentChunkRecord): RevisionDocumentChunkDto {
    return {
      id: record.id,
      documentId: record.documentId,
      subjectId: record.subjectId,
      index: record.index,
      text: record.text,
      charStart: record.charStart,
      charEnd: record.charEnd,
      pageNumber: record.pageNumber,
      createdAt: record.createdAt,
    };
  }

  private toKnowledgeUnitCreateData(input: {
    documentId: string;
    subjectId: string;
    unit: KnowledgeUnitPersistenceInput;
  }) {
    const knowledgeUnit = new KnowledgeUnit({
      id: 'validation-knowledge-unit',
      subjectId: input.subjectId,
      title: input.unit.title,
      summary: input.unit.summary,
    });

    return {
      documentId: input.documentId,
      subjectId: knowledgeUnit.subjectId,
      title: knowledgeUnit.title,
      summary: knowledgeUnit.summary,
      difficulty: input.unit.difficulty ?? undefined,
      displayOrder: input.unit.displayOrder ?? undefined,
      confidence: input.unit.confidence ?? undefined,
      extractionPromptVersion: input.unit.extractionPromptVersion ?? undefined,
      extractionSchemaVersion: input.unit.extractionSchemaVersion ?? undefined,
    };
  }
}
