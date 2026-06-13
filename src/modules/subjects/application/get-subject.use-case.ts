import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SUBJECTS_REPOSITORY } from './subjects.repository';
import type { SubjectsRepository } from './subjects.repository';

@Injectable()
export class GetSubjectUseCase {
  constructor(
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  async execute(input: { subjectId: string; studentId: string }) {
    const subject = await this.subjectsRepository.findByIdForStudent(input);

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }
}
