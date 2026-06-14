import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { GenerateDocumentSummaryUseCase } from '../application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../application/get-revision-sheet.use-case';
import type {
  RevisionSheetDto,
  RevisionSheetSectionDto,
  StudyArtifactSourceDto,
  SummaryDto,
} from '../application/study-artifacts.repository';

@Controller('documents')
@UseGuards(FirebaseAuthGuard)
export class StudyArtifactsController {
  constructor(
    private readonly getDocumentSummary: GetDocumentSummaryUseCase,
    private readonly generateDocumentSummary: GenerateDocumentSummaryUseCase,
    private readonly getDocumentRevisionSheet: GetRevisionSheetUseCase,
    private readonly generateDocumentRevisionSheet: GenerateRevisionSheetUseCase,
  ) {}

  @Get(':documentId/summary')
  async getSummary(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const summary = await this.getDocumentSummary.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    if (!summary) {
      throw new NotFoundException('Document summary not found');
    }

    return toPublicSummary(summary);
  }

  @Post(':documentId/summary')
  async generateSummary(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const summary = await this.generateDocumentSummary.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    return toPublicSummary(summary);
  }

  @Get(':documentId/revision-sheet')
  async getRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const revisionSheet = await this.getDocumentRevisionSheet.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    if (!revisionSheet) {
      throw new NotFoundException('Revision sheet not found');
    }

    return toPublicRevisionSheet(revisionSheet);
  }

  @Post(':documentId/revision-sheet')
  async generateRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const revisionSheet = await this.generateDocumentRevisionSheet.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    return toPublicRevisionSheet(revisionSheet);
  }
}

function trimRequiredString(value: string | undefined, message: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function toPublicSummary(summary: SummaryDto) {
  return {
    id: summary.id,
    documentId: summary.documentId,
    subjectId: summary.subjectId,
    status: summary.status,
    title: summary.title,
    content: summary.content,
    keyPoints: summary.keyPoints,
    limits: summary.limits,
    errorCode: summary.errorCode,
    sources: summary.sources.map(toPublicSource),
  };
}

function toPublicRevisionSheet(revisionSheet: RevisionSheetDto) {
  return {
    id: revisionSheet.id,
    documentId: revisionSheet.documentId,
    subjectId: revisionSheet.subjectId,
    status: revisionSheet.status,
    title: revisionSheet.title,
    introduction: revisionSheet.introduction,
    keyPoints: revisionSheet.keyPoints,
    commonMistakes: revisionSheet.commonMistakes,
    mustKnow: revisionSheet.mustKnow,
    practiceSuggestions: revisionSheet.practiceSuggestions,
    errorCode: revisionSheet.errorCode,
    sections: revisionSheet.sections.map(toPublicRevisionSheetSection),
  };
}

function toPublicRevisionSheetSection(section: RevisionSheetSectionDto) {
  return {
    id: section.id,
    displayOrder: section.displayOrder,
    title: section.title,
    content: section.content,
    sources: section.sources.map(toPublicSource),
  };
}

function toPublicSource(source: StudyArtifactSourceDto) {
  return {
    chunkId: source.chunkId,
    text: source.text,
    pageNumber: source.pageNumber,
    index: source.index,
  };
}
