import { Inject, Injectable } from '@nestjs/common';
import { SUBJECTS_REPOSITORY } from './subjects.repository';
import type { SubjectsRepository } from './subjects.repository';

@Injectable()
export class CreateSubjectUseCase {
  constructor(
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  execute(input: {
    studentId: string;
    name: string;
    priority: 1 | 2 | 3 | 4 | 5;
  }) {
    return this.subjectsRepository.create({
      studentId: input.studentId,
      name: input.name.trim(),
      priority: input.priority,
    });
  }
}
