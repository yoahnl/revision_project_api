import { Injectable } from '@nestjs/common';
import { googleAI } from '@genkit-ai/google-genai';
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

const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
const DEFAULT_TEXT_INPUT_LIMIT = 12000;
const FLOW_NAME = 'documentKnowledgeExtraction';
const PROVIDER = 'google-genai';
const PROMPT_VERSION = 'document-knowledge-v1';
const SCHEMA_VERSION = 'extracted-knowledge-v1';
const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';

@Injectable()
export class GenkitDocumentKnowledgeExtractor implements DocumentKnowledgeExtractor {
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
      // raw document text and generated units remain outside the observer.
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
      plugins: [googleAI()],
      model: this.resolveModel(),
    });

    return this.ai;
  }

  private resolveModel(): string {
    this.model ??= process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL;
    return this.model;
  }
}

function resolveTextInputLimit(): number {
  const configuredLimit = Number(process.env.DOCUMENT_TEXT_MAX_CHARS);

  if (!Number.isInteger(configuredLimit) || configuredLimit < 1000) {
    return DEFAULT_TEXT_INPUT_LIMIT;
  }

  return configuredLimit;
}
