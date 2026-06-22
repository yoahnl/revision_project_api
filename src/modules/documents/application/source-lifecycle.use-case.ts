import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from './documents.repository';
import type { SourceLifecycleDecision } from '../domain/source-lifecycle.entity';

@Injectable()
export class GetDocumentSourceLifecycleUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<SourceLifecycleDecision> {
    const decision =
      await this.documentsRepository.getLifecycleDecisionForStudent(input);

    if (!decision) {
      throw new NotFoundException('Document not found');
    }

    return decision;
  }
}

@Injectable()
export class ArchiveDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<SourceLifecycleDecision> {
    const decision = await this.documentsRepository.archiveForStudent({
      ...input,
      reason: 'USER_ARCHIVED_DOCUMENT',
    });

    if (!decision) {
      throw new NotFoundException('Document not found');
    }

    return decision;
  }
}
