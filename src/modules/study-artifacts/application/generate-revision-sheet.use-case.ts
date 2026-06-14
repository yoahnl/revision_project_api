import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type DocumentArtifactChunk,
  type DocumentArtifactKnowledgeUnit,
} from '../../ai/application/document-summary-generator';
import {
  REVISION_SHEET_GENERATOR,
  type RevisionSheetGenerator,
} from '../../ai/application/revision-sheet-generator';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/application/documents.repository';
import { GetRevisionSheetUseCase } from './get-revision-sheet.use-case';
import { SaveRevisionSheetUseCase } from './save-revision-sheet.use-case';
import type { RevisionSheetDto } from './study-artifacts.repository';

@Injectable()
export class GenerateRevisionSheetUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(REVISION_SHEET_GENERATOR)
    private readonly generator: RevisionSheetGenerator,
    private readonly getRevisionSheet: GetRevisionSheetUseCase,
    private readonly saveRevisionSheet: SaveRevisionSheetUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<RevisionSheetDto> {
    const existing = await this.getRevisionSheet.execute(input);

    if (existing?.status === 'READY') {
      return existing;
    }

    const { chunks, knowledgeUnits } = await this.loadGenerationContext(input);

    const generated = await this.generateRevisionSheet({
      documentId: input.documentId,
      chunks,
      knowledgeUnits,
    });
    const saved = await this.saveRevisionSheet.saveReady({
      studentId: input.studentId,
      documentId: input.documentId,
      title: generated.title,
      introduction: generated.introduction,
      keyPoints: generated.keyPoints,
      commonMistakes: generated.commonMistakes,
      mustKnow: generated.mustKnow,
      practiceSuggestions: generated.practiceSuggestions,
      metadata: generated.metadata,
      sections: generated.sections.map((section) => ({
        displayOrder: section.displayOrder,
        title: section.title,
        content: section.content,
        sources: section.sourceChunkIds.map((chunkId) => ({
          chunkId,
          relevanceScore: null,
        })),
      })),
    });

    return (await this.getRevisionSheet.execute(input)) ?? saved;
  }

  private async generateRevisionSheet(
    input: Parameters<RevisionSheetGenerator['generate']>[0],
  ) {
    try {
      return await this.generator.generate(input);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'REVISION_SHEET_SOURCE_INVALID'
      ) {
        throw new UnprocessableEntityException(
          'Revision sheet source is invalid',
        );
      }

      throw new BadGatewayException('Revision sheet generation failed');
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
