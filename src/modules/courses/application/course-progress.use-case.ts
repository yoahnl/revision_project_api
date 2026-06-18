import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseProgressDto,
  type CoursesRepository,
  type SubjectProgressDto,
} from './courses.repository';

@Injectable()
export class GetCourseProgressUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseProgressDto> {
    const progress =
      await this.coursesRepository.findCourseProgressByIdForStudent({
        studentId: requiredId(input.studentId, 'studentId'),
        courseId: requiredId(input.courseId, 'courseId'),
      });

    if (!progress) {
      throw new Error('Course not found');
    }

    return progress;
  }
}

@Injectable()
export class GetSubjectProgressUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
  }): Promise<SubjectProgressDto> {
    const progress = await this.coursesRepository.findSubjectProgressForStudent(
      {
        studentId: requiredId(input.studentId, 'studentId'),
        subjectId: requiredId(input.subjectId, 'subjectId'),
      },
    );

    if (!progress) {
      throw new Error('Course subject not found');
    }

    return progress;
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}
