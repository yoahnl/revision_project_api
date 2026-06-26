import type { SubjectsRepository } from '../../subjects/application/subjects.repository';
import { Subject } from '../../subjects/domain/subject.entity';
import {
  AdaptivePlanService,
  type RevisionPlan,
} from '../domain/adaptive-plan.service';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';
import {
  GetTodayPlanUseCase,
  type TodayPlanDto,
} from './get-today-plan.use-case';
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

    expect(plan).toEqual({
      generatedAt: now,
      items: [],
      primaryItemId: null,
      continuationItemIds: [],
      weeklyObjective: null,
      emptyState: {
        title: 'Rien de prêt pour aujourd’hui',
        message:
          'Ajoute un cours ou une source pour que Neralune prépare ta prochaine session.',
        actionLabel: 'Voir mes cours',
        actionKind: 'OPEN_COURSES',
      },
    });
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
      unit({
        id: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        title: 'Séparation',
      }),
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
    expect(plan.primaryItemId).toBe('subject-1:unit-1:diagnostic_quiz');
    expect(plan.continuationItemIds).toEqual([
      plan.items[1].id,
      plan.items[2].id,
    ]);
    expect(plan.weeklyObjective).toEqual({
      targetMinutes: 240,
      completedMinutes: null,
      progressRatio: null,
      label: 'Objectif : 4 h cette semaine',
      status: 'TARGET_ONLY',
    });
    expect(plan.emptyState).toEqual({
      title: 'Rien de prêt pour aujourd’hui',
      message:
        'Ajoute un cours ou une source pour que Neralune prépare ta prochaine session.',
      actionLabel: 'Voir mes cours',
      actionKind: 'OPEN_COURSES',
    });
    expect(plan.items[0]).toEqual(
      expect.objectContaining({
        id: 'subject-1:unit-1:diagnostic_quiz',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        reasonCode: 'LOW_MASTERY',
        reason:
          'Cette notion semble fragile : la revoir maintenant aidera à consolider tes bases.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
        role: 'PRIMARY',
        display: {
          title: 'Séparation',
          subjectLabel: 'Droit constitutionnel',
          badgeLabel: 'DROIT CONSTITUTIONNEL',
          durationLabel: '12 min',
          metaLabel: '12 min · session guidée',
          recommendation:
            'Cette notion semble fragile : la revoir maintenant aidera à consolider tes bases.',
          actionLabel: 'Réviser maintenant',
          unavailableReason: null,
        },
      }),
    );
    expect(plan.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]),
    );
    const richClosedItem = plan.items.find(
      (item) => item.action === 'rich_closed_exercise',
    );
    expect(richClosedItem).toEqual(
      expect.objectContaining({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation',
        estimatedMinutes: 8,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        reason: 'Cette notion mérite une session cadrée avec feedback.',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
        role: 'CONTINUATION',
        display: {
          title: 'Séparation',
          subjectLabel: 'Droit constitutionnel',
          badgeLabel: 'DROIT CONSTITUTIONNEL',
          durationLabel: '8 min',
          metaLabel: '8 min · session guidée',
          actionLabel: 'Continuer',
          recommendation:
            'Cette notion mérite une session cadrée avec feedback.',
          unavailableReason: null,
        },
      }),
    );
    expect(richClosedItem).not.toHaveProperty('questions');
    expect(richClosedItem).not.toHaveProperty('correction');
    expect(richClosedItem).not.toHaveProperty('session');
    expectUserCopyToBeProductSafe(plan);
  });

  it('returns a weekly target and empty state when an active goal has no item', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(
      goal({ weeklyMinutes: 150 }),
    );
    subjectsRepository.findByStudent.mockResolvedValue([]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([]);
    revisionRepository.findMasteryStates.mockResolvedValue([]);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan).toEqual({
      generatedAt: now,
      items: [],
      primaryItemId: null,
      continuationItemIds: [],
      weeklyObjective: {
        targetMinutes: 150,
        completedMinutes: null,
        progressRatio: null,
        label: 'Objectif : 2 h 30 cette semaine',
        status: 'TARGET_ONLY',
      },
      emptyState: {
        title: 'Rien de prêt pour aujourd’hui',
        message:
          'Ajoute un cours ou une source pour que Neralune prépare ta prochaine session.',
        actionLabel: 'Voir mes cours',
        actionKind: 'OPEN_COURSES',
      },
    });
  });

  it('keeps session display cautious when duration or launch payload are incomplete', async () => {
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
            id: 'subject-1:unit-1:open_question',
            subjectId: 'subject-1',
            documentId: null,
            knowledgeUnitId: 'unit-1',
            action: 'open_question',
            estimatedMinutes: 0,
            priority: 100,
            reasonCode: 'MIX_ACTIVITY_TYPE',
            startPayload: {
              subjectId: 'subject-1',
              preferredAction: 'open_question',
            },
          },
        ],
      })),
    };
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([subject()]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([unit()]);
    revisionRepository.findMasteryStates.mockResolvedValue([]);

    const plan = await new GetTodayPlanUseCase(
      adaptivePlanService as unknown as AdaptivePlanService,
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan.items[0].display).toEqual({
      title: 'Notion',
      subjectLabel: 'Droit',
      badgeLabel: 'DROIT',
      durationLabel: null,
      metaLabel: 'Session guidée',
      recommendation: 'Changer d’angle peut t’aider à mieux ancrer la notion.',
      actionLabel: 'Session indisponible',
      unavailableReason: 'Cette action nécessite encore une notion prête.',
    });
    expect(plan.items[0].reason).toBe(
      'Changer d’angle peut t’aider à mieux ancrer la notion.',
    );
    expectUserCopyToBeProductSafe(plan);
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
      role: 'PRIMARY',
    });
    expect(plan.items[0].display.actionLabel).toBe('Réviser maintenant');
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
            documentId: null,
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

function expectUserCopyToBeProductSafe(plan: TodayPlanDto) {
  const forbiddenTerms = [
    'QCM ciblé',
    'Questions riches',
    'Question ouverte',
    'Session de révision IA',
    'diagnostic_quiz',
    'open_question',
    'rich_closed_exercise',
    'QCM simple',
    'QCM complet',
    'Révision rapide',
    'MVP',
    'legacy',
    'backend',
    'GenUI',
    'payload',
    'reasonCode',
    'priority',
  ];
  const userCopy = [
    plan.weeklyObjective?.label,
    plan.emptyState.title,
    plan.emptyState.message,
    plan.emptyState.actionLabel,
    ...plan.items.flatMap((item) => [
      item.reason,
      item.display.title,
      item.display.subjectLabel,
      item.display.badgeLabel,
      item.display.durationLabel,
      item.display.metaLabel,
      item.display.recommendation,
      item.display.actionLabel,
      item.display.unavailableReason,
    ]),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');

  for (const forbiddenTerm of forbiddenTerms) {
    expect(userCopy).not.toContain(forbiddenTerm);
  }
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
