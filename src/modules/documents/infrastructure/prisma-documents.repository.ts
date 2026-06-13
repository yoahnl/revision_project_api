import { Injectable } from '@nestjs/common';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  type DocumentsRepository,
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
    units: Array<{ title: string; summary: string }>;
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
        await tx.knowledgeUnit.createMany({
          data: input.units.map((unit) => {
            const knowledgeUnit = new KnowledgeUnit({
              id: 'validation-knowledge-unit',
              subjectId: document.subjectId,
              title: unit.title,
              summary: unit.summary,
            });

            return {
              documentId: input.documentId,
              subjectId: knowledgeUnit.subjectId,
              title: knowledgeUnit.title,
              summary: knowledgeUnit.summary,
            };
          }),
        });
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
}
