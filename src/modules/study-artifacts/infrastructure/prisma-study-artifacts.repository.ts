import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  FailedRevisionSheetInput,
  FailedSummaryInput,
  ReadyRevisionSheetInput,
  ReadySummaryInput,
  RevisionSheetDto,
  RevisionSheetSectionDto,
  StudyArtifactMetadata,
  StudyArtifactSourceDto,
  StudyArtifactSourceInput,
  StudyArtifactsRepository,
  SummaryDto,
} from '../application/study-artifacts.repository';

type StudyArtifactsPrismaClient = Pick<
  PrismaService,
  | 'document'
  | 'documentChunk'
  | 'summary'
  | 'summarySource'
  | 'revisionSheet'
  | 'revisionSheetSection'
  | 'revisionSheetSectionSource'
>;

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  status: string;
};

type ChunkRecord = {
  id: string;
  index: number;
  text: string;
  pageNumber: number | null;
};

type SummarySourceRecord = {
  chunkId: string;
  relevanceScore: number | null;
  chunk: ChunkRecord;
};

type SummaryRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  status: string;
  title: string | null;
  content: string | null;
  keyPoints: unknown;
  limits: string | null;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: Date;
  inputSize: number | null;
  sourceStrategy: string;
  errorCode: string | null;
  sources?: SummarySourceRecord[];
};

type RevisionSheetSectionSourceRecord = {
  chunkId: string;
  relevanceScore: number | null;
  chunk: ChunkRecord;
};

type RevisionSheetSectionRecord = {
  id: string;
  displayOrder: number;
  title: string;
  content: string;
  sources?: RevisionSheetSectionSourceRecord[];
};

type RevisionSheetRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  status: string;
  title: string | null;
  introduction: string | null;
  keyPoints: unknown;
  commonMistakes: unknown;
  mustKnow: unknown;
  practiceSuggestions: unknown;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: Date;
  inputSize: number | null;
  sourceStrategy: string;
  errorCode: string | null;
  sections?: RevisionSheetSectionRecord[];
};

@Injectable()
export class PrismaStudyArtifactsRepository implements StudyArtifactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSummaryByDocumentForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<SummaryDto | null> {
    const summary = await this.prisma.summary.findFirst({
      where: {
        documentId: input.documentId,
        studentId: input.studentId,
      },
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });

    if (!summary) {
      return null;
    }

    return this.toSummaryDto(summary);
  }

  async saveReadySummary(input: ReadySummaryInput): Promise<SummaryDto> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findOwnedDocument(tx, {
        studentId: input.studentId,
        documentId: input.documentId,
      });
      this.assertReadyDocument(document);
      const sources = this.uniqueSources(input.sources);
      this.assertSourcesRequired(sources, 'Summary sources are required');
      await this.findValidatedChunks(
        tx,
        document,
        sources,
        'Summary source chunk not found',
      );

      const summary = await tx.summary.upsert({
        where: { documentId: input.documentId },
        create: {
          documentId: input.documentId,
          subjectId: document.subjectId,
          studentId: input.studentId,
          status: 'READY',
          title: input.title,
          content: input.content,
          keyPoints: input.keyPoints,
          limits: input.limits,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: null,
        },
        update: {
          status: 'READY',
          title: input.title,
          content: input.content,
          keyPoints: input.keyPoints,
          limits: input.limits,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: null,
        },
      });

      await tx.summarySource.deleteMany({
        where: { summaryId: summary.id },
      });
      await tx.summarySource.createMany({
        data: sources.map((source) => ({
          summaryId: summary.id,
          subjectId: document.subjectId,
          chunkId: source.chunkId,
          relevanceScore: source.relevanceScore ?? null,
        })),
      });

      return this.toSummaryDto({
        ...summary,
        sources: [],
      });
    });
  }

  async saveFailedSummary(input: FailedSummaryInput): Promise<SummaryDto> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findOwnedDocument(tx, {
        studentId: input.studentId,
        documentId: input.documentId,
      });
      const summary = await tx.summary.upsert({
        where: { documentId: input.documentId },
        create: {
          documentId: input.documentId,
          subjectId: document.subjectId,
          studentId: input.studentId,
          status: 'FAILED',
          title: null,
          content: null,
          keyPoints: Prisma.JsonNull,
          limits: null,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: input.errorCode,
        },
        update: {
          status: 'FAILED',
          title: null,
          content: null,
          keyPoints: Prisma.JsonNull,
          limits: null,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: input.errorCode,
        },
      });

      await tx.summarySource.deleteMany({
        where: { summaryId: summary.id },
      });

      return this.toSummaryDto({
        ...summary,
        sources: [],
      });
    });
  }

  async findRevisionSheetByDocumentForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<RevisionSheetDto | null> {
    const revisionSheet = await this.prisma.revisionSheet.findFirst({
      where: {
        documentId: input.documentId,
        studentId: input.studentId,
      },
      include: {
        sections: {
          include: {
            sources: {
              include: {
                chunk: true,
              },
            },
          },
        },
      },
    });

    if (!revisionSheet) {
      return null;
    }

    return this.toRevisionSheetDto(revisionSheet);
  }

  async saveReadyRevisionSheet(
    input: ReadyRevisionSheetInput,
  ): Promise<RevisionSheetDto> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findOwnedDocument(tx, {
        studentId: input.studentId,
        documentId: input.documentId,
      });
      this.assertReadyDocument(document);
      this.assertSectionsRequired(input.sections);
      const sectionSources = input.sections.flatMap((section) => {
        const sources = this.uniqueSources(section.sources);
        this.assertSourcesRequired(
          sources,
          'Revision sheet section sources are required',
        );
        return sources;
      });
      await this.findValidatedChunks(
        tx,
        document,
        sectionSources,
        'Revision sheet source chunk not found',
      );

      const revisionSheet = await tx.revisionSheet.upsert({
        where: { documentId: input.documentId },
        create: {
          documentId: input.documentId,
          subjectId: document.subjectId,
          studentId: input.studentId,
          status: 'READY',
          title: input.title,
          introduction: input.introduction,
          keyPoints: input.keyPoints,
          commonMistakes: input.commonMistakes,
          mustKnow: input.mustKnow,
          practiceSuggestions: input.practiceSuggestions,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: null,
        },
        update: {
          status: 'READY',
          title: input.title,
          introduction: input.introduction,
          keyPoints: input.keyPoints,
          commonMistakes: input.commonMistakes,
          mustKnow: input.mustKnow,
          practiceSuggestions: input.practiceSuggestions,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: null,
        },
      });

      await tx.revisionSheetSection.deleteMany({
        where: { revisionSheetId: revisionSheet.id },
      });

      for (const section of [...input.sections].sort(
        (left, right) => left.displayOrder - right.displayOrder,
      )) {
        const createdSection = await tx.revisionSheetSection.create({
          data: {
            revisionSheetId: revisionSheet.id,
            subjectId: document.subjectId,
            displayOrder: section.displayOrder,
            title: section.title,
            content: section.content,
          },
        });
        const sources = this.uniqueSources(section.sources);
        await tx.revisionSheetSectionSource.createMany({
          data: sources.map((source) => ({
            sectionId: createdSection.id,
            subjectId: document.subjectId,
            chunkId: source.chunkId,
            relevanceScore: source.relevanceScore ?? null,
          })),
        });
      }

      return this.toRevisionSheetDto({
        ...revisionSheet,
        sections: [],
      });
    });
  }

  async saveFailedRevisionSheet(
    input: FailedRevisionSheetInput,
  ): Promise<RevisionSheetDto> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findOwnedDocument(tx, {
        studentId: input.studentId,
        documentId: input.documentId,
      });
      const revisionSheet = await tx.revisionSheet.upsert({
        where: { documentId: input.documentId },
        create: {
          documentId: input.documentId,
          subjectId: document.subjectId,
          studentId: input.studentId,
          status: 'FAILED',
          title: null,
          introduction: null,
          keyPoints: Prisma.JsonNull,
          commonMistakes: Prisma.JsonNull,
          mustKnow: Prisma.JsonNull,
          practiceSuggestions: Prisma.JsonNull,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: input.errorCode,
        },
        update: {
          status: 'FAILED',
          title: null,
          introduction: null,
          keyPoints: Prisma.JsonNull,
          commonMistakes: Prisma.JsonNull,
          mustKnow: Prisma.JsonNull,
          practiceSuggestions: Prisma.JsonNull,
          generatedAt: input.metadata.generatedAt,
          flowName: input.metadata.flowName,
          provider: input.metadata.provider,
          model: input.metadata.model,
          promptVersion: input.metadata.promptVersion,
          schemaVersion: input.metadata.schemaVersion,
          inputSize: input.metadata.inputSize ?? null,
          sourceStrategy: input.metadata.sourceStrategy,
          errorCode: input.errorCode,
        },
      });

      await tx.revisionSheetSection.deleteMany({
        where: { revisionSheetId: revisionSheet.id },
      });

      return this.toRevisionSheetDto({
        ...revisionSheet,
        sections: [],
      });
    });
  }

  private async findOwnedDocument(
    prisma: StudyArtifactsPrismaClient,
    input: {
      studentId: string;
      documentId: string;
    },
  ): Promise<DocumentRecord> {
    const document = await prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    return document;
  }

  private assertReadyDocument(document: DocumentRecord): void {
    if (document.status !== 'READY') {
      throw new Error('Document is not ready');
    }
  }

  private assertSectionsRequired(
    sections: ReadyRevisionSheetInput['sections'],
  ): void {
    if (sections.length === 0) {
      throw new Error('Revision sheet sections are required');
    }
  }

  private assertSourcesRequired(
    sources: StudyArtifactSourceInput[],
    message: string,
  ): void {
    if (sources.length === 0) {
      throw new Error(message);
    }
  }

  private uniqueSources(
    sources: StudyArtifactSourceInput[],
  ): StudyArtifactSourceInput[] {
    const seen = new Set<string>();
    const unique: StudyArtifactSourceInput[] = [];

    for (const source of sources) {
      if (seen.has(source.chunkId)) {
        continue;
      }
      seen.add(source.chunkId);
      unique.push({
        chunkId: source.chunkId,
        relevanceScore: source.relevanceScore ?? null,
      });
    }

    return unique;
  }

  private async findValidatedChunks(
    prisma: StudyArtifactsPrismaClient,
    document: DocumentRecord,
    sources: StudyArtifactSourceInput[],
    errorMessage: string,
  ): Promise<void> {
    const uniqueChunkIds = [
      ...new Set(sources.map((source) => source.chunkId)),
    ];
    const chunks = await prisma.documentChunk.findMany({
      where: {
        id: { in: uniqueChunkIds },
        documentId: document.id,
        subjectId: document.subjectId,
      },
      select: { id: true },
    });
    const found = new Set(chunks.map((chunk) => chunk.id));
    const allSourcesExist = uniqueChunkIds.every((chunkId) =>
      found.has(chunkId),
    );

    if (!allSourcesExist) {
      throw new Error(errorMessage);
    }
  }

  private toSummaryDto(summary: SummaryRecord): SummaryDto {
    return {
      id: summary.id,
      documentId: summary.documentId,
      subjectId: summary.subjectId,
      status: summary.status as SummaryDto['status'],
      title: summary.title,
      content: summary.content,
      keyPoints: this.toStringArray(summary.keyPoints),
      limits: summary.limits,
      metadata: this.toMetadata(summary),
      errorCode: summary.errorCode,
      sources: this.toSourcesDto(summary.sources ?? []),
    };
  }

  private toRevisionSheetDto(
    revisionSheet: RevisionSheetRecord,
  ): RevisionSheetDto {
    return {
      id: revisionSheet.id,
      documentId: revisionSheet.documentId,
      subjectId: revisionSheet.subjectId,
      status: revisionSheet.status as RevisionSheetDto['status'],
      title: revisionSheet.title,
      introduction: revisionSheet.introduction,
      keyPoints: this.toStringArray(revisionSheet.keyPoints),
      commonMistakes: this.toStringArray(revisionSheet.commonMistakes),
      mustKnow: this.toStringArray(revisionSheet.mustKnow),
      practiceSuggestions: this.toStringArray(
        revisionSheet.practiceSuggestions,
      ),
      metadata: this.toMetadata(revisionSheet),
      errorCode: revisionSheet.errorCode,
      sections: this.toRevisionSheetSectionsDto(revisionSheet.sections ?? []),
    };
  }

  private toMetadata(record: {
    flowName: string;
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    generatedAt: Date;
    inputSize: number | null;
    sourceStrategy: string;
  }): StudyArtifactMetadata {
    return {
      flowName: record.flowName,
      provider: record.provider,
      model: record.model,
      promptVersion: record.promptVersion,
      schemaVersion: record.schemaVersion,
      generatedAt: record.generatedAt,
      inputSize: record.inputSize,
      sourceStrategy:
        record.sourceStrategy as StudyArtifactMetadata['sourceStrategy'],
    };
  }

  private toRevisionSheetSectionsDto(
    sections: RevisionSheetSectionRecord[],
  ): RevisionSheetSectionDto[] {
    return [...sections]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((section) => ({
        id: section.id,
        displayOrder: section.displayOrder,
        title: section.title,
        content: section.content,
        sources: this.toSourcesDto(section.sources ?? []),
      }));
  }

  private toSourcesDto(
    sources: Array<{
      chunkId: string;
      relevanceScore: number | null;
      chunk: ChunkRecord;
    }>,
  ): StudyArtifactSourceDto[] {
    return [...sources]
      .sort((left, right) => left.chunk.index - right.chunk.index)
      .map((source) => ({
        chunkId: source.chunkId,
        text: source.chunk.text,
        pageNumber: source.chunk.pageNumber,
        index: source.chunk.index,
        relevanceScore: source.relevanceScore,
      }));
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }
}
