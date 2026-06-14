import {
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import type { DocumentKnowledgeExtractor } from '../application/document-knowledge-extractor';
import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';
import { GenkitMistralDocumentKnowledgeExtractor } from './genkit-mistral-document-knowledge.extractor';

type AiProviderEnv = {
  AI_PROVIDER?: string;
  GOOGLE_GENAI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
};

export function createDocumentKnowledgeExtractor(
  env: AiProviderEnv = process.env,
  observer: AiGenerationObserver = noopAiGenerationObserver,
): DocumentKnowledgeExtractor {
  const configuredProvider = env.AI_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === 'mistral') {
    return new GenkitMistralDocumentKnowledgeExtractor(observer);
  }

  if (configuredProvider === 'genkit' || configuredProvider === 'google') {
    return new GenkitDocumentKnowledgeExtractor(observer);
  }

  if (!hasValue(env.GOOGLE_GENAI_API_KEY) && hasValue(env.MISTRAL_API_KEY)) {
    return new GenkitMistralDocumentKnowledgeExtractor(observer);
  }

  return new GenkitDocumentKnowledgeExtractor(observer);
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
