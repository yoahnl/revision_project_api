import {
  validateRichClosedExercise,
  validateRichClosedQuestion,
} from './rich-closed-question.validator';
import {
  richClosedExerciseFixture,
  richClosedCalculationMcqLargestRemainderFixture,
  richClosedQuestionFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
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
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
    'image_choice',
  ] as const)('accepts a valid rich closed %s question', (questionKind) => {
    const result = validateRichClosedQuestion(
      richClosedQuestionFixture(questionKind),
      { knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'] },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects a kind outside the rich closed allowlist', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      questionKind: 'fill_blank_dropdown',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_KIND_UNSUPPORTED' }),
    );
  });

  it('accepts a valid V1-C institution matrix exercise fixture', () => {
    const result = validateRichClosedExercise(richClosedV1CExerciseFixture(), {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a valid V1-C diagram labeling exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1CFullExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a valid V1-C calculation exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1CCalculationExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a valid V1-D image choice exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1DImageChoiceExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
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

  it('rejects cognitive skills outside the rich closed allowlist', () => {
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

  it('accepts a cognitive skill from the rich closed allowlist', () => {
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

  it('requires timeline questions to have at least three unique events', () => {
    const tooSmall = {
      ...richClosedQuestionFixture('timeline'),
      events: [
        { id: 'event-1', label: 'Dépôt de la motion' },
        { id: 'event-2', label: 'Débat politique' },
      ],
      correctOrder: ['event-1', 'event-2'],
    };
    const duplicateIds = {
      ...richClosedQuestionFixture('timeline'),
      events: [
        { id: 'event-1', label: 'Dépôt de la motion' },
        { id: 'event-1', label: 'Débat politique' },
        { id: 'event-3', label: 'Vote de la chambre' },
      ],
    };

    expect(validateRichClosedQuestion(tooSmall).issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_TIMELINE_TOO_SMALL' }),
    );
    expect(validateRichClosedQuestion(duplicateIds).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TIMELINE_EVENTS_INVALID',
      }),
    );
  });

  it('requires timeline correctOrder to contain each event exactly once', () => {
    const incomplete = {
      ...richClosedQuestionFixture('timeline'),
      correctOrder: ['event-1', 'event-2'],
    };
    const unknownId = {
      ...richClosedQuestionFixture('timeline'),
      correctOrder: ['event-1', 'event-2', 'unknown-event'],
    };

    expect(validateRichClosedQuestion(incomplete).issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_TIMELINE_INCOMPLETE' }),
    );
    expect(validateRichClosedQuestion(unknownId).issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_TIMELINE_INCOMPLETE' }),
    );
  });

  it('requires date_slider to define a valid integer range and correction', () => {
    const invalidRange = {
      ...richClosedQuestionFixture('date_slider'),
      minYear: 1970,
      maxYear: 1970,
    };
    const invalidStep = {
      ...richClosedQuestionFixture('date_slider'),
      step: 0,
    };
    const invalidCorrection = {
      ...richClosedQuestionFixture('date_slider'),
      correctYear: 1971,
    };
    const unreachableCorrection = {
      ...richClosedQuestionFixture('date_slider'),
      minYear: 1945,
      maxYear: 1970,
      step: 2,
      correctYear: 1958,
    };
    const invalidTolerance = {
      ...richClosedQuestionFixture('date_slider'),
      toleranceYears: -1,
    };

    expect(validateRichClosedQuestion(invalidRange).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_RANGE_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(invalidStep).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_STEP_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(invalidCorrection).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
      }),
    );
    expect(
      validateRichClosedQuestion(unreachableCorrection).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(invalidTolerance).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_TOLERANCE_INVALID',
      }),
    );
  });

  it('requires true_false_grid rows to be bounded and unique', () => {
    const tooSmall = {
      ...richClosedQuestionFixture('true_false_grid'),
      rows: [
        { id: 'row-1', statement: 'Le gouvernement est responsable.' },
        { id: 'row-2', statement: 'La dissolution est impossible.' },
      ],
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
      ],
    };
    const tooLarge = {
      ...richClosedQuestionFixture('true_false_grid'),
      rows: Array.from({ length: 9 }, (_, index) => ({
        id: `row-${index + 1}`,
        statement: `Affirmation ${index + 1}`,
      })),
      correctValues: Array.from({ length: 9 }, (_, index) => ({
        rowId: `row-${index + 1}`,
        value: index % 2 === 0,
      })),
    };
    const duplicateRows = {
      ...richClosedQuestionFixture('true_false_grid'),
      rows: [
        { id: 'row-1', statement: 'Affirmation A' },
        { id: 'row-1', statement: 'Affirmation B' },
        { id: 'row-3', statement: 'Affirmation C' },
      ],
    };

    expect(validateRichClosedQuestion(tooSmall).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_GRID_SIZE_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(tooLarge).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_GRID_SIZE_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(duplicateRows).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_ROWS_INVALID',
      }),
    );
  });

  it('requires true_false_grid correction to cover rows with strict booleans', () => {
    const incomplete = {
      ...richClosedQuestionFixture('true_false_grid'),
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
      ],
    };
    const unknownRow = {
      ...richClosedQuestionFixture('true_false_grid'),
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'unknown-row', value: true },
      ],
    };
    const nonBoolean = {
      ...richClosedQuestionFixture('true_false_grid'),
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: 'true' },
      ],
    };

    expect(validateRichClosedQuestion(incomplete).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(unknownRow).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(nonBoolean).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
      }),
    );
  });

  it('requires cause_consequence items and corrections to be complete and univocal', () => {
    const tooFewCauses = {
      ...richClosedQuestionFixture('cause_consequence'),
      causes: [
        { id: 'cause-1', label: 'Motion adoptée' },
        { id: 'cause-2', label: 'Dissolution' },
      ],
    };
    const tooFewConsequences = {
      ...richClosedQuestionFixture('cause_consequence'),
      consequences: [
        { id: 'consequence-1', label: 'Démission' },
        { id: 'consequence-2', label: 'Élections' },
      ],
    };
    const duplicateIds = {
      ...richClosedQuestionFixture('cause_consequence'),
      causes: [
        { id: 'cause-1', label: 'Motion adoptée' },
        { id: 'cause-1', label: 'Question rejetée' },
        { id: 'cause-3', label: 'Dissolution' },
      ],
    };
    const incomplete = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
      ],
    };
    const unknownId = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'unknown-consequence' },
      ],
    };
    const duplicateCause = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-1', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    };
    const duplicateConsequence = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-1' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    };
    const malformedExtraPair = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
        { causeId: 'cause-2' },
      ],
    };

    for (const question of [tooFewCauses, tooFewConsequences]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_CAUSE_CONSEQUENCE_TOO_SMALL',
        }),
      );
    }
    expect(validateRichClosedQuestion(duplicateIds).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_CAUSE_CONSEQUENCE_ITEMS_INVALID',
      }),
    );
    for (const question of [
      incomplete,
      unknownId,
      duplicateCause,
      duplicateConsequence,
      malformedExtraPair,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        }),
      );
    }
  });

  it('requires institution_matrix rows, columns, cells and corrections to be bounded and coherent', () => {
    const base = richClosedQuestionFixture('institution_matrix') as Extract<
      RichClosedQuestion,
      { questionKind: 'institution_matrix' }
    >;
    const tooFewRows = {
      ...base,
      rows: [{ id: 'row-1', label: 'Président' }],
    };
    const tooManyRows = {
      ...base,
      rows: Array.from({ length: 6 }, (_, index) => ({
        id: `row-${index + 1}`,
        label: `Institution ${index + 1}`,
      })),
    };
    const tooFewColumns = {
      ...base,
      columns: [{ id: 'column-1', label: 'Légitimité' }],
    };
    const tooManyColumns = {
      ...base,
      columns: Array.from({ length: 6 }, (_, index) => ({
        id: `column-${index + 1}`,
        label: `Propriété ${index + 1}`,
      })),
    };
    const unknownRow = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          rowId: 'unknown-row',
        },
        ...base.cells.slice(1),
      ],
    };
    const unknownColumn = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          columnId: 'unknown-column',
        },
        ...base.cells.slice(1),
      ],
    };
    const tooFewOptions = {
      ...base,
      cells: [
        { ...base.cells[0], options: [{ id: 'option-1', label: 'Oui' }] },
      ],
    };
    const tooManyOptions = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          options: Array.from({ length: 7 }, (_, index) => ({
            id: `option-${index + 1}`,
            label: `Option ${index + 1}`,
          })),
        },
      ],
    };
    const duplicateCells = {
      ...base,
      cells: [
        { ...base.cells[0] },
        { ...base.cells[0] },
        ...base.cells.slice(2),
      ],
    };
    const duplicateCellCoordinates = {
      ...base,
      cells: [
        { ...base.cells[0] },
        {
          ...base.cells[1],
          rowId: base.cells[0].rowId,
          columnId: base.cells[0].columnId,
        },
        ...base.cells.slice(2),
      ],
    };
    const duplicateOptions = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          options: [
            { id: 'option-a', label: 'Option A' },
            { id: 'option-a', label: 'Option B' },
          ],
        },
        ...base.cells.slice(1),
      ],
    };
    const incompleteCorrection = {
      ...base,
      correctValues: base.correctValues.slice(0, -1),
    };
    const unknownCellCorrection = {
      ...base,
      correctValues: [
        ...base.correctValues.slice(0, -1),
        { cellId: 'unknown-cell', optionId: 'option-legitimacy-election' },
      ],
    };
    const unknownOptionCorrection = {
      ...base,
      correctValues: [
        { cellId: base.cells[0].id, optionId: 'unknown-option' },
        ...base.correctValues.slice(1),
      ],
    };

    for (const question of [tooFewRows, tooManyRows]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID',
        }),
      );
    }
    for (const question of [tooFewColumns, tooManyColumns]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        }),
      );
    }
    for (const question of [
      unknownRow,
      unknownColumn,
      tooFewOptions,
      tooManyOptions,
      duplicateCells,
      duplicateCellCoordinates,
      duplicateOptions,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        }),
      );
    }
    for (const question of [
      incompleteCorrection,
      unknownCellCorrection,
      unknownOptionCorrection,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        }),
      );
    }
  });

  it('requires diagram_labeling diagram, slots and corrections to be bounded and coherent', () => {
    const base = richClosedQuestionFixture('diagram_labeling') as Extract<
      RichClosedQuestion,
      { questionKind: 'diagram_labeling' }
    >;
    const tooFewNodes = {
      ...base,
      diagram: { ...base.diagram, nodes: base.diagram.nodes.slice(0, 1) },
    };
    const tooManyNodes = {
      ...base,
      diagram: {
        ...base.diagram,
        nodes: Array.from({ length: 9 }, (_, index) => ({
          id: `node-${index + 1}`,
          label: `Noeud ${index + 1}`,
        })),
      },
    };
    const tooManyEdges = {
      ...base,
      diagram: {
        ...base.diagram,
        edges: Array.from({ length: 13 }, (_, index) => ({
          id: `edge-${index + 1}`,
          fromNodeId: 'node-president',
          toNodeId: 'node-government',
        })),
      },
    };
    const tooManyGroups = {
      ...base,
      diagram: {
        ...base.diagram,
        groups: Array.from({ length: 5 }, (_, index) => ({
          id: `group-${index + 1}`,
          label: `Groupe ${index + 1}`,
        })),
      },
    };
    const unknownFromNode = {
      ...base,
      diagram: {
        ...base.diagram,
        edges: [
          { ...base.diagram.edges[0], fromNodeId: 'unknown-node' },
          ...base.diagram.edges.slice(1),
        ],
      },
    };
    const unknownToNode = {
      ...base,
      diagram: {
        ...base.diagram,
        edges: [
          { ...base.diagram.edges[0], toNodeId: 'unknown-node' },
          ...base.diagram.edges.slice(1),
        ],
      },
    };
    const unknownGroup = {
      ...base,
      diagram: {
        ...base.diagram,
        nodes: [
          { ...base.diagram.nodes[0], groupId: 'unknown-group' },
          ...base.diagram.nodes.slice(1),
        ],
      },
    };
    const tooFewSlots = {
      ...base,
      slots: base.slots.slice(0, 1),
    };
    const tooManySlots = {
      ...base,
      slots: Array.from({ length: 9 }, (_, index) => ({
        ...base.slots[0],
        id: `slot-${index + 1}`,
      })),
    };
    const invalidAnchorType = {
      ...base,
      slots: [{ ...base.slots[0], anchorType: 'area' }, ...base.slots.slice(1)],
    };
    const unknownAnchor = {
      ...base,
      slots: [
        { ...base.slots[0], anchorId: 'unknown-anchor' },
        ...base.slots.slice(1),
      ],
    };
    const tooFewOptions = {
      ...base,
      slots: [
        { ...base.slots[0], options: [{ id: 'option-1', label: 'Oui' }] },
        ...base.slots.slice(1),
      ],
    };
    const tooManyOptions = {
      ...base,
      slots: [
        {
          ...base.slots[0],
          options: Array.from({ length: 7 }, (_, index) => ({
            id: `option-${index + 1}`,
            label: `Option ${index + 1}`,
          })),
        },
        ...base.slots.slice(1),
      ],
    };
    const duplicateSlots = {
      ...base,
      slots: [{ ...base.slots[0] }, { ...base.slots[0] }],
    };
    const duplicateOptions = {
      ...base,
      slots: [
        {
          ...base.slots[0],
          options: [
            { id: 'option-a', label: 'Option A' },
            { id: 'option-a', label: 'Option B' },
          ],
        },
        ...base.slots.slice(1),
      ],
    };
    const incompleteCorrection = {
      ...base,
      correctValues: base.correctValues.slice(0, -1),
    };
    const unknownSlotCorrection = {
      ...base,
      correctValues: [
        ...base.correctValues.slice(0, -1),
        { slotId: 'unknown-slot', optionId: 'option-government' },
      ],
    };
    const unknownOptionCorrection = {
      ...base,
      correctValues: [
        { slotId: base.slots[0].id, optionId: 'unknown-option' },
        ...base.correctValues.slice(1),
      ],
    };

    for (const question of [
      tooFewNodes,
      tooManyNodes,
      tooManyEdges,
      tooManyGroups,
      unknownFromNode,
      unknownToNode,
      unknownGroup,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_DIAGRAM_LABELING_DIAGRAM_INVALID',
        }),
      );
    }
    for (const question of [
      tooFewSlots,
      tooManySlots,
      invalidAnchorType,
      unknownAnchor,
      tooFewOptions,
      tooManyOptions,
      duplicateSlots,
      duplicateOptions,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        }),
      );
    }
    for (const question of [
      incompleteCorrection,
      unknownSlotCorrection,
      unknownOptionCorrection,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        }),
      );
    }
  });

  it.each(['html', 'svg', 'mermaid', 'widget', 'renderPayload'] as const)(
    'rejects arbitrary render field %s',
    (field) => {
      const question = {
        ...richClosedQuestionFixture('diagram_labeling'),
        [field]: '<unsafe>',
      };

      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN',
        }),
      );
    },
  );

  it('requires calculation_mcq absolute majority data and correction to match the deterministic result', () => {
    const base = richClosedQuestionFixture('calculation_mcq') as Extract<
      RichClosedQuestion,
      { questionKind: 'calculation_mcq' }
    >;

    expect(validateRichClosedQuestion(base).accepted).toBe(true);

    const cases = [
      {
        question: {
          ...base,
          calculation: { mode: 'absolute_majority_threshold', validVotes: 0 },
        },
        code: 'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { mode: 'absolute_majority_threshold', validVotes: 1.5 },
        },
        code: 'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            mode: 'absolute_majority_threshold',
            validVotes: 1_000_001,
          },
        },
        code: 'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
      },
      {
        question: { ...base, correctChoiceId: 'choice-288' },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
      {
        question: {
          ...base,
          choices: base.choices.filter((choice) => choice.value !== 289),
        },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
      {
        question: {
          ...base,
          choices: [
            ...base.choices,
            { id: 'choice-289-bis', label: '289 aussi', value: 289 },
          ],
        },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
      {
        question: {
          ...base,
          choices: [
            { id: 'choice-a', label: 'A', value: 288 },
            { id: 'choice-b', label: 'B', value: 288 },
          ],
        },
        code: 'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
      },
    ];

    for (const { question, code } of cases) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it('requires calculation_mcq largest remainder data to be bounded and unambiguous', () => {
    const base = richClosedCalculationMcqLargestRemainderFixture();
    const baseCalculation = base.calculation;
    if (baseCalculation.mode !== 'largest_remainder_target_party_seats') {
      throw new Error('Expected largest remainder calculation fixture');
    }
    const cases = [
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, totalSeats: 0 },
        },
        code: 'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, totalSeats: 1.5 },
        },
        code: 'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, totalSeats: 201 },
        },
        code: 'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: baseCalculation.parties.slice(0, 1),
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: Array.from({ length: 9 }, (_, index) => ({
              id: `party-${index}`,
              label: `Liste ${index}`,
              votes: index + 1,
            })),
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: [
              { id: 'party-a', label: 'Liste A', votes: 4300 },
              { id: 'party-a', label: 'Liste B', votes: 3100 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, targetPartyId: 'unknown-party' },
        },
        code: 'RICH_CLOSED_CALCULATION_TARGET_PARTY_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: [
              { id: 'party-a', label: 'Liste A', votes: -1 },
              { id: 'party-b', label: 'Liste B', votes: 1 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: [
              { id: 'party-a', label: 'Liste A', votes: 0 },
              { id: 'party-b', label: 'Liste B', votes: 0 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_TOTAL_VOTES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            mode: 'largest_remainder_target_party_seats',
            totalSeats: 2,
            targetPartyId: 'party-a',
            parties: [
              { id: 'party-a', label: 'Liste A', votes: 100 },
              { id: 'party-b', label: 'Liste B', votes: 100 },
              { id: 'party-c', label: 'Liste C', votes: 100 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_INVALID',
      },
      {
        question: { ...base, correctChoiceId: 'choice-3' },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
    ];

    expect(validateRichClosedQuestion(base).accepted).toBe(true);
    for (const { question, code } of cases) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it.each([
    'formula',
    'expression',
    'rawFormula',
    'calculationCode',
    'script',
    'code',
    'renderPayload',
  ] as const)('rejects calculation free-form field %s', (field) => {
    const question = {
      ...richClosedQuestionFixture('calculation_mcq'),
      [field]: 'unsafe',
    };

    expect(validateRichClosedQuestion(question).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN',
      }),
    );
  });

  it.each([
    ['choices', []],
    [
      'choices',
      [
        {
          id: 'choice-image-a',
          label: 'Image A',
          imageAssetId: 'image-choice-historical-figure-001-v1',
          altText:
            'Portrait historique en noir et blanc d’un homme en uniforme.',
        },
      ],
    ],
    [
      'choices',
      [
        {
          id: 'choice-a',
          label: 'Image A',
          imageAssetId: 'image-choice-historical-figure-001-v1',
          altText:
            'Portrait historique en noir et blanc d’un homme en uniforme.',
        },
        {
          id: 'choice-a',
          label: 'Image B',
          imageAssetId: 'image-choice-historical-figure-002-v1',
          altText: 'Portrait peint d’un homme en tenue impériale.',
        },
      ],
    ],
  ] as const)('rejects invalid image_choice %s contract', (field, value) => {
    const question = {
      ...richClosedQuestionFixture('image_choice'),
      [field]: value,
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_IMAGE_CHOICE_INVALID' }),
    );
  });

  it.each([
    {
      name: 'unknown asset id',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          { ...question.choices[0], imageAssetId: 'unknown-asset' },
          question.choices[1],
        ],
      }),
    },
    {
      name: 'duplicate asset ids',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          question.choices[0],
          {
            ...question.choices[1],
            imageAssetId: question.choices[0].imageAssetId,
            altText: question.choices[0].altText,
          },
        ],
      }),
    },
    {
      name: 'empty alt text',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [{ ...question.choices[0], altText: '' }, question.choices[1]],
      }),
    },
    {
      name: 'alt text different from catalog',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          { ...question.choices[0], altText: 'Portrait de Charles de Gaulle' },
          question.choices[1],
        ],
      }),
    },
    {
      name: 'public label revealing semantic label',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          { ...question.choices[0], label: 'Charles de Gaulle' },
          question.choices[1],
          question.choices[2],
        ],
      }),
    },
    {
      name: 'public caption revealing semantic label',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          question.choices[0],
          question.choices[1],
          { ...question.choices[2], caption: 'Simone Veil' },
        ],
      }),
    },
    {
      name: 'unknown correctChoiceId',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        correctChoiceId: 'unknown-choice',
      }),
    },
  ])('rejects image_choice with $name', ({ mutate }) => {
    const question = mutate(
      richClosedQuestionFixture('image_choice') as Extract<
        RichClosedQuestion,
        { questionKind: 'image_choice' }
      >,
    );

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_IMAGE_CHOICE_INVALID' }),
    );
  });

  it.each([
    'imageUrl',
    'url',
    'remoteUrl',
    'src',
    'href',
    'storagePath',
    'bucketPath',
    'cdnUrl',
    'base64',
    'dataUri',
    'blob',
    'rawImage',
    'renderPayload',
    'semanticLabel',
    'answerHint',
  ] as const)('rejects image_choice carrying forbidden field %s', (field) => {
    const question = {
      ...richClosedQuestionFixture('image_choice'),
      [field]: field === 'renderPayload' ? { widget: 'free' } : 'forbidden',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN' }),
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

  it('validates a complete V1-B exercise fixture', () => {
    const result = validateRichClosedExercise(richClosedV1BExerciseFixture(), {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('validates a complete V1-B full exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1BFullExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
