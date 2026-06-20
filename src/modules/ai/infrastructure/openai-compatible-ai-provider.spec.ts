import {
  MIMO_PROVIDER,
  resolveOpenAiCompatibleProvider,
} from './openai-compatible-ai-provider';

describe('resolveOpenAiCompatibleProvider', () => {
  it('defaults MiMo to the pro model for structured Genkit generations', () => {
    const provider = resolveOpenAiCompatibleProvider(MIMO_PROVIDER, {
      MIMO_API_KEY: 'test-mimo-key',
    });

    expect(provider.model).toBe('mimo/mimo-v2.5-pro');
  });

  it('promotes the legacy MiMo default to the pro model', () => {
    const provider = resolveOpenAiCompatibleProvider(MIMO_PROVIDER, {
      MIMO_API_KEY: 'test-mimo-key',
      MIMO_MODEL: 'mimo-v2.5',
    });

    expect(provider.model).toBe('mimo/mimo-v2.5-pro');
  });
});
