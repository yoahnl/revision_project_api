import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTS_REPOSITORY } from './documents.repository';
import type { DocumentsRepository } from './documents.repository';

@Injectable()
export class DeleteDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<void> {
    const deleted = await this.documentsRepository.deleteForStudent(input);

    if (!deleted) {
      throw new NotFoundException('Document not found');
    }
  }
}
