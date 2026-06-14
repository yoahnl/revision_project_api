import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTS_REPOSITORY } from './documents.repository';
import type {
  DocumentsRepository,
  PublicRevisionDocumentDto,
  RevisionDocumentDto,
} from './documents.repository';

@Injectable()
export class GetDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<PublicRevisionDocumentDto> {
    const document = await this.documentsRepository.findByIdForStudent(input);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return toPublicDocument(document);
  }
}

export function toPublicDocument(
  document: RevisionDocumentDto,
): PublicRevisionDocumentDto {
  return {
    id: document.id,
    subjectId: document.subjectId,
    kind: document.kind,
    fileName: document.fileName,
    mimeType: document.mimeType,
    status: document.status,
    errorCode: document.errorCode,
  };
}
