import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';
import {
  RICH_CLOSED_QUESTION_COUNT_INVALID,
  resolveRichClosedQuestionTypeMix,
} from './rich-closed-question-generation-profile';

describe('rich closed question generation profile', () => {
  it('returns the exact balanced V1-A mix for six questions', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 6 })).toEqual({
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 0,
      date_slider: 0,
    });
  });

  it('keeps V1-B out of the default mix below eight questions', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 7 });

    expect(mix.timeline).toBe(0);
    expect(mix.date_slider).toBe(0);
    expect(sumMix(mix)).toBe(7);
  });

  it('returns the expected exam-style mix for ten questions', () => {
    expect(
      resolveRichClosedQuestionTypeMix({
        questionCount: 10,
        complexityProfile: 'exam',
      }),
    ).toEqual({
      case_qualification: 2,
      error_detection: 2,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
    });
  });

  it('always sums exactly to the requested question count', () => {
    for (const questionCount of [1, 3, 6, 7, 10, 13, 20]) {
      const mix = resolveRichClosedQuestionTypeMix({ questionCount });

      expect(sumMix(mix)).toBe(questionCount);
    }
  });

  it('never returns a type outside the rich closed allowlist', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 12 });
    const allowedKinds = new Set<string>(RICH_CLOSED_QUESTION_KINDS);

    expect(Object.keys(mix).every((kind) => allowedKinds.has(kind))).toBe(true);
  });

  it('does not let single_choice dominate generated exercises', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 12 });

    expect((mix.single_choice ?? 0) / 12).toBeLessThanOrEqual(0.4);
  });

  it('treats small question counts as rich closed exercises without defaulting to single_choice', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 3 });

    expect(sumMix(mix)).toBe(3);
    expect(mix.single_choice ?? 0).toBe(0);
    expect((mix.case_qualification ?? 0) + (mix.error_detection ?? 0)).toBe(2);
  });

  it('rejects unsupported question counts explicitly', () => {
    expect(() =>
      resolveRichClosedQuestionTypeMix({ questionCount: 0 }),
    ).toThrow(RICH_CLOSED_QUESTION_COUNT_INVALID);
    expect(() =>
      resolveRichClosedQuestionTypeMix({ questionCount: 21 }),
    ).toThrow(RICH_CLOSED_QUESTION_COUNT_INVALID);
  });
});

function sumMix(mix: Partial<Record<RichClosedQuestionKind, number>>): number {
  return Object.values(mix).reduce((total, count) => total + count, 0);
}
