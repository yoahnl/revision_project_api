import {
  toRichClosedPublicExercise,
  toRichClosedPublicQuestion,
} from './rich-closed-question-public.mapper';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
} from './rich-closed-question.fixtures';

describe('rich closed question public mapper', () => {
  it.each([
    'single_choice',
    'multiple_choice',
    'matching',
    'ordering',
    'case_qualification',
    'error_detection',
  ] as const)('maps %s without leaking correction fields', (questionKind) => {
    const publicQuestion = toRichClosedPublicQuestion(
      richClosedQuestionFixture(questionKind),
    );
    const serialized = JSON.stringify(publicQuestion);

    expect(publicQuestion.questionKind).toBe(questionKind);
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('correctChoiceIds');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctErrorId');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
  });

  it('maps a full exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.version).toBe('rich-closed-question-v1');
    expect(publicExercise.questions).toHaveLength(6);
    expect(serialized).not.toContain('correct');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('score');
  });
});
