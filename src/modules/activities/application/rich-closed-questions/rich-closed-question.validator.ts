import {
  RICH_CLOSED_CALCULATION_INVALID,
  evaluateRichClosedCalculationMcq,
} from './rich-closed-question-calculation';
import {
  RICH_CLOSED_EXERCISE_VERSION,
  RICH_CLOSED_COGNITIVE_SKILLS,
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedCalculationChoice,
  type RichClosedCalculationData,
  type RichClosedCalculationParty,
  type RichClosedChoice,
  type RichClosedCauseConsequencePair,
  type RichClosedDiagram,
  type RichClosedDiagramAnchorType,
  type RichClosedDiagramEdge,
  type RichClosedDiagramGroup,
  type RichClosedDiagramLabelingSlot,
  type RichClosedDiagramLabelingValue,
  type RichClosedDiagramLayout,
  type RichClosedDiagramNode,
  type RichClosedExerciseValidationIssue,
  type RichClosedExerciseValidationResult,
  type RichClosedImageChoiceOption,
  type RichClosedInstitutionMatrixCell,
  type RichClosedInstitutionMatrixValue,
  type RichClosedPair,
  type RichClosedQuestionKind,
  type RichClosedTrueFalseValue,
} from './rich-closed-question.types';
import { getRichClosedImageAsset } from './rich-closed-image-assets';

const MAX_PROMPT_LENGTH = 700;
const MAX_CASE_TEXT_LENGTH = 900;
const MAX_STATEMENT_LENGTH = 900;
const MAX_EXPLANATION_LENGTH = 1200;
const MAX_INSTRUCTION_LENGTH = 400;
const MAX_TIMELINE_EVENT_DESCRIPTION_LENGTH = 500;
const MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH = 500;
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;
const MIN_STRUCTURED_ITEMS = 3;
const MAX_TRUE_FALSE_ROWS = 8;
const MIN_MATRIX_AXIS_ITEMS = 2;
const MAX_MATRIX_AXIS_ITEMS = 5;
const MIN_MATRIX_CELLS = 3;
const MAX_MATRIX_CELL_OPTIONS = 6;
const MIN_DIAGRAM_NODES = 2;
const MAX_DIAGRAM_NODES = 8;
const MAX_DIAGRAM_EDGES = 12;
const MAX_DIAGRAM_GROUPS = 4;
const MIN_DIAGRAM_SLOTS = 2;
const MAX_DIAGRAM_SLOTS = 8;
const MAX_DIAGRAM_SLOT_OPTIONS = 6;
const MAX_CALCULATION_VOTES = 1_000_000;
const MAX_CALCULATION_TOTAL_SEATS = 200;
const MIN_CALCULATION_PARTIES = 2;
const MAX_CALCULATION_PARTIES = 8;
const DIAGRAM_LAYOUTS = [
  'vertical_flow',
  'two_column',
  'cycle',
  'hierarchy',
  'plain',
] as const;

const FORBIDDEN_RICH_CLOSED_RENDER_KEYS = new Set([
  'html',
  'svg',
  'rawSvg',
  'mermaid',
  'markdown',
  'widget',
  'component',
  'renderPayload',
  'expectedValue',
  'workedSteps',
  'style',
  'css',
  'script',
  'formula',
  'expression',
  'rawFormula',
  'calculationCode',
  'javascript',
  'python',
  'imageUrl',
  'assetUrl',
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
  'assetPath',
  'semanticLabel',
  'answerHint',
  'canvas',
  'code',
  'markup',
]);

export interface RichClosedQuestionValidationOptions {
  knownSourceChunkIds?: readonly string[] | ReadonlySet<string>;
}

export function validateRichClosedExercise(
  exercise: unknown,
  options: RichClosedQuestionValidationOptions = {},
): RichClosedExerciseValidationResult {
  const issues: RichClosedExerciseValidationIssue[] = [];

  if (!isRecord(exercise)) {
    return rejected([
      issue('RICH_CLOSED_EXERCISE_INVALID', 'Exercise must be an object'),
    ]);
  }

  if (exercise.version !== RICH_CLOSED_EXERCISE_VERSION) {
    issues.push(
      issue(
        'RICH_CLOSED_VERSION_INVALID',
        'Exercise version must be rich-closed-question-v1',
        'version',
      ),
    );
  }

  if (!plainString(exercise.id)) {
    issues.push(
      issue('RICH_CLOSED_ID_INVALID', 'Exercise id is required', 'id'),
    );
  }

  if (!boundedString(exercise.title, 1, 160)) {
    issues.push(
      issue('RICH_CLOSED_TITLE_INVALID', 'Exercise title is invalid', 'title'),
    );
  }

  if (!Array.isArray(exercise.questions) || exercise.questions.length === 0) {
    issues.push(
      issue(
        'RICH_CLOSED_QUESTIONS_INVALID',
        'Exercise must contain at least one question',
        'questions',
      ),
    );
  } else {
    exercise.questions.forEach((question, index) => {
      const result = validateRichClosedQuestion(question, options);
      issues.push(
        ...result.issues.map((questionIssue) => ({
          ...questionIssue,
          path: `questions.${index}${
            questionIssue.path === undefined ? '' : `.${questionIssue.path}`
          }`,
        })),
      );
    });
  }

  return {
    accepted: issues.length === 0,
    issues,
  };
}

export function validateRichClosedQuestion(
  question: unknown,
  options: RichClosedQuestionValidationOptions = {},
): RichClosedExerciseValidationResult {
  const issues: RichClosedExerciseValidationIssue[] = [];

  if (!isRecord(question)) {
    return rejected([
      issue('RICH_CLOSED_QUESTION_INVALID', 'Question must be an object'),
    ]);
  }

  if (containsFreeAnswerField(question)) {
    issues.push(
      issue(
        'RICH_CLOSED_FREE_ANSWER_FORBIDDEN',
        'Rich closed questions cannot contain free-answer fields',
      ),
    );
  }

  if (containsForbiddenRenderField(question)) {
    issues.push(
      issue(
        'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN',
        'Rich closed questions cannot contain arbitrary render payload fields',
      ),
    );
  }

  const questionKind = question.questionKind;
  if (!isRichClosedQuestionKind(questionKind)) {
    issues.push(
      issue(
        'RICH_CLOSED_KIND_UNSUPPORTED',
        'Question kind is not part of the rich closed allowlist',
        'questionKind',
      ),
    );
    return {
      accepted: false,
      issues,
    };
  }

  validateCommonQuestionFields(question, issues, options);

  switch (questionKind) {
    case 'single_choice':
      validateSingleChoiceQuestion(question, issues);
      break;
    case 'multiple_choice':
      validateMultipleChoiceQuestion(question, issues);
      break;
    case 'matching':
      validateMatchingQuestion(question, issues);
      break;
    case 'ordering':
      validateOrderingQuestion(question, issues);
      break;
    case 'timeline':
      validateTimelineQuestion(question, issues);
      break;
    case 'date_slider':
      validateDateSliderQuestion(question, issues);
      break;
    case 'true_false_grid':
      validateTrueFalseGridQuestion(question, issues);
      break;
    case 'cause_consequence':
      validateCauseConsequenceQuestion(question, issues);
      break;
    case 'institution_matrix':
      validateInstitutionMatrixQuestion(question, issues);
      break;
    case 'diagram_labeling':
      validateDiagramLabelingQuestion(question, issues);
      break;
    case 'calculation_mcq':
      validateCalculationMcqQuestion(question, issues);
      break;
    case 'image_choice':
      validateImageChoiceQuestion(question, issues);
      break;
    case 'case_qualification':
      validateCaseQualificationQuestion(question, issues);
      break;
    case 'error_detection':
      validateErrorDetectionQuestion(question, issues);
      break;
  }

  return {
    accepted: issues.length === 0,
    issues,
  };
}

function validateCommonQuestionFields(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
  options: RichClosedQuestionValidationOptions,
) {
  if (!plainString(question.id)) {
    issues.push(
      issue('RICH_CLOSED_ID_INVALID', 'Question id is required', 'id'),
    );
  }

  if (!boundedString(question.prompt, 1, MAX_PROMPT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_PROMPT_INVALID',
        'Question prompt is invalid',
        'prompt',
      ),
    );
  }

  if (
    question.difficulty !== 'LOW' &&
    question.difficulty !== 'MEDIUM' &&
    question.difficulty !== 'HIGH'
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIFFICULTY_INVALID',
        'Question difficulty is invalid',
        'difficulty',
      ),
    );
  }

  if (!isRichClosedCognitiveSkill(question.cognitiveSkill)) {
    issues.push(
      issue(
        'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
        'Question cognitive skill is not part of the rich closed allowlist',
        'cognitiveSkill',
      ),
    );
  }

  validateSources(question.sourceChunkIds, issues, options);
}

function validateSingleChoiceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readChoices(question.choices, issues, 'choices');

  if (!choiceIds(choices).has(readString(question.correctChoiceId))) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Single choice correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateMultipleChoiceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readChoices(question.choices, issues, 'choices');
  const knownChoiceIds = choiceIds(choices);
  const correctChoiceIds = readStringArray(question.correctChoiceIds);
  const minSelections = question.minSelections;
  const maxSelections = question.maxSelections;

  if (correctChoiceIds.length < 2) {
    issues.push(
      issue(
        'RICH_CLOSED_MULTIPLE_TOO_FEW_CORRECT',
        'Multiple choice requires at least two correct answers',
        'correctChoiceIds',
      ),
    );
  }

  if (
    hasDuplicates(correctChoiceIds) ||
    correctChoiceIds.some((choiceId) => !knownChoiceIds.has(choiceId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Multiple choice correction must reference existing choices once',
        'correctChoiceIds',
      ),
    );
  }

  if (
    typeof minSelections !== 'number' ||
    typeof maxSelections !== 'number' ||
    !Number.isInteger(minSelections) ||
    !Number.isInteger(maxSelections) ||
    minSelections < 1 ||
    maxSelections < minSelections ||
    maxSelections > choices.length ||
    correctChoiceIds.length < minSelections ||
    correctChoiceIds.length > maxSelections
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_SELECTION_BOUNDS_INVALID',
        'Multiple choice selection bounds are invalid',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateMatchingQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const leftItems = readLabelItems(question.leftItems, issues, 'leftItems');
  const rightItems = readLabelItems(question.rightItems, issues, 'rightItems');
  const pairs = readPairs(question.correctPairs);

  if (
    leftItems.length < MIN_STRUCTURED_ITEMS ||
    rightItems.length < MIN_STRUCTURED_ITEMS ||
    pairs.length < MIN_STRUCTURED_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_MATCHING_TOO_SMALL',
        'Matching requires at least three pairs',
      ),
    );
  }

  const leftIds = idSet(leftItems);
  const rightIds = idSet(rightItems);
  const pairedLeftIds = pairs.map((pair) => pair.leftId);
  const pairedRightIds = pairs.map((pair) => pair.rightId);

  if (hasDuplicates(pairedLeftIds) || hasDuplicates(pairedRightIds)) {
    issues.push(
      issue(
        'RICH_CLOSED_MATCHING_DUPLICATE_PAIR',
        'Matching pairs cannot reuse a side',
        'correctPairs',
      ),
    );
  }

  if (
    pairs.some(
      (pair) => !leftIds.has(pair.leftId) || !rightIds.has(pair.rightId),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Matching correction must reference existing items',
        'correctPairs',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateOrderingQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const items = readLabelItems(question.items, issues, 'items');
  const itemIds = [...idSet(items)];
  const correctOrder = readStringArray(question.correctOrder);

  if (items.length < MIN_STRUCTURED_ITEMS) {
    issues.push(
      issue(
        'RICH_CLOSED_ORDERING_TOO_SMALL',
        'Ordering requires at least three items',
        'items',
      ),
    );
  }

  if (
    correctOrder.length !== itemIds.length ||
    hasDuplicates(correctOrder) ||
    correctOrder.some((itemId) => !itemIds.includes(itemId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_ORDERING_INCOMPLETE',
        'Ordering correction must contain each item exactly once',
        'correctOrder',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateTimelineQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const events = readTimelineEvents(question.events, issues, 'events');
  const eventIds = [...idSet(events)];
  const correctOrder = readStringArray(question.correctOrder);

  if (events.length < MIN_STRUCTURED_ITEMS) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_TOO_SMALL',
        'Timeline requires at least three events',
        'events',
      ),
    );
  }

  if (
    correctOrder.length !== eventIds.length ||
    hasDuplicates(correctOrder) ||
    correctOrder.some((eventId) => !eventIds.includes(eventId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_INCOMPLETE',
        'Timeline correction must contain each event exactly once',
        'correctOrder',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateDateSliderQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const minYear = readInteger(question.minYear);
  const maxYear = readInteger(question.maxYear);
  const step = readInteger(question.step);
  const correctYear = readInteger(question.correctYear);
  const toleranceYears = readInteger(question.toleranceYears);

  if (minYear === null || maxYear === null || minYear >= maxYear) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_RANGE_INVALID',
        'Date slider must define an increasing integer year range',
      ),
    );
  }

  if (step === null || step < 1) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_STEP_INVALID',
        'Date slider step must be an integer greater than or equal to one',
        'step',
      ),
    );
  }

  if (
    correctYear === null ||
    minYear === null ||
    maxYear === null ||
    correctYear < minYear ||
    correctYear > maxYear
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
        'Date slider correction must be within the public year range',
        'correctYear',
      ),
    );
  }

  if (toleranceYears === null || toleranceYears < 0) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_TOLERANCE_INVALID',
        'Date slider tolerance must be a positive or zero integer',
        'toleranceYears',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateTrueFalseGridQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const rows = readTrueFalseRows(question.rows, issues, 'rows');
  const rowIds = [...idSet(rows)];
  const correctValues = readTrueFalseValues(
    question.correctValues,
    issues,
    'correctValues',
  );
  const correctedRowIds = correctValues.map((value) => value.rowId);

  if (rows.length < MIN_STRUCTURED_ITEMS || rows.length > MAX_TRUE_FALSE_ROWS) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_GRID_SIZE_INVALID',
        'True/false grid requires between three and eight rows',
        'rows',
      ),
    );
  }

  if (
    correctValues.length !== rowIds.length ||
    hasDuplicates(correctedRowIds) ||
    correctedRowIds.some((rowId) => !rowIds.includes(rowId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
        'True/false grid correction must contain one boolean value per row',
        'correctValues',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateCauseConsequenceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const causes = readCauseConsequenceItems(question.causes, issues, 'causes');
  const consequences = readCauseConsequenceItems(
    question.consequences,
    issues,
    'consequences',
  );
  const pairs = readCauseConsequencePairs(
    question.correctPairs,
    issues,
    'correctPairs',
  );
  const causeIds = [...idSet(causes)];
  const consequenceIds = [...idSet(consequences)];
  const pairedCauseIds = pairs.map((pair) => pair.causeId);
  const pairedConsequenceIds = pairs.map((pair) => pair.consequenceId);

  if (
    causes.length < MIN_STRUCTURED_ITEMS ||
    consequences.length < MIN_STRUCTURED_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_TOO_SMALL',
        'Cause/consequence requires at least three causes and consequences',
      ),
    );
  }

  if (
    pairs.length !== causeIds.length ||
    hasDuplicates(pairedCauseIds) ||
    hasDuplicates(pairedConsequenceIds) ||
    pairs.some(
      (pair) =>
        !causeIds.includes(pair.causeId) ||
        !consequenceIds.includes(pair.consequenceId),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        'Cause/consequence correction must pair every cause with a unique existing consequence',
        'correctPairs',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateInstitutionMatrixQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const rows = readInstitutionMatrixAxisItems(question.rows, issues, 'rows');
  const columns = readInstitutionMatrixAxisItems(
    question.columns,
    issues,
    'columns',
  );
  const rowIds = [...idSet(rows)];
  const columnIds = [...idSet(columns)];
  const cells = readInstitutionMatrixCells(question.cells, issues, 'cells');
  const correctValues = readInstitutionMatrixValues(
    question.correctValues,
    issues,
    'correctValues',
  );
  const cellIds = [...idSet(cells)];
  const correctedCellIds = correctValues.map((value) => value.cellId);

  if (
    rows.length < MIN_MATRIX_AXIS_ITEMS ||
    rows.length > MAX_MATRIX_AXIS_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID',
        'Institution matrix requires between two and five rows',
        'rows',
      ),
    );
  }

  if (
    columns.length < MIN_MATRIX_AXIS_ITEMS ||
    columns.length > MAX_MATRIX_AXIS_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        'Institution matrix requires between two and five columns',
        'columns',
      ),
    );
  }

  if (
    cells.length < MIN_MATRIX_CELLS ||
    cells.length > rows.length * columns.length ||
    hasDuplicates(cells.map((cell) => cell.id)) ||
    hasDuplicateInstitutionMatrixCoordinates(cells) ||
    cells.some(
      (cell) =>
        !rowIds.includes(cell.rowId) ||
        !columnIds.includes(cell.columnId) ||
        cell.options.length < MIN_CHOICES ||
        cell.options.length > MAX_MATRIX_CELL_OPTIONS ||
        hasDuplicates(cell.options.map((option) => option.id)),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        'Institution matrix cells must reference existing rows/columns and carry bounded unique options',
        'cells',
      ),
    );
  }

  if (
    correctValues.length !== cellIds.length ||
    hasDuplicates(correctedCellIds) ||
    correctValues.some((value) => {
      const cell = cells.find((candidate) => candidate.id === value.cellId);

      return (
        cell === undefined ||
        !cell.options.some((option) => option.id === value.optionId)
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        'Institution matrix correction must contain one existing option per cell',
        'correctValues',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function hasDuplicateInstitutionMatrixCoordinates(
  cells: readonly RichClosedInstitutionMatrixCell[],
): boolean {
  const coordinates = new Set<string>();

  for (const cell of cells) {
    const coordinate = `${cell.rowId}\u0000${cell.columnId}`;
    if (coordinates.has(coordinate)) {
      return true;
    }
    coordinates.add(coordinate);
  }

  return false;
}

function validateDiagramLabelingQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const diagram = readDiagram(question.diagram, issues, 'diagram');
  const slots = readDiagramLabelingSlots(question.slots, issues, 'slots');
  const correctValues = readDiagramLabelingValues(
    question.correctValues,
    issues,
    'correctValues',
  );

  const groups = diagram?.groups ?? [];
  const nodes = diagram?.nodes ?? [];
  const edges = diagram?.edges ?? [];
  const groupIds = [...idSet(groups)];
  const nodeIds = [...idSet(nodes)];
  const edgeIds = [...idSet(edges)];
  const slotIds = [...idSet(slots)];
  const correctedSlotIds = correctValues.map((value) => value.slotId);

  if (
    diagram === null ||
    nodes.length < MIN_DIAGRAM_NODES ||
    nodes.length > MAX_DIAGRAM_NODES ||
    hasDuplicates(nodes.map((node) => node.id)) ||
    groups.length > MAX_DIAGRAM_GROUPS ||
    hasDuplicates(groups.map((group) => group.id)) ||
    nodes.some(
      (node) =>
        node.groupId !== undefined &&
        node.groupId !== null &&
        !groupIds.includes(node.groupId),
    ) ||
    edges.length > MAX_DIAGRAM_EDGES ||
    hasDuplicates(edges.map((edge) => edge.id)) ||
    edges.some(
      (edge) =>
        !nodeIds.includes(edge.fromNodeId) || !nodeIds.includes(edge.toNodeId),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_DIAGRAM_INVALID',
        'Diagram labeling diagram must contain bounded semantic nodes, groups and edges',
        'diagram',
      ),
    );
  }

  if (
    slots.length < MIN_DIAGRAM_SLOTS ||
    slots.length > MAX_DIAGRAM_SLOTS ||
    hasDuplicates(slots.map((slot) => slot.id)) ||
    slots.some((slot) => {
      const knownAnchorIds = slot.anchorType === 'node' ? nodeIds : edgeIds;

      return (
        !knownAnchorIds.includes(slot.anchorId) ||
        slot.options.length < MIN_CHOICES ||
        slot.options.length > MAX_DIAGRAM_SLOT_OPTIONS ||
        hasDuplicates(slot.options.map((option) => option.id))
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        'Diagram labeling slots must target known nodes/edges and carry bounded unique options',
        'slots',
      ),
    );
  }

  if (
    correctValues.length !== slotIds.length ||
    hasDuplicates(correctedSlotIds) ||
    correctValues.some((value) => {
      const slot = slots.find((candidate) => candidate.id === value.slotId);

      return (
        slot === undefined ||
        !slot.options.some((option) => option.id === value.optionId)
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        'Diagram labeling correction must contain one existing option per slot',
        'correctValues',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateCalculationMcqQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (!boundedString(question.scenario, 1, MAX_CASE_TEXT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_SCENARIO_INVALID',
        'Calculation MCQ requires a bounded scenario',
        'scenario',
      ),
    );
  }

  const calculation = readCalculationData(
    question.calculation,
    issues,
    'calculation',
  );
  const choices = readCalculationChoices(question.choices, issues, 'choices');
  const correctChoiceId = readString(question.correctChoiceId);
  const correctChoice = choices.find((choice) => choice.id === correctChoiceId);

  if (!correctChoice) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
        'Calculation MCQ correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  if (hasDuplicates(choices.map((choice) => String(choice.value)))) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
        'Calculation MCQ choices must have unique integer values',
        'choices',
      ),
    );
  }

  if (calculation !== null) {
    try {
      const evaluation = evaluateRichClosedCalculationMcq(calculation);
      const expectedChoices = choices.filter(
        (choice) => choice.value === evaluation.expectedValue,
      );

      if (
        expectedChoices.length !== 1 ||
        correctChoice?.value !== evaluation.expectedValue
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
            'Calculation MCQ correct choice must match the deterministic expected value',
            'correctChoiceId',
          ),
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === RICH_CLOSED_CALCULATION_INVALID
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_INVALID',
            'Calculation MCQ data cannot be evaluated deterministically',
            'calculation',
          ),
        );
      } else {
        throw error;
      }
    }
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateImageChoiceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readImageChoices(question.choices, issues, 'choices');
  const choiceIds = choices.map((choice) => choice.id);
  const imageAssetIds = choices.map((choice) => choice.imageAssetId);
  const correctChoiceId = readString(question.correctChoiceId);

  if (
    choices.length < MIN_CHOICES ||
    choices.length > MAX_CHOICES ||
    hasDuplicates(choiceIds) ||
    hasDuplicates(imageAssetIds) ||
    choices.some((choice) => {
      const asset = getRichClosedImageAsset(choice.imageAssetId);

      return (
        asset === null ||
        choice.altText !== asset.publicAltText ||
        (choice.creditLabel !== undefined &&
          choice.creditLabel !== asset.creditLabel) ||
        (choice.license !== undefined && choice.license !== asset.license) ||
        imageChoicePublicTextRevealsSemanticLabel(choice.label, asset) ||
        imageChoicePublicTextRevealsSemanticLabel(choice.caption, asset)
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice must use bounded choices from the controlled image asset catalog',
        'choices',
      ),
    );
  }

  if (!choiceIds.includes(correctChoiceId)) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function imageChoicePublicTextRevealsSemanticLabel(
  value: string | null | undefined,
  asset: NonNullable<ReturnType<typeof getRichClosedImageAsset>>,
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  const normalizedValueTokens = new Set(
    normalizeImageChoicePublicText(value)
      .split(' ')
      .filter((token) => token.length > 0),
  );
  const semanticTokens = normalizeImageChoicePublicText(asset.semanticLabel)
    .split(' ')
    .filter((token) => token.length >= 4);

  if (semanticTokens.length === 0 || normalizedValueTokens.size === 0) {
    return false;
  }

  return semanticTokens.some((token) => normalizedValueTokens.has(token));
}

function normalizeImageChoicePublicText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function validateCaseQualificationQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readChoices(question.choices, issues, 'choices');

  if (!boundedString(question.caseText, 1, MAX_CASE_TEXT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_CASE_TEXT_INVALID',
        'Case qualification requires a short case text',
        'caseText',
      ),
    );
  }

  if (!choiceIds(choices).has(readString(question.correctChoiceId))) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Case qualification correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateErrorDetectionQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const errorOptions = readChoices(
    question.errorOptions,
    issues,
    'errorOptions',
  );

  if (!boundedString(question.statement, 1, MAX_STATEMENT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_STATEMENT_INVALID',
        'Error detection requires a bounded statement',
        'statement',
      ),
    );
  }

  if (!choiceIds(errorOptions).has(readString(question.correctErrorId))) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Error detection correction must target one existing error option',
        'correctErrorId',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateSources(
  sourceChunkIds: unknown,
  issues: RichClosedExerciseValidationIssue[],
  options: RichClosedQuestionValidationOptions,
) {
  const sourceIds = readStringArray(sourceChunkIds);

  if (
    !Array.isArray(sourceChunkIds) ||
    sourceIds.length !== sourceChunkIds.length
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_SOURCES_INVALID',
        'Question sources must be an array of non-empty chunk ids',
        'sourceChunkIds',
      ),
    );
    return;
  }

  if (hasDuplicates(sourceIds)) {
    issues.push(
      issue(
        'RICH_CLOSED_SOURCES_DUPLICATE',
        'Question sources cannot contain duplicates',
        'sourceChunkIds',
      ),
    );
  }

  const knownSourceChunkIds = toStringSet(options.knownSourceChunkIds);
  if (
    knownSourceChunkIds !== null &&
    sourceIds.some((sourceChunkId) => !knownSourceChunkIds.has(sourceChunkId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_SOURCE_UNKNOWN',
        'Question references a source chunk outside the known source set',
        'sourceChunkIds',
      ),
    );
  }
}

function readChoices(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedChoice[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_CHOICES ||
    value.length > MAX_CHOICES
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CHOICES_INVALID',
        'Question choices must contain between two and six items',
        path,
      ),
    );
    return [];
  }

  const choices = value.filter(isChoice);
  if (
    choices.length !== value.length ||
    hasDuplicates(choices.map((choice) => choice.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CHOICES_INVALID',
        'Question choices must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return choices;
}

function readLabelItems(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_ITEMS_INVALID',
        'Structured items must be an array',
        path,
      ),
    );
    return [];
  }

  const items = value.filter(isLabelItem);
  if (
    items.length !== value.length ||
    hasDuplicates(items.map((item) => item.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_ITEMS_INVALID',
        'Structured items must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return items;
}

function readTimelineEvents(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_EVENTS_INVALID',
        'Timeline events must be an array',
        path,
      ),
    );
    return [];
  }

  const events = value.filter(isTimelineEvent);
  if (
    events.length !== value.length ||
    hasDuplicates(events.map((event) => event.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_EVENTS_INVALID',
        'Timeline events must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return events;
}

function readTrueFalseRows(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_ROWS_INVALID',
        'True/false rows must be an array',
        path,
      ),
    );
    return [];
  }

  const rows = value.filter(isTrueFalseRow);
  if (
    rows.length !== value.length ||
    hasDuplicates(rows.map((row) => row.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_ROWS_INVALID',
        'True/false rows must have unique non-empty ids and statements',
        path,
      ),
    );
  }

  return rows;
}

function readTrueFalseValues(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedTrueFalseValue[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
        'True/false correction must be an array',
        path,
      ),
    );
    return [];
  }

  const values = value.filter(isTrueFalseValue);
  if (values.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
        'True/false correction values must be strict booleans',
        path,
      ),
    );
  }

  return values;
}

function readCauseConsequenceItems(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_ITEMS_INVALID',
        'Cause/consequence items must be an array',
        path,
      ),
    );
    return [];
  }

  const items = value.filter(isDescribedLabelItem);
  if (
    items.length !== value.length ||
    hasDuplicates(items.map((item) => item.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_ITEMS_INVALID',
        'Cause/consequence items must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return items;
}

function readPairs(value: unknown): RichClosedPair[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (pair): pair is RichClosedPair =>
      isRecord(pair) && plainString(pair.leftId) && plainString(pair.rightId),
  );
}

function readCauseConsequencePairs(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCauseConsequencePair[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        'Cause/consequence correction must be an array',
        path,
      ),
    );
    return [];
  }

  const pairs = value.filter(
    (pair): pair is RichClosedCauseConsequencePair =>
      isRecord(pair) &&
      plainString(pair.causeId) &&
      plainString(pair.consequenceId),
  );
  if (pairs.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        'Cause/consequence correction pairs must have causeId and consequenceId',
        path,
      ),
    );
  }

  return pairs;
}

function readInstitutionMatrixAxisItems(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: 'rows' | 'columns',
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        path === 'rows'
          ? 'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID'
          : 'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        'Institution matrix axis items must be an array',
        path,
      ),
    );
    return [];
  }

  const items = value.filter(isDescribedLabelItem);
  if (
    items.length !== value.length ||
    hasDuplicates(items.map((item) => item.id))
  ) {
    issues.push(
      issue(
        path === 'rows'
          ? 'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID'
          : 'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        'Institution matrix axis items must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return items;
}

function readInstitutionMatrixCells(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedInstitutionMatrixCell[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        'Institution matrix cells must be an array',
        path,
      ),
    );
    return [];
  }

  const cells = value.filter(isInstitutionMatrixCell);
  if (cells.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        'Institution matrix cells must have ids, rowId, columnId and bounded options',
        path,
      ),
    );
  }

  return cells;
}

function readInstitutionMatrixValues(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedInstitutionMatrixValue[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        'Institution matrix correction must be an array',
        path,
      ),
    );
    return [];
  }

  const values = value.filter(isInstitutionMatrixValue);
  if (values.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        'Institution matrix correction values must have cellId and optionId',
        path,
      ),
    );
  }

  return values;
}

function readDiagram(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedDiagram | null {
  if (!isDiagram(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_DIAGRAM_INVALID',
        'Diagram labeling diagram must be a bounded semantic object',
        path,
      ),
    );
    return null;
  }

  return value;
}

function readDiagramLabelingSlots(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedDiagramLabelingSlot[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        'Diagram labeling slots must be an array',
        path,
      ),
    );
    return [];
  }

  const slots = value.filter(isDiagramLabelingSlot);
  if (slots.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        'Diagram labeling slots must have ids, anchors, prompts and bounded options',
        path,
      ),
    );
  }

  return slots;
}

function readDiagramLabelingValues(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedDiagramLabelingValue[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        'Diagram labeling correction must be an array',
        path,
      ),
    );
    return [];
  }

  const values = value.filter(isDiagramLabelingValue);
  if (values.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        'Diagram labeling correction values must have slotId and optionId',
        path,
      ),
    );
  }

  return values;
}

function readCalculationChoices(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCalculationChoice[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_CHOICES ||
    value.length > MAX_CHOICES
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
        'Calculation MCQ choices must contain between two and six items',
        path,
      ),
    );
    return [];
  }

  const choices = value.filter(isCalculationChoice);
  if (
    choices.length !== value.length ||
    hasDuplicates(choices.map((choice) => choice.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
        'Calculation MCQ choices must have unique non-empty ids, labels and integer values',
        path,
      ),
    );
  }

  return choices;
}

function readImageChoices(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedImageChoiceOption[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_CHOICES ||
    value.length > MAX_CHOICES
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice choices must contain between two and six items',
        path,
      ),
    );
    return [];
  }

  const choices = value.filter(isImageChoiceOption);
  if (choices.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice choices must have ids, labels, catalog asset ids and public alt text',
        path,
      ),
    );
  }

  return choices;
}

function readCalculationData(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCalculationData | null {
  if (!isRecord(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_INVALID',
        'Calculation MCQ calculation must be an object',
        path,
      ),
    );
    return null;
  }

  switch (value.mode) {
    case 'absolute_majority_threshold': {
      const validVotes = value.validVotes;
      if (
        typeof validVotes !== 'number' ||
        !Number.isInteger(validVotes) ||
        validVotes < 1 ||
        validVotes > MAX_CALCULATION_VOTES
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
            'Absolute majority calculation requires bounded positive integer valid votes',
            `${path}.validVotes`,
          ),
        );
        return null;
      }

      return {
        mode: 'absolute_majority_threshold',
        validVotes,
      };
    }
    case 'largest_remainder_target_party_seats': {
      const parties = readCalculationParties(
        value.parties,
        issues,
        `${path}.parties`,
      );
      const totalSeats = value.totalSeats;
      const targetPartyId = value.targetPartyId;
      const totalVotes = parties.reduce((sum, party) => sum + party.votes, 0);
      const validTotalSeats =
        typeof totalSeats === 'number' &&
        Number.isInteger(totalSeats) &&
        totalSeats >= 1 &&
        totalSeats <= MAX_CALCULATION_TOTAL_SEATS;
      const validTargetPartyId = plainString(targetPartyId);
      const validPartySet =
        parties.length >= MIN_CALCULATION_PARTIES &&
        parties.length <= MAX_CALCULATION_PARTIES &&
        !hasDuplicates(parties.map((party) => party.id)) &&
        parties.length ===
          (Array.isArray(value.parties) ? value.parties.length : -1);

      if (!validTotalSeats) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
            'Largest remainder calculation requires bounded positive integer total seats',
            `${path}.totalSeats`,
          ),
        );
      }

      if (!validTargetPartyId) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_TARGET_PARTY_INVALID',
            'Largest remainder calculation requires a target party id',
            `${path}.targetPartyId`,
          ),
        );
      }

      if (!validPartySet) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
            'Largest remainder calculation requires two to eight parties with unique ids',
            `${path}.parties`,
          ),
        );
      }

      if (totalVotes <= 0) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_TOTAL_VOTES_INVALID',
            'Largest remainder calculation requires at least one vote',
            `${path}.parties`,
          ),
        );
      }

      if (
        validTargetPartyId &&
        !parties.some((party) => party.id === targetPartyId)
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_TARGET_PARTY_INVALID',
            'Largest remainder target party must exist',
            `${path}.targetPartyId`,
          ),
        );
      }

      if (
        !validTotalSeats ||
        !validTargetPartyId ||
        !validPartySet ||
        totalVotes <= 0 ||
        !parties.some((party) => party.id === targetPartyId)
      ) {
        return null;
      }

      return {
        mode: 'largest_remainder_target_party_seats',
        totalSeats,
        targetPartyId,
        parties,
      };
    }
    default:
      issues.push(
        issue(
          'RICH_CLOSED_CALCULATION_MODE_INVALID',
          'Calculation MCQ mode is not supported',
          `${path}.mode`,
        ),
      );
      return null;
  }
}

function readCalculationParties(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCalculationParty[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
        'Largest remainder parties must be an array',
        path,
      ),
    );
    return [];
  }

  const parties = value.filter(isCalculationParty);
  if (parties.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
        'Largest remainder parties must have ids, labels and bounded integer votes',
        path,
      ),
    );
  }

  return parties;
}

function validateOptionalInstruction(
  instruction: unknown,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (
    instruction !== undefined &&
    instruction !== null &&
    !boundedString(instruction, 1, MAX_INSTRUCTION_LENGTH)
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTRUCTION_INVALID',
        'Optional instruction must be bounded when provided',
        'instruction',
      ),
    );
  }
}

function validateExplanation(
  explanation: unknown,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (!boundedString(explanation, 1, MAX_EXPLANATION_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_EXPLANATION_INVALID',
        'Private correction explanation is required and bounded',
        'explanation',
      ),
    );
  }
}

function isRichClosedQuestionKind(
  value: unknown,
): value is RichClosedQuestionKind {
  return (
    typeof value === 'string' &&
    RICH_CLOSED_QUESTION_KINDS.includes(value as RichClosedQuestionKind)
  );
}

function isRichClosedCognitiveSkill(
  value: unknown,
): value is (typeof RICH_CLOSED_COGNITIVE_SKILLS)[number] {
  return (
    typeof value === 'string' &&
    RICH_CLOSED_COGNITIVE_SKILLS.includes(
      value as (typeof RICH_CLOSED_COGNITIVE_SKILLS)[number],
    )
  );
}

function isChoice(value: unknown): value is RichClosedChoice {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isLabelItem(value: unknown): value is { id: string; label: string } {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isTimelineEvent(value: unknown): value is {
  id: string;
  label: string;
  description?: string | null;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_TIMELINE_EVENT_DESCRIPTION_LENGTH,
      ))
  );
}

function isTrueFalseRow(value: unknown): value is {
  id: string;
  statement: string;
  context?: string | null;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.statement, 1, MAX_STATEMENT_LENGTH) &&
    (value.context === undefined ||
      value.context === null ||
      boundedString(value.context, 1, MAX_STATEMENT_LENGTH))
  );
}

function isTrueFalseValue(value: unknown): value is RichClosedTrueFalseValue {
  return (
    isRecord(value) &&
    plainString(value.rowId) &&
    typeof value.value === 'boolean'
  );
}

function isDescribedLabelItem(value: unknown): value is {
  id: string;
  label: string;
  description?: string | null;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH,
      ))
  );
}

function isInstitutionMatrixOption(value: unknown): value is {
  id: string;
  label: string;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isInstitutionMatrixCell(
  value: unknown,
): value is RichClosedInstitutionMatrixCell {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    plainString(value.rowId) &&
    plainString(value.columnId) &&
    (value.prompt === undefined ||
      value.prompt === null ||
      boundedString(value.prompt, 1, MAX_INSTRUCTION_LENGTH)) &&
    Array.isArray(value.options) &&
    value.options.every(isInstitutionMatrixOption)
  );
}

function isInstitutionMatrixValue(
  value: unknown,
): value is RichClosedInstitutionMatrixValue {
  return (
    isRecord(value) && plainString(value.cellId) && plainString(value.optionId)
  );
}

function isDiagram(value: unknown): value is RichClosedDiagram {
  return (
    isRecord(value) &&
    (value.title === undefined ||
      value.title === null ||
      boundedString(value.title, 1, 180)) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH,
      )) &&
    isDiagramLayout(value.layout) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isDiagramNode) &&
    (value.groups === undefined ||
      (Array.isArray(value.groups) && value.groups.every(isDiagramGroup))) &&
    Array.isArray(value.edges) &&
    value.edges.every(isDiagramEdge)
  );
}

function isDiagramLayout(value: unknown): value is RichClosedDiagramLayout {
  return (
    typeof value === 'string' &&
    DIAGRAM_LAYOUTS.includes(value as RichClosedDiagramLayout)
  );
}

function isDiagramGroup(value: unknown): value is RichClosedDiagramGroup {
  return isDescribedLabelItem(value);
}

function isDiagramNode(value: unknown): value is RichClosedDiagramNode {
  if (!isRecord(value) || !isDescribedLabelItem(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.groupId === undefined ||
    record.groupId === null ||
    plainString(record.groupId)
  );
}

function isDiagramEdge(value: unknown): value is RichClosedDiagramEdge {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    plainString(value.fromNodeId) &&
    plainString(value.toNodeId) &&
    (value.label === undefined ||
      value.label === null ||
      boundedString(value.label, 1, 220)) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH,
      ))
  );
}

function isDiagramAnchorType(
  value: unknown,
): value is RichClosedDiagramAnchorType {
  return value === 'node' || value === 'edge';
}

function isDiagramLabelingOption(value: unknown): value is {
  id: string;
  label: string;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isDiagramLabelingSlot(
  value: unknown,
): value is RichClosedDiagramLabelingSlot {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    isDiagramAnchorType(value.anchorType) &&
    plainString(value.anchorId) &&
    boundedString(value.prompt, 1, MAX_INSTRUCTION_LENGTH) &&
    Array.isArray(value.options) &&
    value.options.every(isDiagramLabelingOption)
  );
}

function isDiagramLabelingValue(
  value: unknown,
): value is RichClosedDiagramLabelingValue {
  return (
    isRecord(value) && plainString(value.slotId) && plainString(value.optionId)
  );
}

function isCalculationChoice(
  value: unknown,
): value is RichClosedCalculationChoice {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    Number.isInteger(value.value)
  );
}

function isImageChoiceOption(
  value: unknown,
): value is RichClosedImageChoiceOption {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    plainString(value.imageAssetId) &&
    boundedString(value.altText, 1, 320) &&
    (value.caption === undefined ||
      value.caption === null ||
      boundedString(value.caption, 1, 220)) &&
    (value.creditLabel === undefined ||
      value.creditLabel === null ||
      boundedString(value.creditLabel, 1, 220)) &&
    (value.license === undefined ||
      value.license === 'public_domain' ||
      value.license === 'own_generated' ||
      value.license === 'open_license' ||
      value.license === 'internal_placeholder')
  );
}

function isCalculationParty(
  value: unknown,
): value is RichClosedCalculationParty {
  if (!isRecord(value)) {
    return false;
  }

  const votes = value.votes;

  return (
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    typeof votes === 'number' &&
    Number.isInteger(votes) &&
    votes >= 0 &&
    votes <= MAX_CALCULATION_VOTES
  );
}

function containsFreeAnswerField(value: Record<string, unknown>): boolean {
  // Closed questions may contain private corrections, but never text-answer
  // shaped fields. This keeps V1-A separate from the open_question activity.
  return ['answerText', 'freeTextAnswer', 'textAnswer', 'modelAnswer'].some(
    (key) => Object.prototype.hasOwnProperty.call(value, key),
  );
}

function containsForbiddenRenderField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenRenderField);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      FORBIDDEN_RICH_CLOSED_RENDER_KEYS.has(key) ||
      containsForbiddenRenderField(nestedValue),
  );
}

function choiceIds(choices: RichClosedChoice[]): Set<string> {
  return new Set(choices.map((choice) => choice.id));
}

function idSet(items: Array<{ id: string }>): Set<string> {
  return new Set(items.map((item) => item.id));
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readInteger(value: unknown): number | null {
  return Number.isInteger(value) ? (value as number) : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(plainString);
}

function toStringSet(
  value: readonly string[] | ReadonlySet<string> | undefined,
): ReadonlySet<string> | null {
  if (value === undefined) {
    return null;
  }

  return value instanceof Set ? value : new Set(value);
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function plainString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function boundedString(value: unknown, minLength: number, maxLength: number) {
  return (
    typeof value === 'string' &&
    value.trim().length >= minLength &&
    value.length <= maxLength
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: string,
  message: string,
  path?: string,
): RichClosedExerciseValidationIssue {
  return {
    code,
    message,
    ...(path === undefined ? {} : { path }),
    severity: 'error',
  };
}

function rejected(
  issues: RichClosedExerciseValidationIssue[],
): RichClosedExerciseValidationResult {
  return {
    accepted: false,
    issues,
  };
}
