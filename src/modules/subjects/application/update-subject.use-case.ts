import { Inject, Injectable } from '@nestjs/common';
import { SUBJECTS_REPOSITORY } from './subjects.repository';
import type { SubjectsRepository } from './subjects.repository';

@Injectable()
export class UpdateSubjectUseCase {
  constructor(
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    name?: string;
    priority?: 1 | 2 | 3 | 4 | 5;
  }) {
    const updated = await this.subjectsRepository.updateForStudent(input);

    if (!updated) {
      throw new Error('Subject not found');
    }

    return updated;
  }
}
