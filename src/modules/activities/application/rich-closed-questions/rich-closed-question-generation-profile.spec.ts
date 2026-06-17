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
      true_false_grid: 0,
      cause_consequence: 0,
      institution_matrix: 0,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('keeps V1-B out of the default mix below eight questions', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 7 });

    expect(mix.timeline).toBe(0);
    expect(mix.date_slider).toBe(0);
    expect(mix.true_false_grid).toBe(0);
    expect(mix.cause_consequence).toBe(0);
    expect(mix.institution_matrix).toBe(0);
    expect(mix.diagram_labeling).toBe(0);
    expect(mix.calculation_mcq).toBe(0);
    expect(mix.image_choice).toBe(0);
    expect(sumMix(mix)).toBe(7);
  });

  it('preserves the V1-017 default mix for eight questions', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 8 })).toEqual({
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 0,
      cause_consequence: 0,
      institution_matrix: 0,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('keeps V1-018 types out of the default nine-question mix', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 9 });

    expect(mix.timeline).toBeGreaterThan(0);
    expect(mix.date_slider).toBeGreaterThan(0);
    expect(mix.true_false_grid).toBe(0);
    expect(mix.cause_consequence).toBe(0);
    expect(mix.institution_matrix).toBe(0);
    expect(mix.diagram_labeling).toBe(0);
    expect(mix.calculation_mcq).toBe(0);
    expect(mix.image_choice).toBe(0);
    expect(sumMix(mix)).toBe(9);
  });

  it('preserves the expected V1-B full mix for ten questions', () => {
    expect(
      resolveRichClosedQuestionTypeMix({
        questionCount: 10,
        complexityProfile: 'exam',
      }),
    ).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 0,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('preserves the V1-019 default mix for eleven questions', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 11 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('adds diagram_labeling only from the twelve-question default mix', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 12 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('adds calculation_mcq only from the thirteen-question default mix', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 13 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
      image_choice: 0,
    });
  });

  it('adds image_choice only from the fourteen-question default mix', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 14 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
      image_choice: 1,
    });
  });

  it('always sums exactly to the requested question count', () => {
    for (const questionCount of [1, 3, 6, 7, 10, 13, 14, 20]) {
      const mix = resolveRichClosedQuestionTypeMix({ questionCount });

      expect(sumMix(mix)).toBe(questionCount);
    }
  });

  it('never returns a type outside the rich closed allowlist', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 14 });
    const allowedKinds = new Set<string>(RICH_CLOSED_QUESTION_KINDS);

    expect(Object.keys(mix).every((kind) => allowedKinds.has(kind))).toBe(true);
  });

  it('does not let single_choice dominate generated exercises', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 14 });

    expect((mix.single_choice ?? 0) / 14).toBeLessThanOrEqual(0.4);
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
