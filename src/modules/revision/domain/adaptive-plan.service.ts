import { Subject } from '../../subjects/domain/subject.entity';
import { KnowledgeUnit } from './knowledge-unit.entity';
import { MasteryState } from './mastery-state.entity';
import { RevisionGoal } from './revision-goal.entity';

export const TODAY_PLAN_MAX_ITEMS = 4;

export type TodayPlanActionType =
  | 'diagnostic_quiz'
  | 'open_question'
  | 'revision_session';

export type TodayPlanPreferredAction = 'diagnostic_quiz' | 'open_question';

export type TodayPlanReasonCode =
  | 'LOW_MASTERY'
  | 'STALE_PRACTICE'
  | 'HIGH_PRIORITY_SUBJECT'
  | 'MIX_ACTIVITY_TYPE'
  | 'START_REVISION_SESSION'
  | 'CONTINUE_PROGRESS';

export interface RevisionPlanStartPayload {
  subjectId: string;
  knowledgeUnitId?: string;
  preferredAction?: TodayPlanPreferredAction;
}

export interface RevisionPlanItem {
  id: string;
  subjectId: string;
  knowledgeUnitId: string;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  priority: number;
  reasonCode: TodayPlanReasonCode;
  startPayload: RevisionPlanStartPayload;
}

export interface RevisionPlan {
  generatedAt: Date;
  items: RevisionPlanItem[];
}

type RankedUnit = {
  unit: KnowledgeUnit;
  subject: Subject;
  mastery: MasteryState | undefined;
  rank: number;
  baseReasonCode: TodayPlanReasonCode;
};

type CandidateItem = RevisionPlanItem & {
  unitRank: number;
  subjectPriority: number;
  subjectName: string;
  unitTitle: string;
  actionOrder: number;
};

export class AdaptivePlanService {
  buildTodayPlan(input: {
    now: Date;
    goal: RevisionGoal;
    subjects: Subject[];
    knowledgeUnits: KnowledgeUnit[];
    masteryStates: MasteryState[];
  }): RevisionPlan {
    const rankedUnits = this.rankKnowledgeUnits(input);

    return {
      generatedAt: input.now,
      items: selectTodayItems(rankedUnits).map(toRevisionPlanItem),
    };
  }

  private rankKnowledgeUnits(input: {
    now: Date;
    goal: RevisionGoal;
    subjects: Subject[];
    knowledgeUnits: KnowledgeUnit[];
    masteryStates: MasteryState[];
  }): RankedUnit[] {
    const eligibleSubjects = input.subjects.filter(
      (subject) => subject.studentId === input.goal.studentId,
    );
    const subjectById = new Map(
      eligibleSubjects.map((subject) => [subject.id, subject]),
    );
    const masteryByUnit = new Map(
      input.masteryStates
        .filter((state) => state.studentId === input.goal.studentId)
        .map((state) => [state.knowledgeUnitId, state]),
    );

    return input.knowledgeUnits
      .map((unit) => {
        const subject = subjectById.get(unit.subjectId);

        if (!subject) {
          return null;
        }

        const mastery = masteryByUnit.get(unit.id);
        const masteryScore = mastery?.score ?? 0;
        const lowMasteryBoost = (1 - masteryScore) * 100;
        const staleBoost = resolveStaleBoost({
          now: input.now,
          lastPracticedAt: mastery?.lastPracticedAt ?? null,
        });
        const rank = subject.priority * 100 + lowMasteryBoost + staleBoost;

        return {
          unit,
          subject,
          mastery,
          rank,
          baseReasonCode: resolveBaseReasonCode({
            subject,
            mastery,
            staleBoost,
          }),
        };
      })
      .filter((item): item is RankedUnit => item !== null)
      .sort(compareRankedUnits);
  }
}

function selectTodayItems(rankedUnits: RankedUnit[]): CandidateItem[] {
  const candidates = rankedUnits.flatMap(toCandidates).sort(compareCandidates);
  const selected: CandidateItem[] = [];
  const selectedIds = new Set<string>();

  addFirstCandidateOfAction(
    'diagnostic_quiz',
    candidates,
    selected,
    selectedIds,
  );
  addSpreadDiagnosticQuiz(candidates, selected, selectedIds);
  addFirstCandidateOfAction('open_question', candidates, selected, selectedIds);
  addFirstCandidateOfAction(
    'revision_session',
    candidates,
    selected,
    selectedIds,
  );

  for (const candidate of candidates) {
    if (selected.length >= TODAY_PLAN_MAX_ITEMS) {
      break;
    }

    addCandidate(candidate, selected, selectedIds);
  }

  return selected.sort(compareCandidates).slice(0, TODAY_PLAN_MAX_ITEMS);
}

function addFirstCandidateOfAction(
  action: TodayPlanActionType,
  candidates: CandidateItem[],
  selected: CandidateItem[],
  selectedIds: Set<string>,
) {
  const candidate = candidates.find((item) => item.action === action);

  if (candidate) {
    addCandidate(candidate, selected, selectedIds);
  }
}

function addSpreadDiagnosticQuiz(
  candidates: CandidateItem[],
  selected: CandidateItem[],
  selectedIds: Set<string>,
) {
  const firstSelectedUnitId = selected[0]?.knowledgeUnitId;
  const candidate = candidates.find(
    (item) =>
      item.action === 'diagnostic_quiz' &&
      item.knowledgeUnitId !== firstSelectedUnitId,
  );

  if (candidate) {
    addCandidate(candidate, selected, selectedIds);
  }
}

function addCandidate(
  candidate: CandidateItem,
  selected: CandidateItem[],
  selectedIds: Set<string>,
) {
  if (
    selected.length >= TODAY_PLAN_MAX_ITEMS ||
    selectedIds.has(candidate.id)
  ) {
    return;
  }

  selected.push(candidate);
  selectedIds.add(candidate.id);
}

function toCandidates(rankedUnit: RankedUnit): CandidateItem[] {
  return [
    toCandidate({
      rankedUnit,
      action: 'diagnostic_quiz',
      estimatedMinutes: 12,
      actionBoost: 30,
      actionOrder: 0,
      reasonCode: rankedUnit.baseReasonCode,
      startPayload: {
        subjectId: rankedUnit.subject.id,
        knowledgeUnitId: rankedUnit.unit.id,
        preferredAction: 'diagnostic_quiz',
      },
    }),
    toCandidate({
      rankedUnit,
      action: 'open_question',
      estimatedMinutes: 18,
      actionBoost: 20,
      actionOrder: 1,
      reasonCode: 'MIX_ACTIVITY_TYPE',
      startPayload: {
        subjectId: rankedUnit.subject.id,
        knowledgeUnitId: rankedUnit.unit.id,
        preferredAction: 'open_question',
      },
    }),
    toCandidate({
      rankedUnit,
      action: 'revision_session',
      estimatedMinutes: 25,
      actionBoost: 10,
      actionOrder: 2,
      reasonCode: 'START_REVISION_SESSION',
      startPayload: {
        subjectId: rankedUnit.subject.id,
        knowledgeUnitId: rankedUnit.unit.id,
      },
    }),
  ];
}

function toCandidate(input: {
  rankedUnit: RankedUnit;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  actionBoost: number;
  actionOrder: number;
  reasonCode: TodayPlanReasonCode;
  startPayload: RevisionPlanStartPayload;
}): CandidateItem {
  const priority = Math.round(input.rankedUnit.rank + input.actionBoost);

  return {
    id: `${input.rankedUnit.subject.id}:${input.rankedUnit.unit.id}:${input.action}`,
    subjectId: input.rankedUnit.subject.id,
    knowledgeUnitId: input.rankedUnit.unit.id,
    action: input.action,
    estimatedMinutes: input.estimatedMinutes,
    priority,
    reasonCode: input.reasonCode,
    startPayload: input.startPayload,
    unitRank: input.rankedUnit.rank,
    subjectPriority: input.rankedUnit.subject.priority,
    subjectName: input.rankedUnit.subject.name,
    unitTitle: input.rankedUnit.unit.title,
    actionOrder: input.actionOrder,
  };
}

function toRevisionPlanItem(candidate: CandidateItem): RevisionPlanItem {
  return {
    id: candidate.id,
    subjectId: candidate.subjectId,
    knowledgeUnitId: candidate.knowledgeUnitId,
    action: candidate.action,
    estimatedMinutes: candidate.estimatedMinutes,
    priority: candidate.priority,
    reasonCode: candidate.reasonCode,
    startPayload: candidate.startPayload,
  };
}

function resolveBaseReasonCode(input: {
  subject: Subject;
  mastery: MasteryState | undefined;
  staleBoost: number;
}): TodayPlanReasonCode {
  if (!input.mastery || input.mastery.score < 0.4) {
    return 'LOW_MASTERY';
  }

  if (!input.mastery.lastPracticedAt || input.staleBoost >= 20) {
    return 'STALE_PRACTICE';
  }

  if (input.subject.priority >= 4) {
    return 'HIGH_PRIORITY_SUBJECT';
  }

  return 'CONTINUE_PROGRESS';
}

function resolveStaleBoost(input: {
  now: Date;
  lastPracticedAt: Date | null;
}): number {
  if (!input.lastPracticedAt) {
    return 30;
  }

  const daysSincePractice = Math.max(
    0,
    (input.now.getTime() - input.lastPracticedAt.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return Math.min(30, daysSincePractice);
}

function compareRankedUnits(a: RankedUnit, b: RankedUnit): number {
  return (
    b.rank - a.rank ||
    b.subject.priority - a.subject.priority ||
    a.subject.name.localeCompare(b.subject.name) ||
    a.subject.id.localeCompare(b.subject.id) ||
    a.unit.title.localeCompare(b.unit.title) ||
    a.unit.id.localeCompare(b.unit.id)
  );
}

function compareCandidates(a: CandidateItem, b: CandidateItem): number {
  return (
    b.priority - a.priority ||
    b.unitRank - a.unitRank ||
    b.subjectPriority - a.subjectPriority ||
    a.subjectName.localeCompare(b.subjectName) ||
    a.subjectId.localeCompare(b.subjectId) ||
    a.unitTitle.localeCompare(b.unitTitle) ||
    a.knowledgeUnitId.localeCompare(b.knowledgeUnitId) ||
    a.actionOrder - b.actionOrder
  );
}
