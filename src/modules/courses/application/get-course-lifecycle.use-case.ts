import { Inject, Injectable } from '@nestjs/common';
import { COURSES_REPOSITORY } from './courses.repository';
import type { CoursesRepository } from './courses.repository';

@Injectable()
export class GetCourseLifecycleUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: { studentId: string; courseId: string }) {
    const decision =
      await this.coursesRepository.getLifecycleDecisionForStudent(input);

    if (!decision) {
      throw new Error('Course not found');
    }

    return decision;
  }
}
