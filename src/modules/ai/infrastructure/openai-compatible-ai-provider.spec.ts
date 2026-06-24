import {
  createOpenAiCompatiblePlugin,
  MIMO_PROVIDER,
  MISTRAL_PROVIDER,
  applyMimoOpenAiRequestOptions,
  applyMistralOpenAiRequestOptions,
  resolveOpenAiCompatibleProvider,
} from './openai-compatible-ai-provider';

type OpenAICompatibleInput = {
  name: string;
  apiKey?: string;
  baseURL?: string;
  resolver?: (
    client: unknown,
    actionType: string,
    actionName: string,
  ) => unknown;
};

const mockPlugin = { name: 'openai-compatible-plugin' };
const mockModelAction = { name: 'mimo-model-action' };
const mockModelRef = { name: 'mimo-model-ref' };
const mockOpenAICompatible = jest.fn<unknown, [OpenAICompatibleInput]>(
  () => mockPlugin,
);
const mockCompatOaiModelRef = jest.fn<typeof mockModelRef, [unknown]>(
  () => mockModelRef,
);
const mockDefineCompatOpenAIModel = jest.fn<typeof mockModelAction, [unknown]>(
  () => mockModelAction,
);

jest.mock('@genkit-ai/compat-oai', () => ({
  __esModule: true,
  default: (...args: [OpenAICompatibleInput]) => mockOpenAICompatible(...args),
  openAICompatible: (...args: [OpenAICompatibleInput]) =>
    mockOpenAICompatible(...args),
  compatOaiModelRef: (...args: unknown[]) => mockCompatOaiModelRef(...args),
  defineCompatOpenAIModel: (...args: unknown[]) =>
    mockDefineCompatOpenAIModel(...args),
}));

describe('resolveOpenAiCompatibleProvider', () => {
  beforeEach(() => {
    mockOpenAICompatible.mockClear();
    mockCompatOaiModelRef.mockReset();
    mockDefineCompatOpenAIModel.mockClear();
  });

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

  it('registers MiMo with a request builder that disables provider-side thinking', () => {
    const provider = resolveOpenAiCompatibleProvider(MIMO_PROVIDER, {
      MIMO_API_KEY: 'test-mimo-key',
    });
    const client = { kind: 'openai-client' };

    createOpenAiCompatiblePlugin(provider);

    const [pluginInput] = mockOpenAICompatible.mock.calls[0] ?? [];
    expect(pluginInput).toMatchObject({
      name: 'mimo',
      apiKey: 'test-mimo-key',
      baseURL: 'https://api.xiaomimimo.com/v1',
    });
    expect(pluginInput?.resolver).toEqual(expect.any(Function));

    const resolvedAction = pluginInput?.resolver?.(
      client,
      'model',
      'mimo/mimo-v2.5-pro',
    );

    expect(resolvedAction).toBe(mockModelAction);
    expect(mockCompatOaiModelRef).toHaveBeenCalledWith({
      name: 'mimo/mimo-v2.5-pro',
      namespace: 'mimo',
    });
    expect(mockDefineCompatOpenAIModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'mimo-v2.5-pro',
        client,
        pluginOptions: pluginInput,
        requestBuilder: applyMimoOpenAiRequestOptions,
      }),
    );

    const requestBody: Record<string, unknown> = {};
    applyMimoOpenAiRequestOptions(
      {
        config: {
          customOption: 'kept',
          temperature: 0.2,
        },
      } as never,
      requestBody as never,
    );

    expect(requestBody).toMatchObject({
      customOption: 'kept',
      stream: false,
      temperature: 1,
      topP: 0.95,
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
  });

  it('registers Mistral with a request builder that forces JSON mode without thinking', () => {
    const provider = resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER, {
      MISTRAL_API_KEY: 'test-mistral-key',
    });
    const client = { kind: 'openai-client' };

    createOpenAiCompatiblePlugin(provider);

    const [pluginInput] = mockOpenAICompatible.mock.calls[0] ?? [];
    expect(pluginInput).toMatchObject({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(pluginInput?.resolver).toEqual(expect.any(Function));

    const resolvedAction = pluginInput?.resolver?.(
      client,
      'model',
      'mistral/mistral-medium-latest',
    );

    expect(resolvedAction).toBe(mockModelAction);
    expect(mockDefineCompatOpenAIModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'mistral-medium-latest',
        requestBuilder: applyMistralOpenAiRequestOptions,
      }),
    );

    const requestBody: Record<string, unknown> = {};
    applyMistralOpenAiRequestOptions(
      {
        config: {
          response_format: { type: 'json_object' },
          stream: true,
          customOption: 'kept',
        },
      } as never,
      requestBody as never,
    );

    expect(requestBody).toMatchObject({
      customOption: 'kept',
      stream: false,
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    expect(requestBody).not.toHaveProperty('thinking');
  });
});
