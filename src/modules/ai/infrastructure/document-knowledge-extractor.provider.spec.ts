import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';
import { GenkitOpenAiCompatibleDocumentKnowledgeExtractor } from './genkit-openai-compatible-document-knowledge.extractor';
import {
  createDocumentKnowledgeExtractor,
  resolveDocumentKnowledgeProviderChain,
  resolveDocumentKnowledgeProviderName,
} from './document-knowledge-extractor.provider';

describe('createDocumentKnowledgeExtractor', () => {
  it('uses Genkit by default', () => {
    expect(createDocumentKnowledgeExtractor({})).toBeInstanceOf(
      GenkitDocumentKnowledgeExtractor,
    );
  });

  it('uses Mistral when AI_PROVIDER is mistral', () => {
    expect(
      createDocumentKnowledgeExtractor({
        AI_PROVIDER: 'mistral',
        MISTRAL_API_KEY: 'test-mistral-key',
      }),
    ).toBeInstanceOf(GenkitOpenAiCompatibleDocumentKnowledgeExtractor);
  });

  it('uses Mistral automatically when only a Mistral key is configured', () => {
    expect(
      createDocumentKnowledgeExtractor({
        MISTRAL_API_KEY: 'test-mistral-key',
      }),
    ).toBeInstanceOf(GenkitOpenAiCompatibleDocumentKnowledgeExtractor);
  });

  it('uses MiMo when AI_PROVIDER is mimo', () => {
    expect(
      createDocumentKnowledgeExtractor({
        AI_PROVIDER: 'mimo',
        MIMO_API_KEY: 'test-mimo-key',
      }),
    ).toBeInstanceOf(GenkitOpenAiCompatibleDocumentKnowledgeExtractor);
  });

  it('defaults document extraction to Mistral when the app provider is MiMo and Mistral is configured', () => {
    expect(
      resolveDocumentKnowledgeProviderName({
        AI_PROVIDER: 'mimo',
        MIMO_API_KEY: 'test-mimo-key',
        MISTRAL_API_KEY: 'test-mistral-key',
      }),
    ).toBe('mistral');
  });

  it('allows overriding document extraction back to MiMo explicitly', () => {
    expect(
      resolveDocumentKnowledgeProviderName({
        AI_PROVIDER: 'mimo',
        DOCUMENT_KNOWLEDGE_PROVIDER: 'mimo',
        MIMO_API_KEY: 'test-mimo-key',
        MISTRAL_API_KEY: 'test-mistral-key',
      }),
    ).toBe('mimo');
  });

  it('allows using Google for document extraction explicitly', () => {
    expect(
      resolveDocumentKnowledgeProviderName({
        AI_PROVIDER: 'mimo',
        DOCUMENT_KNOWLEDGE_PROVIDER: 'google',
        MIMO_API_KEY: 'test-mimo-key',
        MISTRAL_API_KEY: 'test-mistral-key',
        GOOGLE_GENAI_API_KEY: 'test-google-key',
      }),
    ).toBe('google');
  });

  it('builds a fallback chain from the document provider to the app provider', () => {
    expect(
      resolveDocumentKnowledgeProviderChain({
        AI_PROVIDER: 'mimo',
        DOCUMENT_KNOWLEDGE_PROVIDER: 'mistral',
        MISTRAL_API_KEY: 'test-mistral-key',
        MIMO_API_KEY: 'test-mimo-key',
        GOOGLE_GENAI_API_KEY: 'test-google-key',
      }),
    ).toEqual(['mistral', 'mimo', 'google']);
  });
});
