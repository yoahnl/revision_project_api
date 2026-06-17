import { Subject } from '../../subjects/domain/subject.entity';
import { AdaptivePlanService } from './adaptive-plan.service';
import { KnowledgeUnit } from './knowledge-unit.entity';
import { MasteryState } from './mastery-state.entity';
import { RevisionGoal } from './revision-goal.entity';

describe('AdaptivePlanService', () => {
  const now = new Date('2026-06-15T10:00:00.000Z');

  it('returns an empty plan when no owned knowledge unit is eligible', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [
        subject({ id: 'subject-other', studentId: 'student-2', priority: 5 }),
      ],
      knowledgeUnits: [unit({ id: 'unit-other', subjectId: 'subject-other' })],
      masteryStates: [
        mastery({
          studentId: 'student-2',
          knowledgeUnitId: 'unit-other',
          score: 0.1,
        }),
      ],
    });

    expect(plan.items).toEqual([]);
  });

  it('returns several launchable action types for eligible knowledge units', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [
        unit({ id: 'unit-1', subjectId: 'subject-1', title: 'Contrats' }),
        unit({ id: 'unit-2', subjectId: 'subject-1', title: 'Responsabilite' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-1', score: 0.2 }),
        mastery({ knowledgeUnitId: 'unit-2', score: 0.45 }),
      ],
    });

    expect(plan.items).toHaveLength(4);
    expect(plan.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]),
    );
    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      action: 'diagnostic_quiz',
      reasonCode: 'LOW_MASTERY',
    });
  });

  it('prioritizes low mastery before stronger knowledge units', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 3 })],
      knowledgeUnits: [
        unit({ id: 'unit-strong', subjectId: 'subject-1' }),
        unit({ id: 'unit-weak', subjectId: 'subject-1' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-strong', score: 0.9 }),
        mastery({ knowledgeUnitId: 'unit-weak', score: 0.1 }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      knowledgeUnitId: 'unit-weak',
      action: 'diagnostic_quiz',
      reasonCode: 'LOW_MASTERY',
    });
  });

  it('boosts knowledge units that have never been practiced', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 3 })],
      knowledgeUnits: [
        unit({ id: 'unit-practiced', subjectId: 'subject-1' }),
        unit({ id: 'unit-never', subjectId: 'subject-1' }),
      ],
      masteryStates: [
        mastery({
          knowledgeUnitId: 'unit-practiced',
          score: 0.5,
          lastPracticedAt: new Date('2026-06-14T10:00:00.000Z'),
        }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      knowledgeUnitId: 'unit-never',
      reasonCode: 'LOW_MASTERY',
    });
  });

  it('takes subject priority into account', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [
        subject({ id: 'subject-low', name: 'Basse priorite', priority: 1 }),
        subject({ id: 'subject-high', name: 'Haute priorite', priority: 5 }),
      ],
      knowledgeUnits: [
        unit({ id: 'unit-low', subjectId: 'subject-low', title: 'Low' }),
        unit({ id: 'unit-high', subjectId: 'subject-high', title: 'High' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-low', score: 0.4 }),
        mastery({ knowledgeUnitId: 'unit-high', score: 0.4 }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-high',
      knowledgeUnitId: 'unit-high',
    });
  });

  it('keeps a stable order when scores are tied', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [
        subject({ id: 'subject-b', name: 'Biologie', priority: 3 }),
        subject({ id: 'subject-a', name: 'Anatomie', priority: 3 }),
      ],
      knowledgeUnits: [
        unit({ id: 'unit-b', subjectId: 'subject-b', title: 'Beta' }),
        unit({ id: 'unit-a', subjectId: 'subject-a', title: 'Alpha' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-b', score: 0.5 }),
        mastery({ knowledgeUnitId: 'unit-a', score: 0.5 }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-a',
      knowledgeUnitId: 'unit-a',
      action: 'diagnostic_quiz',
    });
  });

  it('does not exceed the maximum number of today items', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [
        unit({ id: 'unit-1', subjectId: 'subject-1' }),
        unit({ id: 'unit-2', subjectId: 'subject-1' }),
        unit({ id: 'unit-3', subjectId: 'subject-1' }),
        unit({ id: 'unit-4', subjectId: 'subject-1' }),
      ],
      masteryStates: [],
    });

    expect(plan.items).toHaveLength(4);
  });

  it('proposes open questions only when a knowledge unit is available', () => {
    const emptyPlan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [],
      masteryStates: [],
    });
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [unit({ id: 'unit-1', subjectId: 'subject-1' })],
      masteryStates: [],
    });

    expect(
      emptyPlan.items.some((item) => item.action === 'open_question'),
    ).toBe(false);
    expect(plan.items.some((item) => item.action === 'open_question')).toBe(
      true,
    );
  });

  it('returns rich closed actions with a bounded start payload', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [
        unit({
          id: 'unit-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
        }),
      ],
      masteryStates: [mastery({ knowledgeUnitId: 'unit-1', score: 0.2 })],
    });

    expect(plan.items).toContainEqual(
      expect.objectContaining({
        id: 'subject-1:unit-1:rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        action: 'rich_closed_exercise',
        estimatedMinutes: 8,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    );
  });

  it('omits rich closed document id from start payload when unavailable', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [unit({ id: 'unit-1', subjectId: 'subject-1' })],
      masteryStates: [mastery({ knowledgeUnitId: 'unit-1', score: 0.2 })],
    });
    const richClosedAction = plan.items.find(
      (item) => item.action === 'rich_closed_exercise',
    );

    expect(richClosedAction).toMatchObject({
      documentId: null,
      startPayload: {
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(richClosedAction?.startPayload).not.toHaveProperty('documentId');
  });

  it('returns revision session actions with explicit start payload', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [unit({ id: 'unit-1', subjectId: 'subject-1' })],
      masteryStates: [],
    });

    expect(plan.items).toContainEqual(
      expect.objectContaining({
        action: 'revision_session',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    );
  });

  it('does not mutate inputs', () => {
    const subjects = [subject({ id: 'subject-1', priority: 5 })];
    const units = [unit({ id: 'unit-1', subjectId: 'subject-1' })];
    const masteryStates = [mastery({ knowledgeUnitId: 'unit-1', score: 0.4 })];
    const before = JSON.stringify({
      subjects,
      units,
      masteryStates,
    });

    new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects,
      knowledgeUnits: units,
      masteryStates,
    });

    expect(JSON.stringify({ subjects, units, masteryStates })).toBe(before);
  });
});

function goal(
  input: Partial<ConstructorParameters<typeof RevisionGoal>[0]> = {},
) {
  return new RevisionGoal({
    id: 'goal-1',
    studentId: 'student-1',
    targetDate: new Date('2026-07-01T00:00:00.000Z'),
    weeklyMinutes: 240,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    ...input,
  });
}

function subject(
  input: Partial<ConstructorParameters<typeof Subject>[0]> = {},
) {
  return new Subject({
    id: 'subject-1',
    studentId: 'student-1',
    name: 'Droit',
    priority: 3,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    ...input,
  });
}

function unit(
  input: Partial<ConstructorParameters<typeof KnowledgeUnit>[0]> = {},
) {
  return new KnowledgeUnit({
    id: 'unit-1',
    subjectId: 'subject-1',
    title: 'Notion',
    summary: 'Résumé',
    ...input,
  });
}

function mastery(
  input: Partial<ConstructorParameters<typeof MasteryState>[0]> = {},
) {
  return new MasteryState({
    studentId: 'student-1',
    knowledgeUnitId: 'unit-1',
    score: 0.5,
    lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
    ...input,
  });
}
