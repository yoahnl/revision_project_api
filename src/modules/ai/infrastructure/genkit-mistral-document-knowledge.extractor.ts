import { Injectable } from '@nestjs/common';
import openAICompatible from '@genkit-ai/compat-oai';
import { genkit } from 'genkit';
import {
  DOCUMENT_KNOWLEDGE_PROMPT_VERSION,
  DOCUMENT_KNOWLEDGE_SCHEMA_VERSION,
  type DocumentKnowledgeChunk,
  type DocumentKnowledgeExtractor,
  type ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';
import {
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import { ExtractedKnowledgeSchema } from './document-knowledge-output.schema';
import {
  buildDocumentKnowledgePrompt,
  normalizeExtractedKnowledgeOutput,
  selectDocumentKnowledgeChunks,
} from './document-knowledge-chunk-input';

const MISTRAL_PLUGIN_NAME = 'mistral';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const FLOW_NAME = 'documentKnowledgeExtraction';
const PROVIDER = 'mistral';
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
    chunks: DocumentKnowledgeChunk[];
  }): Promise<ExtractedKnowledgeUnit[]> {
    const chunks = selectDocumentKnowledgeChunks(input.chunks);
    const prompt = buildDocumentKnowledgePrompt({
      documentId: input.documentId,
      chunks,
    });
    const model = this.resolveModel();
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi().generate({
        prompt,
        output: {
          schema: ExtractedKnowledgeSchema,
        },
      });
      const units = normalizeExtractedKnowledgeOutput(output, chunks);

      this.observer.observe({
        flowName: FLOW_NAME,
        provider: PROVIDER,
        model,
        promptVersion: DOCUMENT_KNOWLEDGE_PROMPT_VERSION,
        schemaVersion: DOCUMENT_KNOWLEDGE_SCHEMA_VERSION,
        inputSize: prompt.length,
        durationMs: Date.now() - startedAt,
        status: 'success',
        documentId: input.documentId,
      });

      return units;
    } catch (error) {
      this.observer.observe({
        flowName: FLOW_NAME,
        provider: PROVIDER,
        model,
        promptVersion: DOCUMENT_KNOWLEDGE_PROMPT_VERSION,
        schemaVersion: DOCUMENT_KNOWLEDGE_SCHEMA_VERSION,
        inputSize: prompt.length,
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
