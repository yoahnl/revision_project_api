import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type OpenAnswerSubmissionResult,
} from './activities.repository';
import { OPEN_QUESTION_MAX_ANSWER_LENGTH } from './start-open-question-activity.use-case';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../revision/application/revision.repository';
import { MasteryState } from '../../revision/domain/mastery-state.entity';
import {
  OPEN_ANSWER_EVALUATOR,
  type OpenAnswerEvaluator,
} from './open-answer-evaluator';
import {
  ACTIVITY_CLOCK,
  type ActivityClock,
} from './submit-activity-result.use-case';

export const OPEN_ANSWER_MIN_LENGTH = 12;

@Injectable()
export class SubmitOpenAnswerUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(OPEN_ANSWER_EVALUATOR)
    private readonly openAnswerEvaluator: OpenAnswerEvaluator,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
    @Optional()
    @Inject(ACTIVITY_CLOCK)
    private readonly now: ActivityClock = () => new Date(),
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

    const context =
      await this.activitiesRepository.findOpenAnswerEvaluationContext({
        studentId: input.studentId,
        sessionId: input.sessionId,
      });

    try {
      const evaluation = await this.openAnswerEvaluator.evaluate({
        studentId: input.studentId,
        subjectId: context.subjectId,
        documentId: context.documentId,
        activitySessionId: context.sessionId,
        knowledgeUnit: context.knowledgeUnit,
        question: context.question,
        answerText,
        chunks: context.chunks,
      });
      const result = await this.activitiesRepository.saveOpenAnswerEvaluation({
        studentId: input.studentId,
        sessionId: input.sessionId,
        answerText,
        evaluation,
      });
      await this.updateMastery({
        studentId: input.studentId,
        knowledgeUnitId: context.knowledgeUnit.id,
        score: evaluation.score,
        maxScore: evaluation.maxScore,
      });

      return result;
    } catch (error) {
      return this.activitiesRepository.saveOpenAnswerEvaluation({
        studentId: input.studentId,
        sessionId: input.sessionId,
        answerText,
        evaluation: {
          status: 'FAILED',
          errorCode: resolveOpenAnswerEvaluationErrorCode(error),
        },
      });
    }
  }

  private async updateMastery(input: {
    studentId: string;
    knowledgeUnitId: string;
    score: number;
    maxScore: number;
  }): Promise<void> {
    const ratio = input.maxScore === 0 ? 0 : input.score / input.maxScore;
    const practicedAt = this.now();
    const masteryStates = await this.revisionRepository.findMasteryStates(
      input.studentId,
    );
    const currentMastery =
      masteryStates.find(
        (masteryState) =>
          masteryState.knowledgeUnitId === input.knowledgeUnitId,
      ) ??
      new MasteryState({
        studentId: input.studentId,
        knowledgeUnitId: input.knowledgeUnitId,
        score: 0,
        lastPracticedAt: null,
      });
    const nextMastery = currentMastery.applyOpenAnswerRatio(ratio, practicedAt);

    await this.revisionRepository.upsertMastery({
      studentId: nextMastery.studentId,
      knowledgeUnitId: nextMastery.knowledgeUnitId,
      score: nextMastery.score,
      lastPracticedAt: nextMastery.lastPracticedAt ?? practicedAt,
    });
  }
}

function resolveOpenAnswerEvaluationErrorCode(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'OPEN_ANSWER_EVALUATION_FAILED';
}
