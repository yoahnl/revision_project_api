import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTS_REPOSITORY } from './documents.repository';
import type { DocumentsRepository } from './documents.repository';

@Injectable()
export class GetDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: { studentId: string; documentId: string }) {
    const document = await this.documentsRepository.findByIdForStudent(input);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }
}
