import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class GetCourseDetailUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto> {
    const detail = await this.coursesRepository.findDetailByIdForStudent({
      studentId: requiredId(input.studentId, 'studentId'),
      courseId: requiredId(input.courseId, 'courseId'),
    });

    if (!detail) {
      throw new Error('Course not found');
    }

    return detail;
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}
