import type {
  AiGenerationErrorCategory,
  AiGenerationObservation,
} from '../application/ai-generation-observer';

type AiErrorDiagnostics = Pick<
  AiGenerationObservation,
  | 'errorCategory'
  | 'errorName'
  | 'errorStatus'
  | 'errorProviderCode'
  | 'errorSummary'
>;

const MAX_SAFE_ERROR_TOKEN_LENGTH = 80;

export function buildAiErrorDiagnostics(error: unknown): AiErrorDiagnostics {
  const errorStatus = findNumericProperty(error, [
    'status',
    'statusCode',
    'httpStatus',
  ]);
  const errorProviderCode = findSafeStringProperty(error, [
    'code',
    'errorCode',
    'type',
  ]);
  const messageForClassification = collectMessages(error).join(' ');
  const errorCategory = classifyAiError({
    status: errorStatus,
    providerCode: errorProviderCode,
    message: messageForClassification,
  });

  return {
    errorCategory,
    errorName: resolveErrorName(error),
    ...(errorStatus === undefined ? {} : { errorStatus }),
    ...(errorProviderCode === undefined ? {} : { errorProviderCode }),
    errorSummary: summarizeAiError(errorCategory),
  };
}

function classifyAiError(input: {
  status?: number;
  providerCode?: string;
  message: string;
}): AiGenerationErrorCategory {
  const providerCode = input.providerCode?.toLowerCase() ?? '';
  const message = input.message.toLowerCase();

  if (input.status === 401 || input.status === 403) {
    return 'AUTHENTICATION';
  }

  if (input.status === 429 || /rate|quota|too many/.test(providerCode)) {
    return 'RATE_LIMIT';
  }

  if (
    input.status === 408 ||
    input.status === 504 ||
    /timeout|timedout|deadline|aborted/.test(`${providerCode} ${message}`)
  ) {
    return 'TIMEOUT';
  }

  if (/network|fetch failed|econnreset|enotfound|eai_again/.test(message)) {
    return 'NETWORK';
  }

  if (/schema|zod|json|parse|validat|invalid output|output/.test(message)) {
    return 'SCHEMA_VALIDATION';
  }

  if (input.status === 400) {
    return 'BAD_REQUEST';
  }

  if (typeof input.status === 'number' && input.status >= 500) {
    return 'PROVIDER_SERVER_ERROR';
  }

  if (/api[_ -]?key|required|missing|configuration|config/.test(message)) {
    return 'CONFIGURATION';
  }

  return 'UNKNOWN';
}

function summarizeAiError(category: AiGenerationErrorCategory): string {
  switch (category) {
    case 'AUTHENTICATION':
      return 'AI provider authentication or authorization failed';
    case 'RATE_LIMIT':
      return 'AI provider rate limit or quota rejection';
    case 'TIMEOUT':
      return 'AI provider request timed out';
    case 'NETWORK':
      return 'AI provider network request failed';
    case 'BAD_REQUEST':
      return 'AI provider rejected the request';
    case 'SCHEMA_VALIDATION':
      return 'AI provider output failed schema validation';
    case 'PROVIDER_SERVER_ERROR':
      return 'AI provider returned a server error';
    case 'CONFIGURATION':
      return 'AI provider configuration is invalid or incomplete';
    case 'UNKNOWN':
      return 'AI provider generation failed';
  }
}

function resolveErrorName(error: unknown): string | undefined {
  if (error instanceof Error && isSafeToken(error.name)) {
    return error.name;
  }

  if (isRecord(error)) {
    const name = readUnknownProperty(error, 'name');
    if (typeof name === 'string' && isSafeToken(name)) {
      return name;
    }

    const constructorName = error.constructor?.name;
    if (isSafeToken(constructorName)) {
      return constructorName;
    }
  }

  return undefined;
}

function findNumericProperty(
  error: unknown,
  propertyNames: string[],
): number | undefined {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current) || seen.has(current)) {
      continue;
    }
    seen.add(current);

    for (const propertyName of propertyNames) {
      const value = readUnknownProperty(current, propertyName);
      if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
      }
    }

    queueNestedErrors(current, queue);
  }

  return undefined;
}

function findSafeStringProperty(
  error: unknown,
  propertyNames: string[],
): string | undefined {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current) || seen.has(current)) {
      continue;
    }
    seen.add(current);

    for (const propertyName of propertyNames) {
      const value = readUnknownProperty(current, propertyName);
      if (typeof value === 'string' && isSafeToken(value)) {
        return value;
      }
    }

    queueNestedErrors(current, queue);
  }

  return undefined;
}

function collectMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0 && messages.length < 4) {
    const current = queue.shift();
    if (!isRecord(current) || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const message = readUnknownProperty(current, 'message');
    if (typeof message === 'string') {
      messages.push(message);
    }

    queueNestedErrors(current, queue);
  }

  return messages;
}

function queueNestedErrors(current: Record<string, unknown>, queue: unknown[]) {
  const cause = readUnknownProperty(current, 'cause');
  const response = readUnknownProperty(current, 'response');
  const error = readUnknownProperty(current, 'error');
  const data = isRecord(response)
    ? readUnknownProperty(response, 'data')
    : undefined;

  queue.push(cause, response, error, data);
}

function readUnknownProperty(
  object: Record<string, unknown>,
  propertyName: string,
): unknown {
  return object[propertyName];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafeToken(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SAFE_ERROR_TOKEN_LENGTH &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}
