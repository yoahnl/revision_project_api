import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
  type CourseWithSourceStatsDto,
} from './courses.repository';

@Injectable()
export class ListSubjectCoursesWithStatsUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]> {
    return this.coursesRepository.listBySubjectForStudentWithStats({
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
