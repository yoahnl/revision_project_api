const MISTRAL_PLUGIN_NAME = 'mistral';

export function normalizeMistralModelName(model: string): string {
  const trimmedModel = model.trim();

  if (trimmedModel.startsWith(`${MISTRAL_PLUGIN_NAME}/`)) {
    return trimmedModel;
  }

  return `${MISTRAL_PLUGIN_NAME}/${trimmedModel}`;
}

export function resolveMistralFallbackModel(input: {
  primaryModel: string;
  specificFallbackEnv: string;
}): string | null {
  const configuredFallback =
    process.env[input.specificFallbackEnv]?.trim() ||
    process.env.MISTRAL_FALLBACK_MODEL?.trim();

  if (!configuredFallback) {
    return null;
  }

  const fallbackModel = normalizeMistralModelName(configuredFallback);

  if (fallbackModel === input.primaryModel) {
    return null;
  }

  return fallbackModel;
}

export function isInvalidAiOutputError(
  error: unknown,
  sourceInvalidErrorCodes: readonly string[],
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (sourceInvalidErrorCodes.includes(error.message)) {
    return true;
  }

  if (error.name === 'ZodError') {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();

  return (
    normalizedMessage.includes('schema') ||
    normalizedMessage.includes('json') ||
    normalizedMessage.includes('output')
  );
}
