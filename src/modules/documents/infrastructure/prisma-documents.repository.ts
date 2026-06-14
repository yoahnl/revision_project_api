import { Injectable } from '@nestjs/common';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  type DocumentChunkPersistenceInput,
  type DocumentKnowledgeUnitsDto,
  type DocumentsRepository,
  type KnowledgeUnitPersistenceInput,
  type KnowledgeUnitSourcePersistenceInput,
  type RevisionDocumentChunkDto,
  type RevisionDocumentDto,
} from '../application/documents.repository';
import { RevisionDocument } from '../domain/document.entity';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
};

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
      },
    });

    return record ? this.toDto(record) : null;
  }

  async deleteForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
        select: {
          id: true,
          subjectId: true,
        },
      });

      if (!document) {
        return false;
      }

      await tx.knowledgeUnit.deleteMany({
        where: {
          documentId: input.documentId,
          subjectId: document.subjectId,
        },
      });

      const result = await tx.document.deleteMany({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
      });

      return result.count === 1;
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

  private toDto(record: DocumentRecord): RevisionDocumentDto {
    const document = new RevisionDocument(record);

    return {
      id: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
      kind: document.kind,
      fileName: document.fileName,
      storagePath: document.storagePath,
      mimeType: document.mimeType,
      status: document.status,
      errorCode: document.errorCode,
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
