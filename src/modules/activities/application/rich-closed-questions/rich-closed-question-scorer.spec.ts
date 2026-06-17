import { RICH_CLOSED_SUBMIT_INVALID_INPUT } from './rich-closed-question-errors';
import {
  richClosedExerciseFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
} from './rich-closed-question.fixtures';
import { scoreRichClosedExerciseSubmission } from './rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedExercise,
} from './rich-closed-question.types';

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

  it('scores timeline and date slider V1-B answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BExerciseFixture(),
      answers: correctAnswersV1B(),
    });

    expect(result).toMatchObject({
      correctAnswers: 8,
      totalQuestions: 8,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'timeline-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: { correctOrder: ['event-1', 'event-2', 'event-3'] },
    });
    expect(
      result.items.find((item) => item.questionId === 'date-slider-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctYear: 1958,
        minAcceptedYear: 1958,
        maxAcceptedYear: 1958,
      },
    });
  });

  it('marks a wrong timeline order as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BExerciseFixture(),
      answers: correctAnswersV1B().map((answer) =>
        answer.questionId === 'timeline-1'
          ? {
              questionId: 'timeline-1',
              questionKind: 'timeline',
              orderedEventIds: ['event-1', 'event-3', 'event-2'],
            }
          : answer,
      ),
    });

    expect(
      result.items.find((item) => item.questionId === 'timeline-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown and incomplete timeline answers', () => {
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'timeline-1',
        questionKind: 'timeline',
        orderedEventIds: ['event-1', 'event-1', 'event-3'],
      }),
    );
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'timeline-1',
        questionKind: 'timeline',
        orderedEventIds: ['event-1', 'event-2', 'unknown-event'],
      }),
    );
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'timeline-1',
        questionKind: 'timeline',
        orderedEventIds: ['event-1', 'event-2'],
      }),
    );
  });

  it('scores date slider answers with tolerance and rejects invalid years', () => {
    const exercise = {
      ...richClosedV1BExerciseFixture(),
      questions: richClosedV1BExerciseFixture().questions.map((question) =>
        question.questionKind === 'date_slider'
          ? { ...question, toleranceYears: 2 }
          : question,
      ),
    };
    const withinTolerance = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise,
      answers: correctAnswersV1B().map((answer) =>
        answer.questionId === 'date-slider-1'
          ? {
              questionId: 'date-slider-1',
              questionKind: 'date_slider',
              year: 1960,
            }
          : answer,
      ),
    });
    const outsideTolerance = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise,
      answers: correctAnswersV1B().map((answer) =>
        answer.questionId === 'date-slider-1'
          ? {
              questionId: 'date-slider-1',
              questionKind: 'date_slider',
              year: 1961,
            }
          : answer,
      ),
    });

    expect(
      withinTolerance.items.find((item) => item.questionId === 'date-slider-1'),
    ).toMatchObject({ isCorrect: true });
    expect(
      outsideTolerance.items.find(
        (item) => item.questionId === 'date-slider-1',
      ),
    ).toMatchObject({ isCorrect: false });
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'date-slider-1',
        questionKind: 'date_slider',
        year: 1971,
      }),
    );
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'date-slider-1',
        questionKind: 'date_slider',
        year: 1958.5,
      } as unknown as RichClosedAnswer),
    );
  });

  it('scores true_false_grid and cause_consequence V1-B answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers: correctAnswersV1BFull(),
    });

    expect(result).toMatchObject({
      correctAnswers: 10,
      totalQuestions: 10,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'true-false-grid-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctValues: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'row-3', value: true },
        ],
      },
    });
    expect(
      result.items.find((item) => item.questionId === 'cause-consequence-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctPairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-2' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      },
    });
  });

  it('marks one wrong true_false_grid value as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers: replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: true },
          { rowId: 'row-3', value: true },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'true-false-grid-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown, incomplete and non-boolean true_false_grid answers', () => {
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-1', value: false },
          { rowId: 'row-3', value: true },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'unknown-row', value: true },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'row-3', value: 'true' },
        ],
      }),
    );
  });

  it('marks a wrong cause_consequence pair as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers: replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-2' },
          { causeId: 'cause-2', consequenceId: 'consequence-1' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'cause-consequence-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown and incomplete cause_consequence answers', () => {
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-1', consequenceId: 'consequence-2' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'unknown-consequence' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-2' },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-1' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    );
  });

  it('scores institution_matrix V1-C answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CExerciseFixture(),
      answers: correctAnswersV1C(),
    });

    expect(result).toMatchObject({
      correctAnswers: 11,
      totalQuestions: 11,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'institution-matrix-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctValues: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      },
    });
  });

  it('marks one wrong institution_matrix value as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CExerciseFixture(),
      answers: replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-confidence',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'institution-matrix-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown, incomplete and invalid institution_matrix answers', () => {
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-confidence',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    );
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          { cellId: 'unknown-cell', optionId: 'option-legitimacy-election' },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    );
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-action-censure',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    );
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
        ],
      }),
    );
  });

  it('scores diagram_labeling V1-C answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CFullExerciseFixture(),
      answers: correctAnswersV1CFull(),
    });

    expect(result).toMatchObject({
      correctAnswers: 12,
      totalQuestions: 12,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'diagram-labeling-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctValues: [
          {
            slotId: 'slot-government-role',
            optionId: 'option-government',
          },
          {
            slotId: 'slot-censure',
            optionId: 'option-motion-censure',
          },
          {
            slotId: 'slot-nomination',
            optionId: 'option-nomination',
          },
        ],
      },
    });
  });

  it('marks one wrong diagram_labeling value as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CFullExerciseFixture(),
      answers: replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          {
            slotId: 'slot-government-role',
            optionId: 'option-president',
          },
          {
            slotId: 'slot-censure',
            optionId: 'option-motion-censure',
          },
          {
            slotId: 'slot-nomination',
            optionId: 'option-nomination',
          },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'diagram-labeling-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('keeps diagram_labeling value comparison structured when ids contain separators', () => {
    const exercise = {
      ...richClosedV1CFullExerciseFixture(),
      questions: richClosedV1CFullExerciseFixture().questions.map((question) =>
        question.questionKind === 'diagram_labeling'
          ? {
              ...question,
              slots: [
                {
                  id: 'slot:a',
                  anchorType: 'node',
                  anchorId: 'node-government',
                  prompt: 'Slot A',
                  options: [
                    { id: 'option:b', label: 'Option B' },
                    { id: 'option:b:d', label: 'Option BD' },
                  ],
                },
                {
                  id: 'slot:a:b',
                  anchorType: 'node',
                  anchorId: 'node-assembly',
                  prompt: 'Slot AB',
                  options: [
                    { id: 'option:c', label: 'Option C' },
                    { id: 'option:d', label: 'Option D' },
                  ],
                },
              ],
              correctValues: [
                { slotId: 'slot:a', optionId: 'option:b' },
                { slotId: 'slot:a:b', optionId: 'option:c' },
              ],
            }
          : question,
      ),
    };

    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise,
      answers: replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot:a', optionId: 'option:b:d' },
          { slotId: 'slot:a:b', optionId: 'option:c' },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'diagram-labeling-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown, incomplete, invalid and render-bearing diagram_labeling answers', () => {
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-government' },
          { slotId: 'slot-government-role', optionId: 'option-president' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'unknown-slot', optionId: 'option-government' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-motion-censure' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-government' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-government' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
        renderPayload: { widget: 'free-form' },
      }),
    );
  });

  it('scores calculation_mcq V1-C answers with deterministic correction steps', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CCalculationExerciseFixture(),
      answers: correctAnswersV1CCalculation(),
    });

    expect(result).toMatchObject({
      correctAnswers: 13,
      totalQuestions: 13,
      score: 1,
    });
    const item = result.items.find(
      (item) => item.questionId === 'calculation-mcq-majority-1',
    );
    const correction = item?.correction as
      | {
          correctChoiceId: string;
          expectedValue: number;
          workedSteps: unknown[];
        }
      | undefined;

    expect(item).toMatchObject({
      isCorrect: true,
    });
    expect(correction?.correctChoiceId).toBe('choice-289');
    expect(correction?.expectedValue).toBe(289);
    expect(correction?.workedSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'threshold', value: 289 }),
      ]),
    );
  });

  it('derives calculation_mcq correctness from the recalculated expected value', () => {
    const exercise = richClosedV1CCalculationExerciseFixture();
    const tamperedExercise: RichClosedExercise = {
      ...exercise,
      questions: exercise.questions.map((question) =>
        question.questionKind === 'calculation_mcq'
          ? { ...question, correctChoiceId: 'choice-288' }
          : question,
      ),
    };

    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: tamperedExercise,
      answers: correctAnswersV1CCalculation(),
    });

    expect(
      result.items.find(
        (item) => item.questionId === 'calculation-mcq-majority-1',
      ),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctChoiceId: 'choice-289',
        expectedValue: 289,
      },
    });
  });

  it('marks a wrong calculation_mcq choice as incorrect without recalculating from the answer value', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CCalculationExerciseFixture(),
      answers: replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'choice-288',
      }),
    });

    expect(
      result.items.find(
        (item) => item.questionId === 'calculation-mcq-majority-1',
      ),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
      correction: {
        correctChoiceId: 'choice-289',
        expectedValue: 289,
      },
    });
  });

  it('rejects unknown and private-field calculation_mcq answers', () => {
    expectInvalidV1CCalculation(
      replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalidV1CCalculation(
      replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'choice-289',
        expectedValue: 289,
      }),
    );
    expectInvalidV1CCalculation(
      replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'choice-289',
        formula: 'floor(validVotes / 2) + 1',
      }),
    );
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

function expectInvalidV1B(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1BFull(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1C(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1CFull(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CFullExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1CCalculation(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CCalculationExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function replaceAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return correctAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceV1BAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return correctAnswersV1B().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceV1BFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1BFull().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1CAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1C().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1CFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1CFull().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1CCalculationAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1CCalculation().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
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

function correctAnswersV1B(): RichClosedAnswer[] {
  return [
    ...correctAnswers(),
    {
      questionId: 'timeline-1',
      questionKind: 'timeline',
      orderedEventIds: ['event-1', 'event-2', 'event-3'],
    },
    {
      questionId: 'date-slider-1',
      questionKind: 'date_slider',
      year: 1958,
    },
  ];
}

function correctAnswersV1BFull(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1B(),
    {
      questionId: 'true-false-grid-1',
      questionKind: 'true_false_grid',
      values: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: true },
      ],
    },
    {
      questionId: 'cause-consequence-1',
      questionKind: 'cause_consequence',
      pairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    },
  ];
}

function correctAnswersV1C(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1BFull(),
    {
      questionId: 'institution-matrix-1',
      questionKind: 'institution_matrix',
      values: [
        {
          cellId: 'cell-president-legitimacy',
          optionId: 'option-legitimacy-election',
        },
        {
          cellId: 'cell-government-responsibility',
          optionId: 'option-responsibility-assembly',
        },
        {
          cellId: 'cell-assembly-action',
          optionId: 'option-action-censure',
        },
      ],
    },
  ];
}

function correctAnswersV1CFull(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1C(),
    {
      questionId: 'diagram-labeling-1',
      questionKind: 'diagram_labeling',
      values: [
        {
          slotId: 'slot-government-role',
          optionId: 'option-government',
        },
        {
          slotId: 'slot-censure',
          optionId: 'option-motion-censure',
        },
        {
          slotId: 'slot-nomination',
          optionId: 'option-nomination',
        },
      ],
    },
  ];
}

function correctAnswersV1CCalculation(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1CFull(),
    {
      questionId: 'calculation-mcq-majority-1',
      questionKind: 'calculation_mcq',
      choiceId: 'choice-289',
    },
  ];
}
