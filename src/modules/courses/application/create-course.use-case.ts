import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    title: string;
    description?: string | null;
    chapterLabel?: string | null;
    estimatedMinutes?: number | null;
  }): Promise<CourseDto> {
    const studentId = requiredId(input.studentId, 'studentId');
    const subjectId = requiredId(input.subjectId, 'subjectId');
    const title = input.title.trim();

    if (title.length < 2) {
      throw new Error('Course title must contain at least 2 characters');
    }

    const estimatedMinutes = normalizeEstimatedMinutes(input.estimatedMinutes);

    return this.coursesRepository.create({
      studentId,
      subjectId,
      title,
      description: normalizeOptionalText(input.description),
      chapterLabel: normalizeOptionalText(input.chapterLabel),
      estimatedMinutes,
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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';

  return trimmed.length ? trimmed : null;
}

function normalizeEstimatedMinutes(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    throw new Error(
      'Course estimatedMinutes must be an integer between 1 and 1440',
    );
  }

  return value;
}
