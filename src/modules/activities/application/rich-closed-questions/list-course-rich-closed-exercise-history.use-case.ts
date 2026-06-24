import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
} from '../activities.repository';
import type { RichClosedExerciseHistoryResponse } from './rich-closed-question.types';

@Injectable()
export class ListCourseRichClosedExerciseHistoryUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
  ) {}

  execute(input: {
    studentId: string;
    courseId: string;
    limit: number;
  }): Promise<RichClosedExerciseHistoryResponse> {
    return this.activitiesRepository.listCourseRichClosedExerciseHistoryForStudent(
      input,
    );
  }
}
