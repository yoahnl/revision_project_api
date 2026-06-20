import {
  resolveArtifactMistralFallbackMetadata,
  type ResolvedArtifactGenkitMetadata,
} from './document-artifact-genkit-config';

describe('resolveArtifactMistralFallbackMetadata', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses Mistral as fallback for MiMo-backed artifact generation when configured', () => {
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_MODEL = 'mistral-medium-latest';

    const fallback = resolveArtifactMistralFallbackMetadata(
      {
        provider: 'mimo',
        model: 'mimo/mimo-v2.5-pro',
        openAiCompatible: {
          provider: 'mimo',
          pluginName: 'mimo',
          apiKey: 'test-mimo-key',
          apiKeyEnv: 'MIMO_API_KEY',
          baseURL: 'https://api.xiaomimimo.com/v1',
          model: 'mimo/mimo-v2.5-pro',
        },
      },
      'MISTRAL_SUMMARY_FALLBACK_MODEL',
    );

    expect(fallback).toEqual(
      expect.objectContaining({
        provider: 'mistral',
        model: 'mistral/mistral-medium-latest',
      }),
    );
    expect(fallback?.openAiCompatible).toEqual(
      expect.objectContaining({
        provider: 'mistral',
        model: 'mistral/mistral-medium-latest',
      }),
    );
  });

  it('does not create a fallback for non-Mistral primary providers when Mistral is not configured', () => {
    delete process.env.MISTRAL_API_KEY;

    const metadata: ResolvedArtifactGenkitMetadata = {
      provider: 'mimo',
      model: 'mimo/mimo-v2.5-pro',
    };

    expect(
      resolveArtifactMistralFallbackMetadata(
        metadata,
        'MISTRAL_SUMMARY_FALLBACK_MODEL',
      ),
    ).toBeNull();
  });
});
