import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
} from '../activities.repository';
import {
  RICH_CLOSED_SESSION_ALREADY_COMPLETED,
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
} from './rich-closed-question-errors';
import { scoreRichClosedExerciseSubmission } from './rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedExerciseResult,
} from './rich-closed-question.types';

@Injectable()
export class SubmitRichClosedExerciseUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
    answers: RichClosedAnswer[];
  }): Promise<RichClosedExerciseResult> {
    const internal =
      await this.activitiesRepository.getInternalRichClosedExerciseForStudent({
        studentId: input.studentId,
        sessionId: input.sessionId,
      });

    if (internal.status !== 'STARTED' || internal.result) {
      throw new Error(RICH_CLOSED_SESSION_ALREADY_COMPLETED);
    }

    let result: RichClosedExerciseResult;

    try {
      result = scoreRichClosedExerciseSubmission({
        sessionId: input.sessionId,
        exercise: internal.exercise,
        answers: input.answers,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === RICH_CLOSED_SESSION_ALREADY_COMPLETED
      ) {
        throw error;
      }

      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return this.activitiesRepository.saveRichClosedExerciseResult({
      studentId: input.studentId,
      sessionId: input.sessionId,
      answers: input.answers,
      result,
    });
  }
}
