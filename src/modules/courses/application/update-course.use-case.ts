import { Inject, Injectable } from '@nestjs/common';
import { COURSES_REPOSITORY } from './courses.repository';
import type {
  CoursesRepository,
  CourseWithSourceStatsDto,
} from './courses.repository';

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    title?: string;
    description?: string | null;
    chapterLabel?: string | null;
    estimatedMinutes?: number | null;
  }): Promise<CourseWithSourceStatsDto> {
    const updated = await this.coursesRepository.updateForStudent(input);

    if (!updated) {
      throw new Error('Course not found');
    }

    return updated;
  }
}
