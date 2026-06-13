import { GenkitDocumentKnowledgeExtractor } from './genkit-document-knowledge.extractor';
import { GenkitMistralDocumentKnowledgeExtractor } from './genkit-mistral-document-knowledge.extractor';
import { createDocumentKnowledgeExtractor } from './document-knowledge-extractor.provider';

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
    ).toBeInstanceOf(GenkitMistralDocumentKnowledgeExtractor);
  });

  it('uses Mistral automatically when only a Mistral key is configured', () => {
    expect(
      createDocumentKnowledgeExtractor({
        MISTRAL_API_KEY: 'test-mistral-key',
      }),
    ).toBeInstanceOf(GenkitMistralDocumentKnowledgeExtractor);
  });
});
