import { toRichClosedPublicExercise } from './rich-closed-question-public.mapper';
import {
  validateRichClosedExercise,
  type RichClosedQuestionValidationOptions,
} from './rich-closed-question.validator';
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedCognitiveSkill,
  type RichClosedDifficulty,
  type RichClosedExercise,
  type RichClosedExerciseValidationIssue,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';

export interface RichClosedQuestionQualityGateOptions extends RichClosedQuestionValidationOptions {
  publicExercise?: unknown;
}

export interface RichClosedQuestionQualityGateMetrics {
  questionCount: number;
  questionKindCounts: Record<RichClosedQuestionKind, number>;
  distinctQuestionKindCount: number;
  advancedQuestionCount: number;
  basicQuestionCount: number;
  sourcedQuestionCount: number;
  cognitiveSkillCounts: Partial<Record<RichClosedCognitiveSkill, number>>;
  difficultyCounts: Partial<Record<RichClosedDifficulty, number>>;
  qualityGateStatus: 'accepted' | 'rejected';
}

export interface RichClosedQuestionQualityGateResult {
  accepted: boolean;
  issues: RichClosedExerciseValidationIssue[];
  warnings: RichClosedExerciseValidationIssue[];
  metrics: RichClosedQuestionQualityGateMetrics;
}

const MIN_FULL_GATE_QUESTION_COUNT = 6;
const MIN_DISTINCT_KINDS_FOR_FULL_GATE = 3;
const MAX_SINGLE_CHOICE_RATIO = 0.4;
const MIN_SOURCED_RATIO = 0.8;
const MAX_BASIC_PROMPT_RATIO = 0.4;

export function evaluateRichClosedExerciseQuality(
  exercise: RichClosedExercise,
  options: RichClosedQuestionQualityGateOptions = {},
): RichClosedQuestionQualityGateResult {
  const issues: RichClosedExerciseValidationIssue[] = [
    ...validateRichClosedExercise(exercise, options).issues,
  ];
  const warnings: RichClosedExerciseValidationIssue[] = [];
  const metrics = buildMetrics(exercise);

  if (options.publicExercise !== undefined) {
    const publicLeakIssues = validatePublicPayloadHasNoCorrection(
      options.publicExercise,
    );
    issues.push(...publicLeakIssues);
  } else {
    const mappedPublicPayload = toRichClosedPublicExercise(exercise);
    issues.push(...validatePublicPayloadHasNoCorrection(mappedPublicPayload));
  }

  if (metrics.questionCount < MIN_FULL_GATE_QUESTION_COUNT) {
    warnings.push(
      warning(
        'RICH_CLOSED_GATE_SMALL_EXERCISE_RELAXED_RULES',
        'Diversity gates are relaxed below six questions',
      ),
    );
  } else {
    applyFullExerciseGates(metrics, issues);
  }

  applySourceGates(metrics, issues, options);
  applyBasicPromptGate(metrics, issues);

  metrics.qualityGateStatus = issues.length === 0 ? 'accepted' : 'rejected';

  return {
    accepted: issues.length === 0,
    issues,
    warnings,
    metrics,
  };
}

function applyFullExerciseGates(
  metrics: RichClosedQuestionQualityGateMetrics,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (metrics.distinctQuestionKindCount < MIN_DISTINCT_KINDS_FOR_FULL_GATE) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_NOT_ENOUGH_KIND_DIVERSITY',
        'A full rich closed exercise must contain at least three question kinds',
      ),
    );
  }

  if (
    metrics.questionKindCounts.single_choice / metrics.questionCount >
    MAX_SINGLE_CHOICE_RATIO
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        'A full rich closed exercise cannot be dominated by single choice questions',
      ),
    );
  }

  if (metrics.questionKindCounts.case_qualification === 0) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_CASE_QUALIFICATION_REQUIRED',
        'A full rich closed exercise must contain a case qualification question',
      ),
    );
  }

  if (metrics.questionKindCounts.error_detection === 0) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_ERROR_DETECTION_REQUIRED',
        'A full rich closed exercise must contain an error detection question',
      ),
    );
  }

  if (
    metrics.questionKindCounts.matching === 0 &&
    metrics.questionKindCounts.ordering === 0
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_STRUCTURED_INTERACTION_REQUIRED',
        'A full rich closed exercise must contain matching or ordering',
      ),
    );
  }
}

function applySourceGates(
  metrics: RichClosedQuestionQualityGateMetrics,
  issues: RichClosedExerciseValidationIssue[],
  options: RichClosedQuestionQualityGateOptions,
) {
  if (
    options.knownSourceChunkIds === undefined ||
    metrics.questionCount === 0
  ) {
    return;
  }

  if (
    metrics.sourcedQuestionCount / metrics.questionCount <
    MIN_SOURCED_RATIO
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_NOT_ENOUGH_SOURCED_QUESTIONS',
        'At least 80% of rich closed questions must be sourced when source context is known',
      ),
    );
  }
}

function applyBasicPromptGate(
  metrics: RichClosedQuestionQualityGateMetrics,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (metrics.questionCount === 0) {
    return;
  }

  if (
    metrics.basicQuestionCount / metrics.questionCount >
    MAX_BASIC_PROMPT_RATIO
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_TOO_MANY_BASIC_QUESTIONS',
        'The exercise contains too many likely restitution prompts',
      ),
    );
  }
}

function buildMetrics(
  exercise: RichClosedExercise,
): RichClosedQuestionQualityGateMetrics {
  const questionKindCounts = emptyQuestionKindCounts();
  const cognitiveSkillCounts: Partial<
    Record<RichClosedCognitiveSkill, number>
  > = {};
  const difficultyCounts: Partial<Record<RichClosedDifficulty, number>> = {};
  let sourcedQuestionCount = 0;
  let basicQuestionCount = 0;

  for (const question of exercise.questions) {
    questionKindCounts[question.questionKind] += 1;
    cognitiveSkillCounts[question.cognitiveSkill] =
      (cognitiveSkillCounts[question.cognitiveSkill] ?? 0) + 1;
    difficultyCounts[question.difficulty] =
      (difficultyCounts[question.difficulty] ?? 0) + 1;

    if (question.sourceChunkIds.length > 0) {
      sourcedQuestionCount += 1;
    }

    if (isLikelyBasicPrompt(question.prompt)) {
      basicQuestionCount += 1;
    }
  }

  return {
    questionCount: exercise.questions.length,
    questionKindCounts,
    distinctQuestionKindCount: Object.values(questionKindCounts).filter(
      (count) => count > 0,
    ).length,
    advancedQuestionCount: exercise.questions.length - basicQuestionCount,
    basicQuestionCount,
    sourcedQuestionCount,
    cognitiveSkillCounts,
    difficultyCounts,
    qualityGateStatus: 'rejected',
  };
}

function emptyQuestionKindCounts(): Record<RichClosedQuestionKind, number> {
  return Object.fromEntries(
    RICH_CLOSED_QUESTION_KINDS.map((kind) => [kind, 0]),
  ) as Record<RichClosedQuestionKind, number>;
}

function isLikelyBasicPrompt(prompt: string): boolean {
  const normalized = normalizePromptForHeuristic(prompt);

  return (
    normalized.startsWith('qui ') ||
    normalized.startsWith('quand ') ||
    normalized.startsWith('quelle date') ||
    normalized.startsWith('quelle est la definition') ||
    normalized.startsWith('quel terme designe')
  );
}

function normalizePromptForHeuristic(prompt: string): string {
  return prompt
    .trim()
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ');
}

function validatePublicPayloadHasNoCorrection(
  value: unknown,
): RichClosedExerciseValidationIssue[] {
  const leakingPaths = privateFieldPaths(value);

  return leakingPaths.map((path) =>
    error(
      'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
      'Public pre-submit payload contains private correction data',
      path,
    ),
  );
}

function privateFieldPaths(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      privateFieldPaths(item, `${path}.${index}`),
    );
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const paths: string[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (isPrivatePublicPayloadKey(key)) {
      paths.push(nestedPath);
      continue;
    }

    paths.push(...privateFieldPaths(nestedValue, nestedPath));
  }

  return paths;
}

function isPrivatePublicPayloadKey(key: string): boolean {
  return (
    key.startsWith('correct') ||
    key === 'correction' ||
    key === 'correctionPayload' ||
    key === 'explanation' ||
    key === 'feedback' ||
    key === 'choiceFeedback' ||
    key === 'modelAnswer' ||
    key === 'answerText' ||
    key === 'freeTextAnswer' ||
    key === 'textAnswer' ||
    key === 'score' ||
    key === 'partialScore' ||
    key === 'workedSteps' ||
    key === 'answersPayload' ||
    key === 'expectedAnswer' ||
    key === 'expectedAnswers'
  );
}

function error(
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

function warning(
  code: string,
  message: string,
): RichClosedExerciseValidationIssue {
  return {
    code,
    message,
    severity: 'warning',
  };
}
