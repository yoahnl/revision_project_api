import openAICompatible from '@genkit-ai/compat-oai';

export const MISTRAL_PROVIDER = 'mistral';
export const MIMO_PROVIDER = 'mimo';

const DEFAULT_MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-medium-latest';
const DEFAULT_MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1';
const DEFAULT_MIMO_MODEL = 'mimo-v2.5';

export type OpenAiCompatibleProviderName =
  | typeof MISTRAL_PROVIDER
  | typeof MIMO_PROVIDER;

export type ResolvedOpenAiCompatibleProvider = {
  provider: OpenAiCompatibleProviderName;
  pluginName: OpenAiCompatibleProviderName;
  apiKey: string | null;
  apiKeyEnv: string;
  baseURL: string;
  model: string;
};

type ProviderDefinition = {
  provider: OpenAiCompatibleProviderName;
  apiKeyEnv: string;
  modelEnv: string;
  baseUrlEnv: string;
  defaultModel: string;
  defaultBaseURL: string;
};

const providerDefinitions: Record<
  OpenAiCompatibleProviderName,
  ProviderDefinition
> = {
  [MISTRAL_PROVIDER]: {
    provider: MISTRAL_PROVIDER,
    apiKeyEnv: 'MISTRAL_API_KEY',
    modelEnv: 'MISTRAL_MODEL',
    baseUrlEnv: 'MISTRAL_BASE_URL',
    defaultModel: DEFAULT_MISTRAL_MODEL,
    defaultBaseURL: DEFAULT_MISTRAL_BASE_URL,
  },
  [MIMO_PROVIDER]: {
    provider: MIMO_PROVIDER,
    apiKeyEnv: 'MIMO_API_KEY',
    modelEnv: 'MIMO_MODEL',
    baseUrlEnv: 'MIMO_BASE_URL',
    defaultModel: DEFAULT_MIMO_MODEL,
    defaultBaseURL: DEFAULT_MIMO_BASE_URL,
  },
};

export function isOpenAiCompatibleProvider(
  provider: string | undefined,
): provider is OpenAiCompatibleProviderName {
  return provider === MISTRAL_PROVIDER || provider === MIMO_PROVIDER;
}

export function hasOpenAiCompatibleApiKey(
  provider: OpenAiCompatibleProviderName,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const definition = providerDefinitions[provider];
  return hasValue(env[definition.apiKeyEnv]);
}

export function resolveOpenAiCompatibleProvider(
  provider: OpenAiCompatibleProviderName,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedOpenAiCompatibleProvider {
  const definition = providerDefinitions[provider];
  const apiKey = env[definition.apiKeyEnv]?.trim() || null;
  const configuredModel = env[definition.modelEnv]?.trim();
  const configuredBaseURL = env[definition.baseUrlEnv]?.trim();

  return {
    provider: definition.provider,
    pluginName: definition.provider,
    apiKey,
    apiKeyEnv: definition.apiKeyEnv,
    baseURL: configuredBaseURL || definition.defaultBaseURL,
    model: normalizeOpenAiCompatibleModelName(
      definition.provider,
      configuredModel || definition.defaultModel,
    ),
  };
}

export function createOpenAiCompatiblePlugin(
  provider: ResolvedOpenAiCompatibleProvider,
): ReturnType<typeof openAICompatible> {
  if (!provider.apiKey) {
    throw new Error(`${provider.apiKeyEnv} is required`);
  }

  return openAICompatible({
    name: provider.pluginName,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });
}

export function normalizeOpenAiCompatibleModelName(
  provider: OpenAiCompatibleProviderName,
  model: string,
): string {
  const trimmedModel = model.trim();

  if (trimmedModel.startsWith(`${provider}/`)) {
    return trimmedModel;
  }

  return `${provider}/${trimmedModel}`;
}

export function resolveMistralModelName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER, env).model;
}

export function normalizeMistralModelName(model: string): string {
  return normalizeOpenAiCompatibleModelName(MISTRAL_PROVIDER, model);
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
