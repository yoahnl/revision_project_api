import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENTS_REPOSITORY } from './documents.repository';
import type { DocumentsRepository } from './documents.repository';

@Injectable()
export class ListSubjectDocumentsUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  execute(input: { studentId: string; subjectId: string }) {
    return this.documentsRepository.findBySubjectForStudent(input);
  }
}
