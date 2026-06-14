export const DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID =
  'DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID';

export const DEFAULT_DIAGNOSTIC_QUIZ_QUESTION_COUNT = 10;
export const DEFAULT_DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT = 20;

type DiagnosticQuizQuestionCountEnv = {
  DIAGNOSTIC_QUIZ_DEFAULT_QUESTION_COUNT?: string;
  DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT?: string;
};

export function resolveDiagnosticQuizMaxQuestionCount(
  env: DiagnosticQuizQuestionCountEnv = process.env,
): number {
  return Math.min(
    parsePositiveInteger(env.DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT) ??
      DEFAULT_DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT,
    DEFAULT_DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT,
  );
}

export function resolveDiagnosticQuizDefaultQuestionCount(
  env: DiagnosticQuizQuestionCountEnv = process.env,
): number {
  const maxQuestionCount = resolveDiagnosticQuizMaxQuestionCount(env);
  const configuredDefault = parsePositiveInteger(
    env.DIAGNOSTIC_QUIZ_DEFAULT_QUESTION_COUNT,
  );

  if (
    configuredDefault !== null &&
    configuredDefault >= 1 &&
    configuredDefault <= maxQuestionCount
  ) {
    return configuredDefault;
  }

  return Math.min(DEFAULT_DIAGNOSTIC_QUIZ_QUESTION_COUNT, maxQuestionCount);
}

export function resolveDiagnosticQuizQuestionCount(
  questionCount: number | undefined,
  env: DiagnosticQuizQuestionCountEnv = process.env,
): number {
  const resolvedQuestionCount =
    questionCount ?? resolveDiagnosticQuizDefaultQuestionCount(env);
  const maxQuestionCount = resolveDiagnosticQuizMaxQuestionCount(env);

  if (
    !Number.isInteger(resolvedQuestionCount) ||
    resolvedQuestionCount < 1 ||
    resolvedQuestionCount > maxQuestionCount
  ) {
    throw new Error(DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID);
  }

  return resolvedQuestionCount;
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}
