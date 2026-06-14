import {
  type AiGenerationObservation,
  NoopAiGenerationObserver,
} from './ai-generation-observer';

describe('NoopAiGenerationObserver', () => {
  it('accepts a complete observation without side effect', () => {
    const observer = new NoopAiGenerationObserver();
    const observation: AiGenerationObservation = {
      flowName: 'documentKnowledgeExtraction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'document-knowledge-v1',
      schemaVersion: 'extracted-knowledge-v1',
      inputSize: 1200,
      durationMs: 42,
      status: 'success',
      documentId: 'document-1',
    };

    expect(() => observer.observe(observation)).not.toThrow();
  });
});
