import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';
import type { RichClosedComplexityProfile } from './rich-closed-question-generator';

export const RICH_CLOSED_QUESTION_COUNT_INVALID =
  'RICH_CLOSED_QUESTION_COUNT_INVALID';

const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;
const MAX_SINGLE_CHOICE_RATIO = 0.4;

const SMALL_EXERCISE_KIND_ORDER: RichClosedQuestionKind[] = [
  'case_qualification',
  'error_detection',
  'matching',
  'ordering',
  'multiple_choice',
];

const FULL_EXERCISE_BASE_MIX: Record<RichClosedQuestionKind, number> = {
  single_choice: 1,
  multiple_choice: 1,
  matching: 1,
  ordering: 1,
  case_qualification: 1,
  error_detection: 1,
};

const DISTRIBUTION_ORDER_BY_PROFILE: Record<
  RichClosedComplexityProfile,
  RichClosedQuestionKind[]
> = {
  standard: [
    'case_qualification',
    'error_detection',
    'matching',
    'multiple_choice',
    'ordering',
    'single_choice',
  ],
  exam: [
    'case_qualification',
    'error_detection',
    'matching',
    'multiple_choice',
    'ordering',
    'single_choice',
  ],
  advanced: [
    'case_qualification',
    'error_detection',
    'ordering',
    'matching',
    'multiple_choice',
    'single_choice',
  ],
};

export interface RichClosedQuestionTypeMixInput {
  questionCount: number;
  complexityProfile?: RichClosedComplexityProfile;
}

export function resolveRichClosedQuestionTypeMix(
  input: RichClosedQuestionTypeMixInput,
): Record<RichClosedQuestionKind, number> {
  if (
    !Number.isInteger(input.questionCount) ||
    input.questionCount < MIN_QUESTION_COUNT ||
    input.questionCount > MAX_QUESTION_COUNT
  ) {
    throw new Error(RICH_CLOSED_QUESTION_COUNT_INVALID);
  }

  if (input.questionCount < RICH_CLOSED_QUESTION_KINDS.length) {
    return buildSmallExerciseMix(input.questionCount);
  }

  const mix = { ...FULL_EXERCISE_BASE_MIX };
  const profile = input.complexityProfile ?? 'standard';
  let remaining = input.questionCount - RICH_CLOSED_QUESTION_KINDS.length;
  let cursor = 0;

  while (remaining > 0) {
    const kind = DISTRIBUTION_ORDER_BY_PROFILE[profile][cursor];
    if (
      kind !== 'single_choice' ||
      (mix.single_choice + 1) / input.questionCount <= MAX_SINGLE_CHOICE_RATIO
    ) {
      mix[kind] += 1;
      remaining -= 1;
    }
    cursor = (cursor + 1) % DISTRIBUTION_ORDER_BY_PROFILE[profile].length;
  }

  return mix;
}

function buildSmallExerciseMix(
  questionCount: number,
): Record<RichClosedQuestionKind, number> {
  const mix = emptyMix();

  for (let index = 0; index < questionCount; index += 1) {
    mix[SMALL_EXERCISE_KIND_ORDER[index]] += 1;
  }

  return mix;
}

function emptyMix(): Record<RichClosedQuestionKind, number> {
  return {
    single_choice: 0,
    multiple_choice: 0,
    matching: 0,
    ordering: 0,
    case_qualification: 0,
    error_detection: 0,
  };
}
