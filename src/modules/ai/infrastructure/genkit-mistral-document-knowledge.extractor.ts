import { Injectable } from '@nestjs/common';
import openAICompatible from '@genkit-ai/compat-oai';
import { genkit } from 'genkit';
import {
  type DocumentKnowledgeExtractor,
  type ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';
import {
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import { ExtractedKnowledgeSchema } from './document-knowledge-output.schema';

const MISTRAL_PLUGIN_NAME = 'mistral';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const DEFAULT_TEXT_INPUT_LIMIT = 12000;
const FLOW_NAME = 'documentKnowledgeExtraction';
const PROVIDER = 'mistral';
const PROMPT_VERSION = 'document-knowledge-v1';
const SCHEMA_VERSION = 'extracted-knowledge-v1';
const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';

@Injectable()
export class GenkitMistralDocumentKnowledgeExtractor implements DocumentKnowledgeExtractor {
  private ai?: ReturnType<typeof genkit>;
  private model?: string;

  constructor(
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async extract(input: {
    documentId: string;
    fileName: string;
    text: string;
  }): Promise<ExtractedKnowledgeUnit[]> {
    const textInput = input.text.slice(0, resolveTextInputLimit());
    const model = this.resolveModel();
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi().generate({
        prompt: [
          'Extract the main knowledge units from this student revision document.',
          'Return concise French titles and summaries.',
          'Return JSON only using the requested schema.',
          `Document id: ${input.documentId}`,
          `File name: ${input.fileName}`,
          textInput,
        ].join('\n\n'),
        output: {
          schema: ExtractedKnowledgeSchema,
        },
      });

      // Only record the bounded input length and stable technical metadata. The
      // raw document text, file name, API key, and generated units are excluded.
      this.observer.observe({
        flowName: FLOW_NAME,
        provider: PROVIDER,
        model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        inputSize: textInput.length,
        durationMs: Date.now() - startedAt,
        status: 'success',
        documentId: input.documentId,
      });

      return output?.units ?? [];
    } catch (error) {
      // Provider errors may contain prompt fragments, so the observer receives a
      // controlled error code and the original exception is rethrown unchanged.
      this.observer.observe({
        flowName: FLOW_NAME,
        provider: PROVIDER,
        model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        inputSize: textInput.length,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorCode: GENERATION_FAILED_ERROR_CODE,
        documentId: input.documentId,
      });
      throw error;
    }
  }

  private getAi(): ReturnType<typeof genkit> {
    this.ai ??= genkit({
      plugins: [
        openAICompatible({
          name: MISTRAL_PLUGIN_NAME,
          apiKey: resolveMistralApiKey(),
          baseURL: MISTRAL_BASE_URL,
        }),
      ],
      model: this.resolveModel(),
    });

    return this.ai;
  }

  private resolveModel(): string {
    this.model ??= resolveMistralModel();
    return this.model;
  }
}

function resolveMistralApiKey(): string {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is required');
  }

  return apiKey;
}

function resolveMistralModel(): string {
  const configuredModel = process.env.MISTRAL_MODEL?.trim();
  const model = configuredModel || DEFAULT_MISTRAL_MODEL;

  if (model.startsWith(`${MISTRAL_PLUGIN_NAME}/`)) {
    return model;
  }

  return `${MISTRAL_PLUGIN_NAME}/${model}`;
}

function resolveTextInputLimit(): number {
  const configuredLimit = Number(process.env.DOCUMENT_TEXT_MAX_CHARS);

  if (!Number.isInteger(configuredLimit) || configuredLimit < 1000) {
    return DEFAULT_TEXT_INPUT_LIMIT;
  }

  return configuredLimit;
}
