import { BadRequestException } from '@nestjs/common';
import { SaveRevisionGoalUseCase } from '../application/save-revision-goal.use-case';
import { RevisionGoalsController } from './revision-goals.controller';

describe('RevisionGoalsController', () => {
  const student = { id: 'student-1' };

  function createController() {
    const execute = jest.fn().mockResolvedValue({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const saveRevisionGoal = {
      execute,
    } as unknown as SaveRevisionGoalUseCase;

    return {
      controller: new RevisionGoalsController(saveRevisionGoal),
      execute,
    };
  }

  it('saves revision goals for the current student and ignores body studentId', async () => {
    const { controller, execute } = createController();

    await controller.save(student, {
      studentId: 'attacker-student',
      targetDate: '2026-06-30',
      weeklyMinutes: 240,
    } as never);

    expect(execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      targetDate: new Date('2026-06-30'),
      weeklyMinutes: 240,
    });
  });

  it('rejects invalid target dates with 400', () => {
    const { controller } = createController();

    expect(() =>
      controller.save(student, {
        targetDate: 'not-a-date',
        weeklyMinutes: 240,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid weekly revision minutes with 400', () => {
    const invalidBodies = [
      { targetDate: '2026-06-30', weeklyMinutes: 29 },
      { targetDate: '2026-06-30', weeklyMinutes: 30.5 },
      { targetDate: '2026-06-30', weeklyMinutes: Number.NaN },
      { targetDate: '2026-06-30', weeklyMinutes: '240' },
    ];

    for (const body of invalidBodies) {
      const { controller } = createController();

      expect(() => controller.save(student, body as never)).toThrow(
        BadRequestException,
      );
    }
  });
});
