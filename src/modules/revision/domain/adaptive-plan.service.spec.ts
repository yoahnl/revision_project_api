import { AdaptivePlanService } from './adaptive-plan.service';
import { KnowledgeUnit } from './knowledge-unit.entity';
import { MasteryState } from './mastery-state.entity';
import { RevisionGoal } from './revision-goal.entity';
import { Subject } from '../../subjects/domain/subject.entity';

describe('AdaptivePlanService', () => {
  it('prioritizes weak knowledge units in a high-priority subject', () => {
    const subject = new Subject({
      id: 'subject-anatomy',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 5,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const goal = new RevisionGoal({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const units = [
      new KnowledgeUnit({
        id: 'unit-strong',
        subjectId: subject.id,
        title: 'Os du carpe',
        summary: 'Unit already mastered',
      }),
      new KnowledgeUnit({
        id: 'unit-weak',
        subjectId: subject.id,
        title: 'Innervation du membre superieur',
        summary: 'Unit with low mastery',
      }),
    ];
    const mastery = [
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-strong',
        score: 0.86,
        lastPracticedAt: new Date('2026-06-11T10:00:00.000Z'),
      }),
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-weak',
        score: 0.22,
        lastPracticedAt: new Date('2026-06-03T10:00:00.000Z'),
      }),
    ];

    const plan = new AdaptivePlanService().buildTodayPlan({
      now: new Date('2026-06-12T10:00:00.000Z'),
      goal,
      subjects: [subject],
      knowledgeUnits: units,
      masteryStates: mastery,
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-anatomy',
      knowledgeUnitId: 'unit-weak',
      activityType: 'diagnostic_quiz',
      estimatedMinutes: 15,
    });
    expect(plan.items[0].reason).toContain('low mastery');
  });

  it("does not let another student's mastery influence the plan", () => {
    const subject = new Subject({
      id: 'subject-anatomy',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 5,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const goal = new RevisionGoal({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const units = [
      new KnowledgeUnit({
        id: 'unit-with-other-mastery',
        subjectId: subject.id,
        title: 'Plexus brachial',
        summary: 'No mastery exists yet for the target student',
      }),
      new KnowledgeUnit({
        id: 'unit-target-known',
        subjectId: subject.id,
        title: 'Nerf radial',
        summary: 'Weak but known for the target student',
      }),
    ];
    const mastery = [
      new MasteryState({
        studentId: 'student-2',
        knowledgeUnitId: 'unit-with-other-mastery',
        score: 0.95,
        lastPracticedAt: new Date('2026-06-12T09:00:00.000Z'),
      }),
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-target-known',
        score: 0.2,
        lastPracticedAt: new Date('2026-06-11T10:00:00.000Z'),
      }),
    ];

    const plan = new AdaptivePlanService().buildTodayPlan({
      now: new Date('2026-06-12T10:00:00.000Z'),
      goal,
      subjects: [subject],
      knowledgeUnits: units,
      masteryStates: mastery,
    });

    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-anatomy',
      knowledgeUnitId: 'unit-with-other-mastery',
    });
  });

  it("does not rank knowledge units from another student's subject", () => {
    const ownSubject = new Subject({
      id: 'subject-own',
      studentId: 'student-1',
      name: 'Physiologie',
      priority: 1,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const otherSubject = new Subject({
      id: 'subject-other',
      studentId: 'student-2',
      name: 'Biophysique',
      priority: 5,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const goal = new RevisionGoal({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const units = [
      new KnowledgeUnit({
        id: 'unit-own',
        subjectId: ownSubject.id,
        title: 'Potentiel action',
        summary: 'Owned by the goal student',
      }),
      new KnowledgeUnit({
        id: 'unit-other',
        subjectId: otherSubject.id,
        title: 'Rayons X',
        summary: 'Belongs to another student',
      }),
    ];
    const mastery = [
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-own',
        score: 0.6,
        lastPracticedAt: new Date('2026-06-11T10:00:00.000Z'),
      }),
      new MasteryState({
        studentId: 'student-2',
        knowledgeUnitId: 'unit-other',
        score: 0.1,
        lastPracticedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
    ];

    const plan = new AdaptivePlanService().buildTodayPlan({
      now: new Date('2026-06-12T10:00:00.000Z'),
      goal,
      subjects: [ownSubject, otherSubject],
      knowledgeUnits: units,
      masteryStates: mastery,
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-own',
      knowledgeUnitId: 'unit-own',
    });
  });

  it('prioritizes higher-priority subjects when mastery and recency are equal', () => {
    const highPrioritySubject = new Subject({
      id: 'subject-high',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 5,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const lowPrioritySubject = new Subject({
      id: 'subject-low',
      studentId: 'student-1',
      name: 'Histologie',
      priority: 2,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const goal = new RevisionGoal({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const plan = new AdaptivePlanService().buildTodayPlan({
      now: new Date('2026-06-12T10:00:00.000Z'),
      goal,
      subjects: [lowPrioritySubject, highPrioritySubject],
      knowledgeUnits: [
        new KnowledgeUnit({
          id: 'unit-low',
          subjectId: lowPrioritySubject.id,
          title: 'Epitheliums',
          summary: 'Same score and recency',
        }),
        new KnowledgeUnit({
          id: 'unit-high',
          subjectId: highPrioritySubject.id,
          title: 'Membre inferieur',
          summary: 'Same score and recency',
        }),
      ],
      masteryStates: [
        new MasteryState({
          studentId: 'student-1',
          knowledgeUnitId: 'unit-low',
          score: 0.5,
          lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
        }),
        new MasteryState({
          studentId: 'student-1',
          knowledgeUnitId: 'unit-high',
          score: 0.5,
          lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
        }),
      ],
    });

    expect(plan.items[0].knowledgeUnitId).toBe('unit-high');
  });

  it('prioritizes stale knowledge units when subject priority and mastery are equal', () => {
    const subject = new Subject({
      id: 'subject-anatomy',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 3,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });
    const goal = new RevisionGoal({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const plan = new AdaptivePlanService().buildTodayPlan({
      now: new Date('2026-06-12T10:00:00.000Z'),
      goal,
      subjects: [subject],
      knowledgeUnits: [
        new KnowledgeUnit({
          id: 'unit-fresh',
          subjectId: subject.id,
          title: 'Articulation coude',
          summary: 'Practiced recently',
        }),
        new KnowledgeUnit({
          id: 'unit-stale',
          subjectId: subject.id,
          title: 'Articulation epaule',
          summary: 'Needs review after a long gap',
        }),
      ],
      masteryStates: [
        new MasteryState({
          studentId: 'student-1',
          knowledgeUnitId: 'unit-fresh',
          score: 0.5,
          lastPracticedAt: new Date('2026-06-11T10:00:00.000Z'),
        }),
        new MasteryState({
          studentId: 'student-1',
          knowledgeUnitId: 'unit-stale',
          score: 0.5,
          lastPracticedAt: new Date('2026-05-01T10:00:00.000Z'),
        }),
      ],
    });

    expect(plan.items[0].knowledgeUnitId).toBe('unit-stale');
  });
});
