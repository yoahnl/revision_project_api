import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DOCUMENTS_REPOSITORY } from './documents.repository';
import type { DocumentsRepository } from './documents.repository';

@Injectable()
export class ListDocumentKnowledgeUnitsUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: { studentId: string; documentId: string }) {
    const result =
      await this.documentsRepository.findKnowledgeUnitsByDocumentForStudent(
        input,
      );

    if (!result) {
      throw new NotFoundException('Document not found');
    }

    if (result.documentStatus !== 'READY') {
      throw new ConflictException('Document is not ready');
    }

    return {
      documentId: result.documentId,
      items: result.items,
    };
  }
}
