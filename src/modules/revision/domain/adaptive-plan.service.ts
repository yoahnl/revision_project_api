import { Subject } from '../../subjects/domain/subject.entity';
import { KnowledgeUnit } from './knowledge-unit.entity';
import { MasteryState } from './mastery-state.entity';
import { RevisionGoal } from './revision-goal.entity';

export type RevisionActivityType = 'diagnostic_quiz';

export interface RevisionPlanItem {
  subjectId: string;
  knowledgeUnitId: string;
  activityType: RevisionActivityType;
  estimatedMinutes: number;
  reason: string;
}

export interface RevisionPlan {
  generatedAt: Date;
  items: RevisionPlanItem[];
}

export class AdaptivePlanService {
  buildTodayPlan(input: {
    now: Date;
    goal: RevisionGoal;
    subjects: Subject[];
    knowledgeUnits: KnowledgeUnit[];
    masteryStates: MasteryState[];
  }): RevisionPlan {
    const eligibleSubjects = input.subjects.filter(
      (subject) => subject.studentId === input.goal.studentId,
    );
    const masteryByUnit = new Map(
      input.masteryStates
        .filter((state) => state.studentId === input.goal.studentId)
        .map((state) => [state.knowledgeUnitId, state]),
    );
    const subjectById = new Map(
      eligibleSubjects.map((subject) => [subject.id, subject]),
    );

    const ranked = input.knowledgeUnits
      .filter((unit) => subjectById.has(unit.subjectId))
      .map((unit) => {
        const mastery = masteryByUnit.get(unit.id);
        const subject = subjectById.get(unit.subjectId);
        const masteryScore = mastery?.score ?? 0;
        const priority = subject?.priority ?? 1;
        const staleBoost = mastery?.lastPracticedAt
          ? Math.min(
              0.25,
              (input.now.getTime() - mastery.lastPracticedAt.getTime()) /
                (1000 * 60 * 60 * 24 * 30),
            )
          : 0.25;

        return {
          unit,
          rank: priority * (1 - masteryScore) + staleBoost,
          masteryScore,
        };
      })
      .sort((a, b) => b.rank - a.rank);

    const top = ranked[0];

    if (!top) {
      return {
        generatedAt: input.now,
        items: [],
      };
    }

    return {
      generatedAt: input.now,
      items: [
        {
          subjectId: top.unit.subjectId,
          knowledgeUnitId: top.unit.id,
          activityType: 'diagnostic_quiz',
          estimatedMinutes: 15,
          reason:
            top.masteryScore < 0.4
              ? 'Recommended because this knowledge unit has low mastery.'
              : 'Recommended to keep this knowledge unit fresh before the exam.',
        },
      ],
    };
  }
}
