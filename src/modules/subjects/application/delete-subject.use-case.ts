import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SUBJECTS_REPOSITORY } from './subjects.repository';
import type { SubjectsRepository } from './subjects.repository';

@Injectable()
export class DeleteSubjectUseCase {
  constructor(
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  async execute(input: {
    subjectId: string;
    studentId: string;
  }): Promise<void> {
    const deleted = await this.subjectsRepository.deleteForStudent(input);

    if (!deleted) {
      throw new NotFoundException('Subject not found');
    }
  }
}
