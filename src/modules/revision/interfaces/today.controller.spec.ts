import { GetTodayPlanUseCase } from '../application/get-today-plan.use-case';
import { TodayController } from './today.controller';

describe('TodayController', () => {
  it('loads today plan for the current student', async () => {
    const execute = jest.fn().mockResolvedValue({
      generatedAt: new Date('2026-06-15T10:00:00.000Z'),
      primaryItemId: 'subject-1:unit-1:diagnostic_quiz',
      continuationItemIds: [],
      weeklyObjective: {
        targetMinutes: 240,
        completedMinutes: null,
        progressRatio: null,
        label: 'Objectif : 4 h cette semaine',
        status: 'TARGET_ONLY',
      },
      emptyState: {
        title: 'Rien de prêt pour aujourd’hui',
        message:
          'Ajoute un cours ou une source pour que Neralune prépare ta prochaine session.',
        actionLabel: 'Voir mes cours',
        actionKind: 'OPEN_COURSES',
      },
      items: [
        {
          id: 'subject-1:unit-1:diagnostic_quiz',
          subjectId: 'subject-1',
          subjectName: 'Droit',
          documentId: null,
          knowledgeUnitId: 'unit-1',
          knowledgeUnitTitle: 'Séparation',
          masteryScore: 0.2,
          action: 'diagnostic_quiz',
          estimatedMinutes: 12,
          priority: 560,
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
            subjectLabel: 'Droit',
            badgeLabel: 'DROIT',
            durationLabel: '12 min',
            metaLabel: '12 min · session guidée',
            recommendation:
              'Cette notion semble fragile : la revoir maintenant aidera à consolider tes bases.',
            actionLabel: 'Réviser maintenant',
            unavailableReason: null,
          },
        },
      ],
    });
    const controller = new TodayController({
      execute,
    } as unknown as GetTodayPlanUseCase);

    const result = await controller.get({ id: 'student-1' });

    expect(result.primaryItemId).toBe('subject-1:unit-1:diagnostic_quiz');
    expect(result.items[0]).toMatchObject({
      action: 'diagnostic_quiz',
      role: 'PRIMARY',
    });
    expect(result.items[0].display.actionLabel).toBe('Réviser maintenant');
    expect(execute).toHaveBeenCalledWith({ studentId: 'student-1' });
  });
});
