import { RevisionGoal } from './revision-goal.entity';

describe('RevisionGoal', () => {
  it('stores valid revision goal details', () => {
    const targetDate = new Date('2026-06-30T00:00:00.000Z');
    const createdAt = new Date('2026-06-12T10:00:00.000Z');

    const goal = new RevisionGoal({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate,
      weeklyMinutes: 240,
      createdAt,
    });

    expect(goal).toMatchObject({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate,
      weeklyMinutes: 240,
      createdAt,
    });
  });

  it('rejects invalid weekly revision minutes', () => {
    const input = {
      id: 'goal-1',
      studentId: 'student-1',
      targetDate: new Date('2026-06-30T00:00:00.000Z'),
      weeklyMinutes: 240,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    };
    const invalidWeeklyMinutes = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      30.5,
      29,
    ];

    for (const weeklyMinutes of invalidWeeklyMinutes) {
      expect(() => new RevisionGoal({ ...input, weeklyMinutes })).toThrow(
        'Weekly revision time must be at least 30 minutes',
      );
    }
  });

  it('rejects invalid target dates', () => {
    expect(
      () =>
        new RevisionGoal({
          id: 'goal-1',
          studentId: 'student-1',
          targetDate: new Date('not-a-date'),
          weeklyMinutes: 240,
          createdAt: new Date('2026-06-12T10:00:00.000Z'),
        }),
    ).toThrow('Revision goal target date must be valid');
  });
});
