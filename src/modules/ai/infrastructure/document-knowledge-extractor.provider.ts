import {
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import type { DocumentKnowledgeExtractor } from '../application/document-knowledge-extractor';
import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';
import { GenkitOpenAiCompatibleDocumentKnowledgeExtractor } from './genkit-openai-compatible-document-knowledge.extractor';
import {
  MIMO_PROVIDER,
  MISTRAL_PROVIDER,
} from './openai-compatible-ai-provider';

type AiProviderEnv = {
  AI_PROVIDER?: string;
  GOOGLE_GENAI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  MIMO_API_KEY?: string;
};

export function createDocumentKnowledgeExtractor(
  env: AiProviderEnv = process.env,
  observer: AiGenerationObserver = noopAiGenerationObserver,
): DocumentKnowledgeExtractor {
  const configuredProvider = env.AI_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === MISTRAL_PROVIDER) {
    return new GenkitOpenAiCompatibleDocumentKnowledgeExtractor(
      observer,
      MISTRAL_PROVIDER,
    );
  }

  if (configuredProvider === MIMO_PROVIDER) {
    return new GenkitOpenAiCompatibleDocumentKnowledgeExtractor(
      observer,
      MIMO_PROVIDER,
    );
  }

  if (configuredProvider === 'genkit' || configuredProvider === 'google') {
    return new GenkitDocumentKnowledgeExtractor(observer);
  }

  if (!hasValue(env.GOOGLE_GENAI_API_KEY) && hasValue(env.MISTRAL_API_KEY)) {
    return new GenkitOpenAiCompatibleDocumentKnowledgeExtractor(
      observer,
      MISTRAL_PROVIDER,
    );
  }

  if (
    !hasValue(env.GOOGLE_GENAI_API_KEY) &&
    !hasValue(env.MISTRAL_API_KEY) &&
    hasValue(env.MIMO_API_KEY)
  ) {
    return new GenkitOpenAiCompatibleDocumentKnowledgeExtractor(
      observer,
      MIMO_PROVIDER,
    );
  }

  return new GenkitDocumentKnowledgeExtractor(observer);
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
