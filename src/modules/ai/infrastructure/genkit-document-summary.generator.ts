import { Inject, Injectable } from '@nestjs/common';
import { genkit } from 'genkit';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import {
  DOCUMENT_SUMMARY_FLOW_NAME,
  DOCUMENT_SUMMARY_PROMPT_VERSION,
  DOCUMENT_SUMMARY_SCHEMA_VERSION,
  type DocumentSummaryGenerator,
  type GeneratedDocumentSummary,
} from '../application/document-summary-generator';
import {
  buildDocumentSummaryPrompt,
  normalizeSourceChunkIds,
  selectDocumentArtifactChunks,
} from './document-artifact-generation-input';
import {
  type ResolvedArtifactGenkitMetadata,
  resolveArtifactMistralFallbackMetadata,
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
} from './document-artifact-genkit-config';
import { GeneratedDocumentSummarySchema } from './document-artifact-output.schema';
import { isInvalidAiOutputError } from './mistral-model-fallback';

const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';
const SUMMARY_SOURCE_INVALID_ERROR_CODE = 'SUMMARY_SOURCE_INVALID';

@Injectable()
export class GenkitDocumentSummaryGenerator implements DocumentSummaryGenerator {
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ReturnType<typeof resolveArtifactGenkitMetadata>;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: Parameters<DocumentSummaryGenerator['generate']>[0],
  ): Promise<GeneratedDocumentSummary> {
    const primaryMetadata = this.resolveMetadata();
    const fallbackMetadata = resolveArtifactMistralFallbackMetadata(
      primaryMetadata,
      'MISTRAL_SUMMARY_FALLBACK_MODEL',
    );
    const attempts = fallbackMetadata
      ? [primaryMetadata, fallbackMetadata]
      : [primaryMetadata];
    const chunks = selectDocumentArtifactChunks(input.chunks, {
      maxChunksEnv: 'SUMMARY_GENERATION_MAX_CHUNKS',
      maxCharsEnv: 'SUMMARY_GENERATION_MAX_CHARS',
      defaultMaxChunks: 12,
      defaultMaxChars: 12000,
    });
    const prompt = buildDocumentSummaryPrompt({
      documentId: input.documentId,
      chunks,
      knowledgeUnits: input.knowledgeUnits,
    });

    for (const [index, metadata] of attempts.entries()) {
      const startedAt = Date.now();

      try {
        const { output } = await this.getAi(metadata).generate({
          prompt,
          output: {
            schema: GeneratedDocumentSummarySchema,
          },
        });
        const parsed = GeneratedDocumentSummarySchema.parse(output);
        const sourceChunkIds = normalizeSourceChunkIds({
          sourceChunkIds: parsed.sourceChunkIds,
          knownChunkIds: new Set(chunks.map((chunk) => chunk.id)),
          errorMessage: SUMMARY_SOURCE_INVALID_ERROR_CODE,
        });
        const generatedAt = new Date();
        const durationMs = Date.now() - startedAt;

        this.observer.observe({
          flowName: DOCUMENT_SUMMARY_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: DOCUMENT_SUMMARY_PROMPT_VERSION,
          schemaVersion: DOCUMENT_SUMMARY_SCHEMA_VERSION,
          inputSize: prompt.length,
          durationMs,
          status: 'success',
          documentId: input.documentId,
        });

        return {
          title: parsed.title,
          content: parsed.content,
          keyPoints: parsed.keyPoints,
          limits: parsed.limits ?? null,
          sourceChunkIds,
          metadata: {
            flowName: DOCUMENT_SUMMARY_FLOW_NAME,
            provider: metadata.provider,
            model: metadata.model,
            promptVersion: DOCUMENT_SUMMARY_PROMPT_VERSION,
            schemaVersion: DOCUMENT_SUMMARY_SCHEMA_VERSION,
            generatedAt,
            inputSize: prompt.length,
            sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
          },
        };
      } catch (error) {
        this.observer.observe({
          flowName: DOCUMENT_SUMMARY_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: DOCUMENT_SUMMARY_PROMPT_VERSION,
          schemaVersion: DOCUMENT_SUMMARY_SCHEMA_VERSION,
          inputSize: prompt.length,
          durationMs: Date.now() - startedAt,
          status: 'error',
          errorCode: resolveSummaryGenerationErrorCode(error),
          documentId: input.documentId,
        });

        if (
          index === 0 &&
          attempts.length > 1 &&
          isInvalidAiOutputError(error, [SUMMARY_SOURCE_INVALID_ERROR_CODE])
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(GENERATION_FAILED_ERROR_CODE);
  }

  private getAi(
    metadata: ResolvedArtifactGenkitMetadata,
  ): ReturnType<typeof genkit> {
    const cacheKey = `${metadata.provider}:${metadata.model}`;
    const existingAi = this.aiByModel.get(cacheKey);

    if (existingAi) {
      return existingAi;
    }

    const ai = genkit(resolveArtifactGenkitConfig(metadata).config);
    this.aiByModel.set(cacheKey, ai);

    return ai;
  }

  private resolveMetadata(): ReturnType<typeof resolveArtifactGenkitMetadata> {
    this.resolvedMetadata ??= resolveArtifactGenkitMetadata();
    return this.resolvedMetadata;
  }
}

function resolveSummaryGenerationErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === SUMMARY_SOURCE_INVALID_ERROR_CODE
  ) {
    return SUMMARY_SOURCE_INVALID_ERROR_CODE;
  }

  return GENERATION_FAILED_ERROR_CODE;
}
