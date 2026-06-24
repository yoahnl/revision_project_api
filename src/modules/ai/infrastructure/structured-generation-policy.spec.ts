import {
  aiProviderCapabilities,
  buildExplicitJsonInstruction,
  resolveStructuredGenerationPolicy,
} from './structured-generation-policy';

describe('aiProviderCapabilities', () => {
  it('keeps Gemini structured generation capabilities unchanged', () => {
    expect(aiProviderCapabilities.gemini).toEqual(
      expect.objectContaining({
        supportsNativeStructuredOutput: true,
        supportsJsonMode: true,
        supportsStructuredStreaming: true,
        shouldDisableStreamingForStructuredOutput: false,
        requiresExplicitJsonPrompt: false,
      }),
    );
  });

  it('disables structured streaming for Mistral and requires explicit JSON prompting', () => {
    expect(aiProviderCapabilities.mistral).toEqual(
      expect.objectContaining({
        supportsNativeStructuredOutput: true,
        supportsJsonMode: true,
        supportsStructuredStreaming: false,
        shouldDisableStreamingForStructuredOutput: true,
        requiresExplicitJsonPrompt: true,
      }),
    );
  });

  it('disables structured streaming for MiMo and marks thinking as structured-output disabled', () => {
    expect(aiProviderCapabilities.mimo).toEqual(
      expect.objectContaining({
        supportsNativeStructuredOutput: false,
        supportsJsonMode: true,
        supportsStructuredStreaming: false,
        supportsThinking: true,
        shouldDisableStreamingForStructuredOutput: true,
        requiresExplicitJsonPrompt: true,
      }),
    );
  });
});

describe('resolveStructuredGenerationPolicy', () => {
  it('keeps Gemini on native Genkit structured output', () => {
    const policy = resolveStructuredGenerationPolicy({
      provider: 'google-genai',
      structuredOutput: true,
    });

    expect(policy).toEqual(
      expect.objectContaining({
        stream: false,
        structuredOutputMode: 'native_schema',
        requiresJsonInstruction: false,
      }),
    );
    expect(policy.responseFormat).toBeUndefined();
    expect(policy.thinking).toBeUndefined();
  });

  it('uses non-streaming JSON mode for Mistral structured output', () => {
    expect(
      resolveStructuredGenerationPolicy({
        provider: 'mistral',
        structuredOutput: true,
      }),
    ).toEqual(
      expect.objectContaining({
        stream: false,
        temperature: 0,
        structuredOutputMode: 'json_mode',
        responseFormat: { type: 'json_object' },
        requiresJsonInstruction: true,
        allowRepairAttempt: true,
        allowFallback: true,
      }),
    );
  });

  it('uses non-streaming JSON mode with thinking disabled for MiMo structured output', () => {
    expect(
      resolveStructuredGenerationPolicy({
        provider: 'mimo',
        structuredOutput: true,
      }),
    ).toEqual(
      expect.objectContaining({
        stream: false,
        temperature: 1,
        topP: 0.95,
        maxCompletionTokens: 4096,
        structuredOutputMode: 'json_mode',
        responseFormat: { type: 'json_object' },
        thinking: { type: 'disabled' },
        thinkingDisabled: true,
        requiresJsonInstruction: true,
      }),
    );
  });

  it('adds a strict JSON instruction only when the provider policy requires it', () => {
    const prompt = 'Retourne une fiche structurée.';

    expect(
      buildExplicitJsonInstruction({
        prompt,
        requiresJsonInstruction: false,
      }),
    ).toBe(prompt);

    expect(
      buildExplicitJsonInstruction({
        prompt,
        requiresJsonInstruction: true,
      }),
    ).toContain('Tu dois répondre uniquement avec un objet JSON valide.');
  });
});
