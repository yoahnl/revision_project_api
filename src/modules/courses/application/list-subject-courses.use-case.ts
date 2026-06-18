import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class ListSubjectCoursesUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseDto[]> {
    return this.coursesRepository.listBySubjectForStudent({
      studentId: requiredId(input.studentId, 'studentId'),
      subjectId: requiredId(input.subjectId, 'subjectId'),
    });
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}
