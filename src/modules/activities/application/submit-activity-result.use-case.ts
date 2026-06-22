import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../revision/application/revision.repository';
import { MasteryState } from '../../revision/domain/mastery-state.entity';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type DiagnosticQuizSubmissionResult,
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
    answers: Array<{
      questionId: string;
      choiceId?: string;
      choiceIds?: string[];
    }>;
  }): Promise<Omit<DiagnosticQuizSubmissionResult, 'knowledgeUnitId'>> {
    const result = await this.activitiesRepository.submitResult(input);
    const practicedAt = this.now();
    const masteryStates = await this.revisionRepository.findMasteryStates(
      input.studentId,
    );
    const masteryByKnowledgeUnitId = new Map(
      masteryStates.map((masteryState) => [
        masteryState.knowledgeUnitId,
        masteryState,
      ]),
    );
    const quizResultsByKnowledgeUnitId = groupQuizItemsByKnowledgeUnit(result);

    for (const [knowledgeUnitId, quizResult] of quizResultsByKnowledgeUnitId) {
      const currentMastery =
        masteryByKnowledgeUnitId.get(knowledgeUnitId) ??
        new MasteryState({
          studentId: input.studentId,
          knowledgeUnitId,
          score: 0,
          lastPracticedAt: null,
        });
      const nextMastery = currentMastery.applyQuizResult(
        quizResult.correctAnswers,
        quizResult.totalQuestions,
        practicedAt,
      );

      await this.revisionRepository.upsertMastery({
        studentId: nextMastery.studentId,
        knowledgeUnitId: nextMastery.knowledgeUnitId,
        score: nextMastery.score,
        lastPracticedAt: nextMastery.lastPracticedAt ?? practicedAt,
      });
    }

    const { knowledgeUnitId, ...publicResult } = result;
    void knowledgeUnitId;

    return publicResult;
  }
}

function groupQuizItemsByKnowledgeUnit(
  result: DiagnosticQuizSubmissionResult,
): Map<string, { correctAnswers: number; totalQuestions: number }> {
  const grouped = new Map<
    string,
    { correctAnswers: number; totalQuestions: number }
  >();

  for (const item of result.items) {
    const knowledgeUnitId = item.knowledgeUnitId ?? result.knowledgeUnitId;
    const group = grouped.get(knowledgeUnitId) ?? {
      correctAnswers: 0,
      totalQuestions: 0,
    };

    grouped.set(knowledgeUnitId, {
      correctAnswers: group.correctAnswers + (item.isCorrect ? 1 : 0),
      totalQuestions: group.totalQuestions + 1,
    });
  }

  if (grouped.size === 0) {
    grouped.set(result.knowledgeUnitId, {
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
    });
  }

  return grouped;
}
