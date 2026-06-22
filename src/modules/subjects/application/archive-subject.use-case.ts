import { Inject, Injectable } from '@nestjs/common';
import { SUBJECTS_REPOSITORY } from './subjects.repository';
import type { SubjectsRepository } from './subjects.repository';

@Injectable()
export class ArchiveSubjectUseCase {
  constructor(
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  async execute(input: { studentId: string; subjectId: string }) {
    const decision = await this.subjectsRepository.archiveForStudent({
      ...input,
      reason: 'USER_ARCHIVED',
    });

    if (!decision) {
      throw new Error('Subject not found');
    }

    return decision;
  }
}
