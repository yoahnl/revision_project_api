import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type OpenAnswerSubmissionResult,
} from './activities.repository';
import { OPEN_QUESTION_MAX_ANSWER_LENGTH } from './start-open-question-activity.use-case';

export const OPEN_ANSWER_MIN_LENGTH = 12;

@Injectable()
export class SubmitOpenAnswerUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
    answerText: string;
  }): Promise<OpenAnswerSubmissionResult> {
    const answerText = input.answerText.trim();

    if (answerText.length < OPEN_ANSWER_MIN_LENGTH) {
      throw new Error('Open answer is too short');
    }

    if (answerText.length > OPEN_QUESTION_MAX_ANSWER_LENGTH) {
      throw new Error('Open answer is too long');
    }

    return this.activitiesRepository.submitOpenAnswer({
      studentId: input.studentId,
      sessionId: input.sessionId,
      answerText,
    });
  }
}
