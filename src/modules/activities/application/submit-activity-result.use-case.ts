import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../revision/application/revision.repository';
import { MasteryState } from '../../revision/domain/mastery-state.entity';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
} from './activities.repository';

export const ACTIVITY_CLOCK = Symbol('ACTIVITY_CLOCK');
export type ActivityClock = () => Date;

@Injectable()
export class SubmitActivityResultUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
    @Optional()
    @Inject(ACTIVITY_CLOCK)
    private readonly now: ActivityClock = () => new Date(),
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{ questionId: string; choiceId: string }>;
  }): Promise<{ correctAnswers: number; totalQuestions: number }> {
    const result = await this.activitiesRepository.submitResult(input);
    const practicedAt = this.now();
    const masteryStates = await this.revisionRepository.findMasteryStates(
      input.studentId,
    );
    const currentMastery =
      masteryStates.find(
        (masteryState) =>
          masteryState.knowledgeUnitId === result.knowledgeUnitId,
      ) ??
      new MasteryState({
        studentId: input.studentId,
        knowledgeUnitId: result.knowledgeUnitId,
        score: 0,
        lastPracticedAt: null,
      });
    const nextMastery = currentMastery.applyQuizResult(
      result.correctAnswers,
      result.totalQuestions,
      practicedAt,
    );

    await this.revisionRepository.upsertMastery({
      studentId: nextMastery.studentId,
      knowledgeUnitId: nextMastery.knowledgeUnitId,
      score: nextMastery.score,
      lastPracticedAt: nextMastery.lastPracticedAt ?? practicedAt,
    });

    return {
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
    };
  }
}
