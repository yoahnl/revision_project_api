import type { SubjectsRepository } from '../../subjects/application/subjects.repository';
import { Subject } from '../../subjects/domain/subject.entity';
import {
  AdaptivePlanService,
  type RevisionPlan,
} from '../domain/adaptive-plan.service';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';
import { GetTodayPlanUseCase } from './get-today-plan.use-case';
import type { RevisionRepository } from './revision.repository';

describe('GetTodayPlanUseCase', () => {
  const now = new Date('2026-06-15T10:00:00.000Z');

  it('returns an empty plan when no active goal exists', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(null);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan).toEqual({ generatedAt: now, items: [] });
    expect(subjectsRepository.findByStudent.mock.calls).toHaveLength(0);
    expect(revisionRepository.findKnowledgeUnits.mock.calls).toHaveLength(0);
    expect(revisionRepository.findMasteryStates.mock.calls).toHaveLength(0);
  });

  it('returns enriched multi-action DTO items', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([
      subject({ id: 'subject-1', name: 'Droit constitutionnel', priority: 5 }),
    ]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      unit({ id: 'unit-1', subjectId: 'subject-1', title: 'Séparation' }),
      unit({ id: 'unit-2', subjectId: 'subject-1', title: 'Régimes' }),
    ]);
    revisionRepository.findMasteryStates.mockResolvedValue([
      mastery({ knowledgeUnitId: 'unit-1', score: 0.2 }),
      mastery({ knowledgeUnitId: 'unit-2', score: 0.6 }),
    ]);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan.items).toHaveLength(4);
    expect(plan.items[0]).toEqual(
      expect.objectContaining({
        id: 'subject-1:unit-1:diagnostic_quiz',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        reasonCode: 'LOW_MASTERY',
        reason: 'À revoir en priorité : cette notion est encore fragile.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
      }),
    );
    expect(plan.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'diagnostic_quiz',
        'open_question',
        'revision_session',
      ]),
    );
  });

  it('uses null mastery score when no mastery state exists', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([subject()]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([unit()]);
    revisionRepository.findMasteryStates.mockResolvedValue([]);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan.items[0]).toMatchObject({
      masteryScore: null,
      action: 'diagnostic_quiz',
    });
  });

  it('throws a controlled error when the domain plan references missing data', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    const adaptivePlanService = {
      buildTodayPlan: jest.fn<
        RevisionPlan,
        Parameters<AdaptivePlanService['buildTodayPlan']>
      >(() => ({
        generatedAt: now,
        items: [
          {
            id: 'subject-missing:unit-1:diagnostic_quiz',
            subjectId: 'subject-missing',
            knowledgeUnitId: 'unit-1',
            action: 'diagnostic_quiz',
            estimatedMinutes: 12,
            priority: 100,
            reasonCode: 'LOW_MASTERY',
            startPayload: {
              subjectId: 'subject-missing',
              knowledgeUnitId: 'unit-1',
              preferredAction: 'diagnostic_quiz',
            },
          },
        ],
      })),
    };
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([subject()]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([unit()]);
    revisionRepository.findMasteryStates.mockResolvedValue([]);

    await expect(
      new GetTodayPlanUseCase(
        adaptivePlanService as unknown as AdaptivePlanService,
        revisionRepository,
        subjectsRepository,
      ).execute({ studentId: 'student-1', now }),
    ).rejects.toThrow('Today plan references missing data');
  });
});

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}

function createSubjectsRepository(): jest.Mocked<SubjectsRepository> {
  return {
    create: jest.fn(),
    findByStudent: jest.fn(),
    findByIdForStudent: jest.fn(),
    deleteForStudent: jest.fn(),
  };
}

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
