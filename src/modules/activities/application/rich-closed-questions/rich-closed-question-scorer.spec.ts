import { RICH_CLOSED_SUBMIT_INVALID_INPUT } from './rich-closed-question-errors';
import { richClosedExerciseFixture } from './rich-closed-question.fixtures';
import { scoreRichClosedExerciseSubmission } from './rich-closed-question-scorer';
import type { RichClosedAnswer } from './rich-closed-question.types';

describe('scoreRichClosedExerciseSubmission', () => {
  it('scores a fully correct rich closed exercise', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers(),
    });

    expect(result).toMatchObject({
      sessionId: 'session-1',
      type: 'rich_closed_exercise',
      status: 'completed',
      correctAnswers: 6,
      totalQuestions: 6,
      score: 1,
    });
    expect(result.items).toHaveLength(6);
    expect(result.items.every((item) => item.isCorrect)).toBe(true);
    expect(result.items[0]?.correction).toEqual({
      correctChoiceId: 'choice-a',
    });
    expect(result.items[1]?.correction).toEqual({
      correctChoiceIds: ['choice-a', 'choice-b'],
    });
  });

  it('scores exact and incorrect answers by question kind', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: [
        {
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'choice-b',
        },
        {
          questionId: 'multiple-1',
          questionKind: 'multiple_choice',
          choiceIds: ['choice-b', 'choice-a'],
        },
        {
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-2', rightId: 'right-2' },
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-3', rightId: 'right-3' },
          ],
        },
        {
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-1', 'item-3', 'item-2'],
        },
        {
          questionId: 'case-1',
          questionKind: 'case_qualification',
          choiceId: 'choice-a',
        },
        {
          questionId: 'error-1',
          questionKind: 'error_detection',
          errorId: 'error-b',
        },
      ],
    });

    expect(result.correctAnswers).toBe(3);
    expect(result.score).toBe(0.5);
    expect(result.items.map((item) => item.isCorrect)).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
  });

  it('accepts multiple choice answer order but requires an exact set', () => {
    const exact = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers().map((answer) =>
        answer.questionId === 'multiple-1'
          ? {
              questionId: 'multiple-1',
              questionKind: 'multiple_choice',
              choiceIds: ['choice-b', 'choice-a'],
            }
          : answer,
      ),
    });
    const wrongSet = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers().map((answer) =>
        answer.questionId === 'multiple-1'
          ? {
              questionId: 'multiple-1',
              questionKind: 'multiple_choice',
              choiceIds: ['choice-a', 'choice-c'],
            }
          : answer,
      ),
    });

    expect(
      exact.items.find((item) => item.questionId === 'multiple-1'),
    ).toMatchObject({
      isCorrect: true,
    });
    expect(
      wrongSet.items.find((item) => item.questionId === 'multiple-1'),
    ).toMatchObject({
      isCorrect: false,
    });
  });

  it('rejects unknown selected ids for choice-based answers', () => {
    expectInvalid(
      replaceAnswer({
        questionId: 'single-1',
        questionKind: 'single_choice',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalid(
      replaceAnswer({
        questionId: 'case-1',
        questionKind: 'case_qualification',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalid(
      replaceAnswer({
        questionId: 'error-1',
        questionKind: 'error_detection',
        errorId: 'unknown-error',
      }),
    );
  });

  it('rejects multiple choice submissions outside min and max selections', () => {
    expectInvalid(
      replaceAnswer({
        questionId: 'multiple-1',
        questionKind: 'multiple_choice',
        choiceIds: ['choice-a'],
      }),
    );
    expectInvalid(
      replaceAnswer({
        questionId: 'multiple-1',
        questionKind: 'multiple_choice',
        choiceIds: ['choice-a', 'choice-b', 'choice-c'],
      }),
    );
  });

  it('accepts matching pair order but requires exact logical pairs', () => {
    const wrongPair = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers().map((answer) =>
        answer.questionId === 'matching-1'
          ? {
              questionId: 'matching-1',
              questionKind: 'matching',
              pairs: [
                { leftId: 'left-1', rightId: 'right-2' },
                { leftId: 'left-2', rightId: 'right-1' },
                { leftId: 'left-3', rightId: 'right-3' },
              ],
            }
          : answer,
      ),
    });

    expect(
      wrongPair.items.find((item) => item.questionId === 'matching-1'),
    ).toMatchObject({
      isCorrect: false,
    });
  });

  it('rejects incomplete ordering answers', () => {
    expect(() =>
      scoreRichClosedExerciseSubmission({
        sessionId: 'session-1',
        exercise: richClosedExerciseFixture(),
        answers: correctAnswers().map((answer) =>
          answer.questionId === 'ordering-1'
            ? {
                questionId: 'ordering-1',
                questionKind: 'ordering',
                orderedIds: ['item-1', 'item-2'],
              }
            : answer,
        ),
      }),
    ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  });

  it('rejects unknown, duplicate, missing and kind-mismatched answers', () => {
    expectInvalid([
      ...correctAnswers(),
      {
        questionId: 'unknown-question',
        questionKind: 'single_choice',
        choiceId: 'choice-a',
      },
    ]);
    expectInvalid([
      ...correctAnswers(),
      {
        questionId: 'single-1',
        questionKind: 'single_choice',
        choiceId: 'choice-a',
      },
    ]);
    expectInvalid(
      correctAnswers().filter((answer) => answer.questionId !== 'single-1'),
    );
    expectInvalid(
      correctAnswers().map((answer) =>
        answer.questionId === 'single-1'
          ? {
              questionId: 'single-1',
              questionKind: 'multiple_choice',
              choiceIds: ['choice-a', 'choice-b'],
            }
          : answer,
      ),
    );
  });

  it('rejects answers carrying free text or correction fields', () => {
    expectInvalid([
      ...correctAnswers().filter((answer) => answer.questionId !== 'single-1'),
      {
        questionId: 'single-1',
        questionKind: 'single_choice',
        choiceId: 'choice-a',
        answerText: 'réponse libre interdite',
      },
    ]);
    expectInvalid([
      ...correctAnswers().filter(
        (answer) => answer.questionId !== 'multiple-1',
      ),
      {
        questionId: 'multiple-1',
        questionKind: 'multiple_choice',
        choiceIds: ['choice-a', 'choice-b'],
        correctChoiceIds: ['choice-a', 'choice-b'],
      },
    ]);
  });

  it('produces global scores at 0 and 1', () => {
    const zero = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: [
        {
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'choice-b',
        },
        {
          questionId: 'multiple-1',
          questionKind: 'multiple_choice',
          choiceIds: ['choice-a', 'choice-c'],
        },
        {
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-1', rightId: 'right-2' },
            { leftId: 'left-2', rightId: 'right-3' },
            { leftId: 'left-3', rightId: 'right-1' },
          ],
        },
        {
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-3', 'item-2', 'item-1'],
        },
        {
          questionId: 'case-1',
          questionKind: 'case_qualification',
          choiceId: 'choice-b',
        },
        {
          questionId: 'error-1',
          questionKind: 'error_detection',
          errorId: 'error-b',
        },
      ],
    });

    expect(zero.score).toBe(0);
    expect(
      scoreRichClosedExerciseSubmission({
        sessionId: 'session-1',
        exercise: richClosedExerciseFixture(),
        answers: correctAnswers(),
      }).score,
    ).toBe(1);
  });
});

function expectInvalid(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function replaceAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return correctAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function correctAnswers(): RichClosedAnswer[] {
  return [
    {
      questionId: 'single-1',
      questionKind: 'single_choice',
      choiceId: 'choice-a',
    },
    {
      questionId: 'multiple-1',
      questionKind: 'multiple_choice',
      choiceIds: ['choice-a', 'choice-b'],
    },
    {
      questionId: 'matching-1',
      questionKind: 'matching',
      pairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    },
    {
      questionId: 'ordering-1',
      questionKind: 'ordering',
      orderedIds: ['item-1', 'item-2', 'item-3'],
    },
    {
      questionId: 'case-1',
      questionKind: 'case_qualification',
      choiceId: 'choice-a',
    },
    {
      questionId: 'error-1',
      questionKind: 'error_detection',
      errorId: 'error-a',
    },
  ];
}
