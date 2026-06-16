import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
} from '../activities.repository';
import type { RichClosedExerciseResult } from './rich-closed-question.types';

@Injectable()
export class GetRichClosedExerciseResultUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
  ) {}

  execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RichClosedExerciseResult> {
    return this.activitiesRepository.getRichClosedExerciseResultForStudent(
      input,
    );
  }
}
