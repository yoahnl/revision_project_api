import { GetTodayPlanUseCase } from '../application/get-today-plan.use-case';
import { TodayController } from './today.controller';

describe('TodayController', () => {
  it('loads today plan for the current student', async () => {
    const execute = jest.fn().mockResolvedValue({
      generatedAt: new Date('2026-06-15T10:00:00.000Z'),
      items: [
        {
          id: 'subject-1:unit-1:diagnostic_quiz',
          subjectId: 'subject-1',
          subjectName: 'Droit',
          knowledgeUnitId: 'unit-1',
          knowledgeUnitTitle: 'Séparation',
          masteryScore: 0.2,
          action: 'diagnostic_quiz',
          estimatedMinutes: 12,
          priority: 560,
          reasonCode: 'LOW_MASTERY',
          reason: 'À revoir en priorité : cette notion est encore fragile.',
          startPayload: {
            subjectId: 'subject-1',
            knowledgeUnitId: 'unit-1',
            preferredAction: 'diagnostic_quiz',
          },
        },
      ],
    });
    const controller = new TodayController({
      execute,
    } as unknown as GetTodayPlanUseCase);

    await expect(controller.get({ id: 'student-1' })).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ action: 'diagnostic_quiz' })],
      }),
    );
    expect(execute).toHaveBeenCalledWith({ studentId: 'student-1' });
  });
});
