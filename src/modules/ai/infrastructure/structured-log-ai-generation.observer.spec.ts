import { Logger } from '@nestjs/common';
import { StructuredLogAiGenerationObserver } from './structured-log-ai-generation.observer';

describe('StructuredLogAiGenerationObserver', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logs a stable structured success event', () => {
    new StructuredLogAiGenerationObserver().observe({
      flowName: 'documentKnowledgeExtraction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'document-knowledge-v1',
      schemaVersion: 'extracted-knowledge-v1',
      inputSize: 128,
      durationMs: 17,
      status: 'success',
      documentId: 'document-1',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    const [[messageInput]] = logSpy.mock.calls as [[unknown]];
    const message = String(messageInput);
    expect(JSON.parse(message)).toEqual({
      event: 'ai.generation',
      flowName: 'documentKnowledgeExtraction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'document-knowledge-v1',
      schemaVersion: 'extracted-knowledge-v1',
      inputSize: 128,
      durationMs: 17,
      status: 'success',
      documentId: 'document-1',
    });
  });

  it('logs errors as warnings without arbitrary sensitive fields', () => {
    new StructuredLogAiGenerationObserver().observe({
      flowName: 'diagnosticQuizGeneration',
      provider: 'mistral',
      model: 'mistral/mistral-small-latest',
      promptVersion: 'diagnostic-quiz-v1',
      schemaVersion: 'diagnostic-quiz-v1',
      inputSize: 52,
      durationMs: 31,
      status: 'error',
      stream: false,
      structuredOutputMode: 'json_mode',
      responseFormat: 'json_object',
      thinkingDisabled: true,
      attempt: 2,
      maxAttempts: 3,
      retryReason: 'stream_premature_close',
      repairAttempted: true,
      repairSucceeded: false,
      fallbackFrom: 'mimo/mimo-v2.5-pro',
      fallbackTo: 'mistral/mistral-medium-latest',
      errorCode: 'Error',
      errorCategory: 'SCHEMA_VALIDATION',
      errorName: 'ZodError',
      errorStatus: 400,
      errorProviderCode: 'invalid_schema',
      errorSummary: 'AI provider output failed schema validation',
      knowledgeUnitId: 'unit-1',
      subjectId: 'subject-1',
      prompt: 'TEXTE COMPLET DU PROMPT',
      completion: 'COMPLETION COMPLETE',
      documentText: 'TEXTE COMPLET DU COURS',
      userAnswer: 'REPONSE UTILISATEUR COMPLETE',
    } as never);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const [[messageInput]] = warnSpy.mock.calls as [[unknown]];
    const message = String(messageInput);
    expect(message).toContain('"event":"ai.generation"');
    expect(message).toContain('"errorCode":"Error"');
    expect(message).toContain('"stream":false');
    expect(message).toContain('"structuredOutputMode":"json_mode"');
    expect(message).toContain('"responseFormat":"json_object"');
    expect(message).toContain('"thinkingDisabled":true');
    expect(message).toContain('"attempt":2');
    expect(message).toContain('"maxAttempts":3');
    expect(message).toContain('"retryReason":"stream_premature_close"');
    expect(message).toContain('"repairAttempted":true');
    expect(message).toContain('"repairSucceeded":false');
    expect(message).toContain('"fallbackFrom":"mimo/mimo-v2.5-pro"');
    expect(message).toContain('"fallbackTo":"mistral/mistral-medium-latest"');
    expect(message).toContain('"errorCategory":"SCHEMA_VALIDATION"');
    expect(message).toContain('"errorName":"ZodError"');
    expect(message).toContain('"errorStatus":400');
    expect(message).toContain('"errorProviderCode":"invalid_schema"');
    expect(message).toContain(
      '"errorSummary":"AI provider output failed schema validation"',
    );
    expect(message).not.toContain('TEXTE COMPLET DU PROMPT');
    expect(message).not.toContain('COMPLETION COMPLETE');
    expect(message).not.toContain('TEXTE COMPLET DU COURS');
    expect(message).not.toContain('REPONSE UTILISATEUR COMPLETE');
  });
});
