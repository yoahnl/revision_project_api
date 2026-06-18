import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class GetCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDto> {
    const course = await this.coursesRepository.findByIdForStudent({
      studentId: requiredId(input.studentId, 'studentId'),
      courseId: requiredId(input.courseId, 'courseId'),
    });

    if (!course) {
      throw new Error('Course not found');
    }

    return course;
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}
