import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class DeleteCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<{ deleted: true }> {
    const deleted = await this.coursesRepository.deleteIfEmpty({
      studentId: requiredId(input.studentId, 'studentId'),
      courseId: requiredId(input.courseId, 'courseId'),
    });

    if (!deleted) {
      throw new Error('Course not found');
    }

    return { deleted: true };
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}
