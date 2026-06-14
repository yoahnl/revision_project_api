import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  DOCUMENT_SUMMARY_GENERATOR,
  type DocumentArtifactChunk,
  type DocumentArtifactKnowledgeUnit,
  type DocumentSummaryGenerator,
} from '../../ai/application/document-summary-generator';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/application/documents.repository';
import { GetDocumentSummaryUseCase } from './get-document-summary.use-case';
import { SaveDocumentSummaryUseCase } from './save-document-summary.use-case';
import type { SummaryDto } from './study-artifacts.repository';

@Injectable()
export class GenerateDocumentSummaryUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_SUMMARY_GENERATOR)
    private readonly generator: DocumentSummaryGenerator,
    private readonly getDocumentSummary: GetDocumentSummaryUseCase,
    private readonly saveDocumentSummary: SaveDocumentSummaryUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<SummaryDto> {
    const existing = await this.getDocumentSummary.execute(input);

    if (existing?.status === 'READY') {
      return existing;
    }

    const { chunks, knowledgeUnits } = await this.loadGenerationContext(input);

    const generated = await this.generateSummary({
      documentId: input.documentId,
      chunks,
      knowledgeUnits,
    });
    const saved = await this.saveDocumentSummary.saveReady({
      studentId: input.studentId,
      documentId: input.documentId,
      title: generated.title,
      content: generated.content,
      keyPoints: generated.keyPoints,
      limits: generated.limits,
      metadata: generated.metadata,
      sources: generated.sourceChunkIds.map((chunkId) => ({
        chunkId,
        relevanceScore: null,
      })),
    });

    return (await this.getDocumentSummary.execute(input)) ?? saved;
  }

  private async generateSummary(
    input: Parameters<DocumentSummaryGenerator['generate']>[0],
  ) {
    try {
      return await this.generator.generate(input);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'SUMMARY_SOURCE_INVALID'
      ) {
        throw new UnprocessableEntityException('Summary source is invalid');
      }

      throw new BadGatewayException('Summary generation failed');
    }
  }

  private async loadGenerationContext(input: {
    studentId: string;
    documentId: string;
  }): Promise<{
    chunks: DocumentArtifactChunk[];
    knowledgeUnits: DocumentArtifactKnowledgeUnit[];
  }> {
    const document = await this.documentsRepository.findByIdForStudent(input);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== 'READY') {
      throw new ConflictException('Document is not ready');
    }

    const chunks = (
      await this.documentsRepository.findChunksByDocumentId(input.documentId)
    ).map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
    }));

    if (chunks.length === 0) {
      throw new ConflictException('Document has no chunks');
    }

    const knowledgeUnitsResult =
      await this.documentsRepository.findKnowledgeUnitsByDocumentForStudent(
        input,
      );
    const knowledgeUnits = (knowledgeUnitsResult?.items ?? [])
      .map((unit) => ({
        id: unit.id,
        title: unit.title,
        summary: unit.summary,
        sourceChunkIds: unit.sources.map((source) => source.chunkId),
      }))
      .filter((unit) => unit.sourceChunkIds.length > 0);

    if (knowledgeUnits.length === 0) {
      throw new ConflictException('Document has no sourced knowledge units');
    }

    return { chunks, knowledgeUnits };
  }
}
