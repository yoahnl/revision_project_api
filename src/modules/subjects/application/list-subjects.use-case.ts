import { Inject, Injectable } from '@nestjs/common';
import { SUBJECTS_REPOSITORY } from './subjects.repository';
import type { SubjectsRepository } from './subjects.repository';

@Injectable()
export class ListSubjectsUseCase {
  constructor(
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  execute(studentId: string) {
    return this.subjectsRepository.findByStudent(studentId);
  }
}
