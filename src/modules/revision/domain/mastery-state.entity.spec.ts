import { MasteryState } from './mastery-state.entity';

describe('MasteryState', () => {
  it('returns a new state with a weighted quiz score and practiced timestamp', () => {
    const lastPracticedAt = new Date('2026-06-01T10:00:00.000Z');
    const practicedAt = new Date('2026-06-12T10:00:00.000Z');
    const mastery = new MasteryState({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.4,
      lastPracticedAt,
    });

    const next = mastery.applyQuizResult(8, 10, practicedAt);

    expect(next).not.toBe(mastery);
    expect(next).toMatchObject({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.54,
      lastPracticedAt: practicedAt,
    });
    expect(mastery.score).toBe(0.4);
    expect(mastery.lastPracticedAt).toBe(lastPracticedAt);
  });

  it('rounds weighted quiz scores to three decimals', () => {
    const mastery = new MasteryState({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.333,
      lastPracticedAt: null,
    });

    const next = mastery.applyQuizResult(
      2,
      3,
      new Date('2026-06-12T10:00:00.000Z'),
    );

    expect(next.score).toBe(0.45);
  });

  it('returns a new state with a weighted open answer ratio', () => {
    const practicedAt = new Date('2026-06-14T10:00:00.000Z');
    const mastery = new MasteryState({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.4,
      lastPracticedAt: null,
    });

    const next = mastery.applyOpenAnswerRatio(0.8, practicedAt);

    expect(next).not.toBe(mastery);
    expect(next).toMatchObject({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.54,
      lastPracticedAt: practicedAt,
    });
  });

  it('rejects non-finite mastery scores', () => {
    const invalidScores = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];

    for (const score of invalidScores) {
      expect(
        () =>
          new MasteryState({
            studentId: 'student-1',
            knowledgeUnitId: 'unit-1',
            score,
            lastPracticedAt: null,
          }),
      ).toThrow('Mastery score must be between 0 and 1');
    }
  });

  it('rejects impossible quiz results', () => {
    const mastery = new MasteryState({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.5,
      lastPracticedAt: null,
    });
    const practicedAt = new Date('2026-06-12T10:00:00.000Z');
    const invalidTotalQuestions = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ];
    const invalidCorrectAnswers = [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      11,
    ];

    for (const totalQuestions of invalidTotalQuestions) {
      expect(() =>
        mastery.applyQuizResult(0, totalQuestions, practicedAt),
      ).toThrow('Quiz result must include at least one question');
    }

    for (const correctAnswers of invalidCorrectAnswers) {
      expect(() =>
        mastery.applyQuizResult(correctAnswers, 10, practicedAt),
      ).toThrow('Correct answers must be between 0 and total questions');
    }
  });
});
