import type { RichClosedQuestionKind } from './rich-closed-question.types';
import type { RichClosedComplexityProfile } from './rich-closed-question-generator';

export const RICH_CLOSED_QUESTION_COUNT_INVALID =
  'RICH_CLOSED_QUESTION_COUNT_INVALID';

const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;
const MAX_SINGLE_CHOICE_RATIO = 0.4;
const V1A_FULL_EXERCISE_COUNT = 6;
const V1B_017_FULL_EXERCISE_COUNT = 8;
const V1B_018_FULL_EXERCISE_COUNT = 10;
const V1C_019_FULL_EXERCISE_COUNT = 11;

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
  timeline: 0,
  date_slider: 0,
  true_false_grid: 0,
  cause_consequence: 0,
  institution_matrix: 0,
};

const FULL_EXERCISE_V1B_BASE_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_BASE_MIX,
  timeline: 1,
  date_slider: 1,
};

const FULL_EXERCISE_V1B_FULL_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_V1B_BASE_MIX,
  true_false_grid: 1,
  cause_consequence: 1,
};

const FULL_EXERCISE_V1C_FULL_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_V1B_FULL_MIX,
  institution_matrix: 1,
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
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'single_choice',
  ],
  exam: [
    'case_qualification',
    'error_detection',
    'matching',
    'multiple_choice',
    'ordering',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'single_choice',
  ],
  advanced: [
    'case_qualification',
    'error_detection',
    'ordering',
    'matching',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
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

  if (input.questionCount < V1A_FULL_EXERCISE_COUNT) {
    return buildSmallExerciseMix(input.questionCount);
  }

  const usesV1C019Base = input.questionCount >= V1C_019_FULL_EXERCISE_COUNT;
  const usesV1B018Base =
    !usesV1C019Base && input.questionCount >= V1B_018_FULL_EXERCISE_COUNT;
  const usesV1B017Base =
    !usesV1C019Base &&
    !usesV1B018Base &&
    input.questionCount >= V1B_017_FULL_EXERCISE_COUNT;
  const mix = usesV1C019Base
    ? { ...FULL_EXERCISE_V1C_FULL_MIX }
    : usesV1B018Base
      ? { ...FULL_EXERCISE_V1B_FULL_MIX }
      : usesV1B017Base
        ? { ...FULL_EXERCISE_V1B_BASE_MIX }
        : { ...FULL_EXERCISE_BASE_MIX };
  const profile = input.complexityProfile ?? 'standard';
  let remaining =
    input.questionCount -
    (usesV1C019Base
      ? V1C_019_FULL_EXERCISE_COUNT
      : usesV1B018Base
        ? V1B_018_FULL_EXERCISE_COUNT
        : usesV1B017Base
          ? V1B_017_FULL_EXERCISE_COUNT
          : V1A_FULL_EXERCISE_COUNT);
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
    timeline: 0,
    date_slider: 0,
    true_false_grid: 0,
    cause_consequence: 0,
    institution_matrix: 0,
  };
}
