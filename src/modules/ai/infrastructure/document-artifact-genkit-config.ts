import { googleAI } from '@genkit-ai/google-genai';
import type { genkit } from 'genkit';
import {
  normalizeMistralModelName,
  resolveMistralFallbackModel,
} from './mistral-model-fallback';
import {
  createOpenAiCompatiblePlugin,
  hasOpenAiCompatibleApiKey,
  isOpenAiCompatibleProvider,
  MIMO_PROVIDER,
  MISTRAL_PROVIDER,
  resolveOpenAiCompatibleProvider,
  type ResolvedOpenAiCompatibleProvider,
} from './openai-compatible-ai-provider';

const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
export const GOOGLE_PROVIDER = 'google-genai';

export type ResolvedArtifactGenkitMetadata = {
  provider: string;
  model: string;
  openAiCompatible?: ResolvedOpenAiCompatibleProvider;
};

type ResolvedArtifactGenkitConfig = {
  config: Parameters<typeof genkit>[0];
  provider: string;
  model: string;
};

export function resolveArtifactGenkitMetadata(): ResolvedArtifactGenkitMetadata {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (isOpenAiCompatibleProvider(provider)) {
    const openAiCompatibleProvider = resolveOpenAiCompatibleProvider(provider);

    return {
      provider: openAiCompatibleProvider.provider,
      model: openAiCompatibleProvider.model,
      openAiCompatible: openAiCompatibleProvider,
    };
  }

  if (
    !hasValue(process.env.GOOGLE_GENAI_API_KEY) &&
    hasOpenAiCompatibleApiKey(MISTRAL_PROVIDER)
  ) {
    const openAiCompatibleProvider =
      resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER);

    return {
      provider: openAiCompatibleProvider.provider,
      model: openAiCompatibleProvider.model,
      openAiCompatible: openAiCompatibleProvider,
    };
  }

  if (
    !hasValue(process.env.GOOGLE_GENAI_API_KEY) &&
    !hasOpenAiCompatibleApiKey(MISTRAL_PROVIDER) &&
    hasOpenAiCompatibleApiKey(MIMO_PROVIDER)
  ) {
    const openAiCompatibleProvider =
      resolveOpenAiCompatibleProvider(MIMO_PROVIDER);

    return {
      provider: openAiCompatibleProvider.provider,
      model: openAiCompatibleProvider.model,
      openAiCompatible: openAiCompatibleProvider,
    };
  }

  return {
    provider: GOOGLE_PROVIDER,
    model: process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL,
  };
}

export function resolveArtifactGenkitConfig(
  metadata: ResolvedArtifactGenkitMetadata,
): ResolvedArtifactGenkitConfig {
  if (metadata.openAiCompatible) {
    return {
      config: {
        plugins: [createOpenAiCompatiblePlugin(metadata.openAiCompatible)],
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

export function resolveArtifactMistralFallbackMetadata(
  metadata: ResolvedArtifactGenkitMetadata,
  specificFallbackEnv: string,
): ResolvedArtifactGenkitMetadata | null {
  if (metadata.provider !== MISTRAL_PROVIDER) {
    return resolveDefaultMistralFallbackMetadata(specificFallbackEnv);
  }

  if (!metadata.openAiCompatible) {
    return null;
  }

  return resolveSecondaryMistralFallbackMetadata(metadata, specificFallbackEnv);
}

function resolveSecondaryMistralFallbackMetadata(
  metadata: ResolvedArtifactGenkitMetadata,
  specificFallbackEnv: string,
): ResolvedArtifactGenkitMetadata | null {
  if (metadata.provider !== MISTRAL_PROVIDER) {
    return null;
  }

  const fallbackModel = resolveMistralFallbackModel({
    primaryModel: metadata.model,
    specificFallbackEnv,
  });

  if (!fallbackModel) {
    return null;
  }

  return {
    ...metadata,
    model: fallbackModel,
    openAiCompatible: {
      ...metadata.openAiCompatible!,
      model: fallbackModel,
    },
  };
}

function resolveDefaultMistralFallbackMetadata(
  specificFallbackEnv: string,
): ResolvedArtifactGenkitMetadata | null {
  if (!hasOpenAiCompatibleApiKey(MISTRAL_PROVIDER)) {
    return null;
  }

  const openAiCompatibleProvider =
    resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER);
  const fallbackModel = normalizeMistralModelName(
    process.env[specificFallbackEnv]?.trim() ||
      process.env.MISTRAL_FALLBACK_MODEL?.trim() ||
      process.env.MISTRAL_MODEL?.trim() ||
      openAiCompatibleProvider.model,
  );

  return {
    provider: MISTRAL_PROVIDER,
    model: fallbackModel,
    openAiCompatible: {
      ...openAiCompatibleProvider,
      model: fallbackModel,
    },
  };
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
