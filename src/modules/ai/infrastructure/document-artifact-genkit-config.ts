import openAICompatible from '@genkit-ai/compat-oai';
import { googleAI } from '@genkit-ai/google-genai';
import type { genkit } from 'genkit';

const MISTRAL_PLUGIN_NAME = 'mistral';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
export const GOOGLE_PROVIDER = 'google-genai';
export const MISTRAL_PROVIDER = 'mistral';

type ResolvedArtifactGenkitMetadata = {
  provider: string;
  model: string;
  useMistral: boolean;
};

type ResolvedArtifactGenkitConfig = {
  config: Parameters<typeof genkit>[0];
  provider: string;
  model: string;
};

export function resolveArtifactGenkitMetadata(): ResolvedArtifactGenkitMetadata {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (
    provider === 'mistral' ||
    (!hasValue(process.env.GOOGLE_GENAI_API_KEY) &&
      hasValue(process.env.MISTRAL_API_KEY))
  ) {
    return {
      provider: MISTRAL_PROVIDER,
      model: resolveMistralModel(),
      useMistral: true,
    };
  }

  return {
    provider: GOOGLE_PROVIDER,
    model: process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL,
    useMistral: false,
  };
}

export function resolveArtifactGenkitConfig(
  metadata: ResolvedArtifactGenkitMetadata,
): ResolvedArtifactGenkitConfig {
  if (metadata.useMistral) {
    return {
      config: {
        plugins: [
          openAICompatible({
            name: MISTRAL_PLUGIN_NAME,
            apiKey: resolveMistralApiKey(),
            baseURL: MISTRAL_BASE_URL,
          }),
        ],
        model: metadata.model,
      },
      provider: metadata.provider,
      model: metadata.model,
    };
  }

  return {
    config: {
      plugins: [googleAI()],
      model: metadata.model,
    },
    provider: metadata.provider,
    model: metadata.model,
  };
}

function resolveMistralApiKey(): string {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is required');
  }

  return apiKey;
}

function resolveMistralModel(): string {
  const configuredModel = process.env.MISTRAL_MODEL?.trim();
  const model = configuredModel || DEFAULT_MISTRAL_MODEL;

  if (model.startsWith(`${MISTRAL_PLUGIN_NAME}/`)) {
    return model;
  }

  return `${MISTRAL_PLUGIN_NAME}/${model}`;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
