import {
  validateRichClosedExercise,
  validateRichClosedQuestion,
} from './rich-closed-question.validator';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
} from './rich-closed-question.fixtures';
import type { RichClosedQuestion } from './rich-closed-question.types';

describe('rich closed question validator', () => {
  it.each([
    'single_choice',
    'multiple_choice',
    'matching',
    'ordering',
    'case_qualification',
    'error_detection',
  ] as const)('accepts a valid V1-A %s question', (questionKind) => {
    const result = validateRichClosedQuestion(
      richClosedQuestionFixture(questionKind),
      { knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'] },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects a kind outside V1-A', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      questionKind: 'timeline',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_KIND_UNSUPPORTED' }),
    );
  });

  it('rejects free answer shaped payloads', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      answerText: 'Réponse libre interdite',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_FREE_ANSWER_FORBIDDEN' }),
    );
  });

  it('rejects cognitive skills outside the V1-A allowlist', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      cognitiveSkill: 'creative_writing',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
      }),
    );
  });

  it('accepts a cognitive skill from the V1-A allowlist', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      cognitiveSkill: 'comparison',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(true);
  });

  it('requires single_choice to have exactly one valid correct choice', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      correctChoiceId: 'missing-choice',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_CORRECTION_INVALID' }),
    );
  });

  it('requires multiple_choice to have at least two valid correct answers', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      correctChoiceIds: ['choice-a'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_MULTIPLE_TOO_FEW_CORRECT' }),
    );
  });

  it('rejects decimal multiple_choice selection bounds', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      minSelections: 1.5,
      maxSelections: 2.5,
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_SELECTION_BOUNDS_INVALID',
      }),
    );
  });

  it('rejects multiple_choice bounds that exclude the correct answer count', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      minSelections: 1,
      maxSelections: 1,
      correctChoiceIds: ['choice-a', 'choice-b'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_SELECTION_BOUNDS_INVALID',
      }),
    );
  });

  it('accepts multiple_choice bounds that include the correct answer count', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      minSelections: 1,
      maxSelections: 3,
      correctChoiceIds: ['choice-a', 'choice-b'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(true);
  });

  it('rejects matching questions with fewer than three pairs', () => {
    const question = {
      ...richClosedQuestionFixture('matching'),
      leftItems: [
        { id: 'left-1', label: 'Motion de censure' },
        { id: 'left-2', label: 'Dissolution' },
      ],
      rightItems: [
        { id: 'right-1', label: 'Responsabilité politique' },
        { id: 'right-2', label: 'Fin anticipée' },
      ],
      correctPairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
      ],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_MATCHING_TOO_SMALL' }),
    );
  });

  it('rejects matching questions with duplicate pair sides', () => {
    const question = {
      ...richClosedQuestionFixture('matching'),
      correctPairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-1', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_MATCHING_DUPLICATE_PAIR' }),
    );
  });

  it('requires ordering questions to have at least three items and a complete order', () => {
    const question = {
      ...richClosedQuestionFixture('ordering'),
      correctOrder: ['item-1', 'item-2'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_ORDERING_INCOMPLETE' }),
    );
  });

  it('requires case_qualification to have a short case and a unique correction', () => {
    const question = {
      ...richClosedQuestionFixture('case_qualification'),
      caseText: 'x'.repeat(901),
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_CASE_TEXT_INVALID' }),
    );
  });

  it('requires error_detection to have one dominant valid error', () => {
    const question = {
      ...richClosedQuestionFixture('error_detection'),
      correctErrorId: 'missing-error',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_CORRECTION_INVALID' }),
    );
  });

  it('rejects unknown source chunks when a known source set is provided', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      sourceChunkIds: ['chunk-unknown'],
    };

    const result = validateRichClosedQuestion(question, {
      knownSourceChunkIds: ['chunk-1'],
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_SOURCE_UNKNOWN' }),
    );
  });

  it('validates a complete V1-A exercise', () => {
    const result = validateRichClosedExercise(richClosedExerciseFixture(), {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
