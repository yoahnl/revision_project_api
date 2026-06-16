import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
} from '../activities.repository';
import type { RichClosedPublicExerciseEnvelope } from './rich-closed-question.types';

@Injectable()
export class GetRichClosedExerciseUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
  ) {}

  execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RichClosedPublicExerciseEnvelope> {
    return this.activitiesRepository.getRichClosedExerciseForStudent(input);
  }
}
