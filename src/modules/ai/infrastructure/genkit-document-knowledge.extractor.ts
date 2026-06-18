import { Injectable } from '@nestjs/common';
import { googleAI } from '@genkit-ai/google-genai';
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
import { buildAiErrorDiagnostics } from './ai-error-diagnostics';

const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
const FLOW_NAME = 'documentKnowledgeExtraction';
const PROVIDER = 'google-genai';
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
        ...buildAiErrorDiagnostics(error),
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
