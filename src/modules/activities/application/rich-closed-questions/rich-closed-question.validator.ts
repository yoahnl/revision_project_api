import {
  RICH_CLOSED_EXERCISE_VERSION,
  RICH_CLOSED_COGNITIVE_SKILLS,
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedChoice,
  type RichClosedExerciseValidationIssue,
  type RichClosedExerciseValidationResult,
  type RichClosedPair,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';

const MAX_PROMPT_LENGTH = 700;
const MAX_CASE_TEXT_LENGTH = 900;
const MAX_STATEMENT_LENGTH = 900;
const MAX_EXPLANATION_LENGTH = 1200;
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;
const MIN_STRUCTURED_ITEMS = 3;

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

  const questionKind = question.questionKind;
  if (!isRichClosedQuestionKind(questionKind)) {
    issues.push(
      issue(
        'RICH_CLOSED_KIND_UNSUPPORTED',
        'Question kind is not part of V1-A',
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
        'Question cognitive skill is not part of the V1-A allowlist',
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

function readPairs(value: unknown): RichClosedPair[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (pair): pair is RichClosedPair =>
      isRecord(pair) && plainString(pair.leftId) && plainString(pair.rightId),
  );
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

function containsFreeAnswerField(value: Record<string, unknown>): boolean {
  // Closed questions may contain private corrections, but never text-answer
  // shaped fields. This keeps V1-A separate from the open_question activity.
  return ['answerText', 'freeTextAnswer', 'textAnswer', 'modelAnswer'].some(
    (key) => Object.prototype.hasOwnProperty.call(value, key),
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
