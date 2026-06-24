import { Inject, Injectable } from '@nestjs/common';
import { genkit } from 'genkit';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../application/ai-generation-observer';
import {
  REVISION_SHEET_FLOW_NAME,
  REVISION_SHEET_PROMPT_VERSION,
  REVISION_SHEET_SCHEMA_VERSION,
  type GeneratedRevisionSheet,
  type RevisionSheetGenerator,
} from '../application/revision-sheet-generator';
import {
  buildRevisionSheetPrompt,
  normalizeSourceChunkIds,
  selectDocumentArtifactChunks,
} from './document-artifact-generation-input';
import { buildAiErrorDiagnostics } from './ai-error-diagnostics';
import {
  type ResolvedArtifactGenkitMetadata,
  resolveArtifactGoogleFallbackMetadata,
  resolveArtifactMistralFallbackMetadata,
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
} from './document-artifact-genkit-config';
import { GeneratedRevisionSheetSchema } from './document-artifact-output.schema';
import {
  buildExplicitJsonInstruction,
  buildStructuredGenerationConfig,
  resolveStructuredGenerationPolicy,
} from './structured-generation-policy';

const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';
const REVISION_SHEET_SOURCE_INVALID_ERROR_CODE =
  'REVISION_SHEET_SOURCE_INVALID';

@Injectable()
export class GenkitRevisionSheetGenerator implements RevisionSheetGenerator {
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ReturnType<typeof resolveArtifactGenkitMetadata>;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: Parameters<RevisionSheetGenerator['generate']>[0],
  ): Promise<GeneratedRevisionSheet> {
    const primaryMetadata = this.resolveMetadata();
    const fallbackMetadata = resolveArtifactMistralFallbackMetadata(
      primaryMetadata,
      'MISTRAL_REVISION_SHEET_FALLBACK_MODEL',
    );
    const googleFallbackMetadata =
      resolveArtifactGoogleFallbackMetadata(primaryMetadata);
    const attempts = [
      primaryMetadata,
      fallbackMetadata,
      googleFallbackMetadata,
    ].filter((metadata): metadata is ResolvedArtifactGenkitMetadata =>
      Boolean(metadata),
    );
    const chunks = selectDocumentArtifactChunks(input.chunks, {
      maxChunksEnv: 'REVISION_SHEET_GENERATION_MAX_CHUNKS',
      maxCharsEnv: 'REVISION_SHEET_GENERATION_MAX_CHARS',
      defaultMaxChunks: 10,
      defaultMaxChars: 10000,
    });
    const prompt = buildRevisionSheetPrompt({
      documentId: input.documentId,
      chunks,
      knowledgeUnits: input.knowledgeUnits,
    });

    for (const [index, metadata] of attempts.entries()) {
      const startedAt = Date.now();
      const policy = resolveStructuredGenerationPolicy({
        provider: metadata.provider,
        structuredOutput: true,
      });
      const generationPrompt = buildExplicitJsonInstruction({
        prompt,
        requiresJsonInstruction: policy.requiresJsonInstruction,
      });

      try {
        const { output } = await this.getAi(metadata).generate({
          prompt: generationPrompt,
          config: buildStructuredGenerationConfig(policy),
          output: {
            schema: GeneratedRevisionSheetSchema,
          },
        });
        const parsed = GeneratedRevisionSheetSchema.parse(output);
        const knownChunkIds = new Set(chunks.map((chunk) => chunk.id));
        const sections = parsed.sections.map((section, sectionIndex) => ({
          displayOrder: sectionIndex,
          title: section.title,
          content: section.content,
          sourceChunkIds: normalizeSourceChunkIds({
            sourceChunkIds: section.sourceChunkIds,
            knownChunkIds,
            errorMessage: REVISION_SHEET_SOURCE_INVALID_ERROR_CODE,
          }),
        }));
        const generatedAt = new Date();
        const durationMs = Date.now() - startedAt;

        this.observer.observe({
          flowName: REVISION_SHEET_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: REVISION_SHEET_PROMPT_VERSION,
          schemaVersion: REVISION_SHEET_SCHEMA_VERSION,
          inputSize: generationPrompt.length,
          durationMs,
          status: 'success',
          stream: policy.stream,
          structuredOutputMode: policy.structuredOutputMode,
          responseFormat: policy.responseFormat?.type,
          thinkingDisabled: policy.thinkingDisabled,
          attempt: index + 1,
          maxAttempts: attempts.length,
          fallbackFrom: index > 0 ? attempts[0].model : undefined,
          documentId: input.documentId,
        });

        return {
          title: parsed.title,
          introduction: parsed.introduction ?? null,
          sections,
          keyPoints: parsed.keyPoints,
          commonMistakes: parsed.commonMistakes ?? [],
          mustKnow: parsed.mustKnow ?? [],
          practiceSuggestions: parsed.practiceSuggestions ?? [],
          metadata: {
            flowName: REVISION_SHEET_FLOW_NAME,
            provider: metadata.provider,
            model: metadata.model,
            promptVersion: REVISION_SHEET_PROMPT_VERSION,
            schemaVersion: REVISION_SHEET_SCHEMA_VERSION,
            generatedAt,
            inputSize: generationPrompt.length,
            sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
          },
        };
      } catch (error) {
        const diagnostics = buildAiErrorDiagnostics(error);

        this.observer.observe({
          flowName: REVISION_SHEET_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: REVISION_SHEET_PROMPT_VERSION,
          schemaVersion: REVISION_SHEET_SCHEMA_VERSION,
          inputSize: generationPrompt.length,
          durationMs: Date.now() - startedAt,
          status: 'error',
          stream: policy.stream,
          structuredOutputMode: policy.structuredOutputMode,
          responseFormat: policy.responseFormat?.type,
          thinkingDisabled: policy.thinkingDisabled,
          attempt: index + 1,
          maxAttempts: attempts.length,
          retryReason: index < attempts.length - 1 ? 'fallback' : undefined,
          fallbackFrom:
            index < attempts.length - 1 ? metadata.model : undefined,
          fallbackTo:
            index < attempts.length - 1 ? attempts[index + 1].model : undefined,
          errorCode: resolveRevisionSheetGenerationErrorCode(error),
          errorCategory: diagnostics.errorCategory,
          errorName: diagnostics.errorName,
          errorStatus: diagnostics.errorStatus,
          errorProviderCode: diagnostics.errorProviderCode,
          errorSummary: diagnostics.errorSummary,
          documentId: input.documentId,
        });

        if (index < attempts.length - 1) {
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

function resolveRevisionSheetGenerationErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === REVISION_SHEET_SOURCE_INVALID_ERROR_CODE
  ) {
    return REVISION_SHEET_SOURCE_INVALID_ERROR_CODE;
  }

  return GENERATION_FAILED_ERROR_CODE;
}
