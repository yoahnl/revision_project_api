import {
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import type { DocumentKnowledgeExtractor } from '../application/document-knowledge-extractor';
import { FallbackDocumentKnowledgeExtractor } from './fallback-document-knowledge.extractor';
import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';
import { GenkitOpenAiCompatibleDocumentKnowledgeExtractor } from './genkit-openai-compatible-document-knowledge.extractor';
import {
  MIMO_PROVIDER,
  MISTRAL_PROVIDER,
} from './openai-compatible-ai-provider';

type AiProviderEnv = {
  AI_PROVIDER?: string;
  DOCUMENT_KNOWLEDGE_PROVIDER?: string;
  GOOGLE_GENAI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  MIMO_API_KEY?: string;
};

export type DocumentKnowledgeProviderName =
  | typeof MISTRAL_PROVIDER
  | typeof MIMO_PROVIDER
  | 'google';

export function createDocumentKnowledgeExtractor(
  env: AiProviderEnv = process.env,
  observer: AiGenerationObserver = noopAiGenerationObserver,
): DocumentKnowledgeExtractor {
  const extractors = resolveDocumentKnowledgeProviderChain(env).map(
    (provider) => createExtractorForProvider(provider, observer),
  );

  if (extractors.length === 1) {
    return extractors[0];
  }

  return new FallbackDocumentKnowledgeExtractor(extractors);
}

function createExtractorForProvider(
  provider: DocumentKnowledgeProviderName,
  observer: AiGenerationObserver,
): DocumentKnowledgeExtractor {
  if (provider === MISTRAL_PROVIDER) {
    return new GenkitOpenAiCompatibleDocumentKnowledgeExtractor(
      observer,
      MISTRAL_PROVIDER,
    );
  }

  if (provider === MIMO_PROVIDER) {
    return new GenkitOpenAiCompatibleDocumentKnowledgeExtractor(
      observer,
      MIMO_PROVIDER,
    );
  }

  return new GenkitDocumentKnowledgeExtractor(observer);
}

export function resolveDocumentKnowledgeProviderChain(
  env: AiProviderEnv = process.env,
): DocumentKnowledgeProviderName[] {
  const primaryProvider = resolveDocumentKnowledgeProviderName(env);
  const providers: DocumentKnowledgeProviderName[] = [primaryProvider];
  const configuredAppProvider = normalizeConfiguredProvider(env.AI_PROVIDER);

  appendAvailableProvider(providers, configuredAppProvider, env);
  appendAvailableProvider(providers, MISTRAL_PROVIDER, env);
  appendAvailableProvider(providers, MIMO_PROVIDER, env);
  appendAvailableProvider(providers, 'google', env);

  return providers;
}

export function resolveDocumentKnowledgeProviderName(
  env: AiProviderEnv = process.env,
): DocumentKnowledgeProviderName {
  const explicitProvider = normalizeConfiguredProvider(
    env.DOCUMENT_KNOWLEDGE_PROVIDER,
  );

  if (explicitProvider) {
    return explicitProvider;
  }

  const configuredProvider = normalizeConfiguredProvider(env.AI_PROVIDER);

  // Document processing is the entry point for course readiness. MiMo is useful
  // for shorter generation flows, but its OpenAI-compatible stream has proven
  // unstable for document knowledge extraction, so Mistral is the safe default
  // whenever a key is available.
  if (hasValue(env.MISTRAL_API_KEY)) {
    return MISTRAL_PROVIDER;
  }

  if (configuredProvider) {
    return configuredProvider;
  }

  if (!hasValue(env.GOOGLE_GENAI_API_KEY) && hasValue(env.MIMO_API_KEY)) {
    return MIMO_PROVIDER;
  }

  return 'google';
}

function normalizeConfiguredProvider(
  value: string | undefined,
): DocumentKnowledgeProviderName | null {
  const provider = value?.trim().toLowerCase();

  if (provider === MISTRAL_PROVIDER || provider === MIMO_PROVIDER) {
    return provider;
  }

  if (provider === 'genkit' || provider === 'google') {
    return 'google';
  }

  return null;
}

function appendAvailableProvider(
  providers: DocumentKnowledgeProviderName[],
  provider: DocumentKnowledgeProviderName | null,
  env: AiProviderEnv,
) {
  if (
    !provider ||
    providers.includes(provider) ||
    !isProviderConfigured(provider, env)
  ) {
    return;
  }

  providers.push(provider);
}

function isProviderConfigured(
  provider: DocumentKnowledgeProviderName,
  env: AiProviderEnv,
): boolean {
  if (provider === MISTRAL_PROVIDER) {
    return hasValue(env.MISTRAL_API_KEY);
  }

  if (provider === MIMO_PROVIDER) {
    return hasValue(env.MIMO_API_KEY);
  }

  return hasValue(env.GOOGLE_GENAI_API_KEY);
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
