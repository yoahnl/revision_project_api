import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseBackfillDryRunResult,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class BackfillCoursesFromDocumentsDryRunUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(): Promise<CourseBackfillDryRunResult> {
    return this.coursesRepository.backfillFromExistingDocumentsDryRun();
  }
}
