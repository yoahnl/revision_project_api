export type AiProviderKey = 'gemini' | 'mistral' | 'mimo';

export type AiProviderCapabilities = {
  supportsNativeStructuredOutput: boolean;
  supportsJsonMode: boolean;
  supportsStructuredStreaming: boolean;
  supportsPdfInput: boolean;
  supportsThinking: boolean;
  maxReliableInputTokens: number;
  defaultStructuredTemperature: number;
  requiresExplicitJsonPrompt: boolean;
  shouldDisableStreamingForStructuredOutput: boolean;
};

export const aiProviderCapabilities = {
  gemini: {
    supportsNativeStructuredOutput: true,
    supportsJsonMode: true,
    supportsStructuredStreaming: true,
    supportsPdfInput: true,
    supportsThinking: false,
    maxReliableInputTokens: 100000,
    defaultStructuredTemperature: 0,
    requiresExplicitJsonPrompt: false,
    shouldDisableStreamingForStructuredOutput: false,
  },
  mistral: {
    supportsNativeStructuredOutput: true,
    supportsJsonMode: true,
    supportsStructuredStreaming: false,
    supportsPdfInput: false,
    supportsThinking: false,
    maxReliableInputTokens: 16000,
    defaultStructuredTemperature: 0,
    requiresExplicitJsonPrompt: true,
    shouldDisableStreamingForStructuredOutput: true,
  },
  mimo: {
    supportsNativeStructuredOutput: false,
    supportsJsonMode: true,
    supportsStructuredStreaming: false,
    supportsPdfInput: false,
    supportsThinking: true,
    maxReliableInputTokens: 12000,
    defaultStructuredTemperature: 1,
    requiresExplicitJsonPrompt: true,
    shouldDisableStreamingForStructuredOutput: true,
  },
} as const satisfies Record<AiProviderKey, AiProviderCapabilities>;

export type StructuredOutputMode =
  | 'native_schema'
  | 'json_mode'
  | 'prompt_json';

export type StructuredGenerationPolicy = {
  stream: boolean;
  temperature: number;
  topP?: number;
  maxCompletionTokens?: number;
  responseFormat?: { type: 'json_object' };
  thinking?: { type: 'disabled' };
  thinkingDisabled: boolean;
  structuredOutputMode: StructuredOutputMode;
  requiresJsonInstruction: boolean;
  allowRepairAttempt: boolean;
  allowFallback: boolean;
};

export function resolveStructuredGenerationPolicy(input: {
  provider: string;
  structuredOutput: boolean;
}): StructuredGenerationPolicy {
  const providerKey = resolveAiProviderKey(input.provider);
  const capabilities = aiProviderCapabilities[providerKey];
  const structuredOutputMode = resolveStructuredOutputMode({
    providerKey,
    structuredOutput: input.structuredOutput,
  });
  const stream =
    input.structuredOutput &&
    capabilities.shouldDisableStreamingForStructuredOutput
      ? false
      : false;
  const policy: StructuredGenerationPolicy = {
    stream,
    temperature: capabilities.defaultStructuredTemperature,
    structuredOutputMode,
    requiresJsonInstruction:
      input.structuredOutput && capabilities.requiresExplicitJsonPrompt,
    thinkingDisabled: false,
    allowRepairAttempt: input.structuredOutput,
    allowFallback: input.structuredOutput,
  };

  if (
    input.structuredOutput &&
    capabilities.supportsJsonMode &&
    structuredOutputMode === 'json_mode'
  ) {
    policy.responseFormat = { type: 'json_object' };
  }

  if (providerKey === 'mimo' && input.structuredOutput) {
    policy.topP = 0.95;
    policy.maxCompletionTokens = 4096;
    policy.thinking = { type: 'disabled' };
    policy.thinkingDisabled = true;
  }

  return policy;
}

export function buildStructuredGenerationConfig(
  policy: StructuredGenerationPolicy,
): Record<string, unknown> {
  return removeUndefinedProperties({
    temperature: policy.temperature,
    topP: policy.topP,
    max_completion_tokens: policy.maxCompletionTokens,
    response_format: policy.responseFormat,
    thinking: policy.thinking,
    stream: policy.stream,
  });
}

export function buildExplicitJsonInstruction(input: {
  prompt: string;
  requiresJsonInstruction: boolean;
}): string {
  if (!input.requiresJsonInstruction) {
    return input.prompt;
  }

  return [
    'Tu dois répondre uniquement avec un objet JSON valide.',
    'Aucun Markdown.',
    'Aucun texte avant ou après le JSON.',
    'Le JSON doit respecter exactement le schéma demandé.',
    input.prompt,
  ].join('\n\n');
}

export function resolveAiProviderKey(provider: string): AiProviderKey {
  const normalized = provider.trim().toLowerCase();

  if (normalized === 'mistral') {
    return 'mistral';
  }

  if (normalized === 'mimo') {
    return 'mimo';
  }

  return 'gemini';
}

function resolveStructuredOutputMode(input: {
  providerKey: AiProviderKey;
  structuredOutput: boolean;
}): StructuredOutputMode {
  if (!input.structuredOutput) {
    return 'prompt_json';
  }

  if (input.providerKey === 'gemini') {
    return 'native_schema';
  }

  const capabilities = aiProviderCapabilities[input.providerKey];
  return capabilities.supportsJsonMode ? 'json_mode' : 'prompt_json';
}

function removeUndefinedProperties<T extends Record<string, unknown>>(
  value: T,
): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as T;
}
