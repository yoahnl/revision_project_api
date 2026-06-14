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
import {
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
} from './document-artifact-genkit-config';
import { GeneratedRevisionSheetSchema } from './document-artifact-output.schema';

const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';
const REVISION_SHEET_SOURCE_INVALID_ERROR_CODE =
  'REVISION_SHEET_SOURCE_INVALID';

@Injectable()
export class GenkitRevisionSheetGenerator implements RevisionSheetGenerator {
  private ai?: ReturnType<typeof genkit>;
  private resolvedMetadata?: ReturnType<typeof resolveArtifactGenkitMetadata>;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: Parameters<RevisionSheetGenerator['generate']>[0],
  ): Promise<GeneratedRevisionSheet> {
    const metadata = this.resolveMetadata();
    const chunks = selectDocumentArtifactChunks(input.chunks, {
      maxChunksEnv: 'REVISION_SHEET_GENERATION_MAX_CHUNKS',
      maxCharsEnv: 'REVISION_SHEET_GENERATION_MAX_CHARS',
      defaultMaxChunks: 16,
      defaultMaxChars: 16000,
    });
    const prompt = buildRevisionSheetPrompt({
      documentId: input.documentId,
      chunks,
      knowledgeUnits: input.knowledgeUnits,
    });
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi().generate({
        prompt,
        output: {
          schema: GeneratedRevisionSheetSchema,
        },
      });
      const parsed = GeneratedRevisionSheetSchema.parse(output);
      const knownChunkIds = new Set(chunks.map((chunk) => chunk.id));
      const sections = parsed.sections.map((section, index) => ({
        displayOrder: index,
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
        inputSize: prompt.length,
        durationMs,
        status: 'success',
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
          inputSize: prompt.length,
          sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
        },
      };
    } catch (error) {
      this.observer.observe({
        flowName: REVISION_SHEET_FLOW_NAME,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: REVISION_SHEET_PROMPT_VERSION,
        schemaVersion: REVISION_SHEET_SCHEMA_VERSION,
        inputSize: prompt.length,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorCode:
          error instanceof Error &&
          error.message === REVISION_SHEET_SOURCE_INVALID_ERROR_CODE
            ? REVISION_SHEET_SOURCE_INVALID_ERROR_CODE
            : GENERATION_FAILED_ERROR_CODE,
        documentId: input.documentId,
      });
      throw error;
    }
  }

  private getAi(): ReturnType<typeof genkit> {
    this.ai ??= genkit(
      resolveArtifactGenkitConfig(this.resolveMetadata()).config,
    );

    return this.ai;
  }

  private resolveMetadata(): ReturnType<typeof resolveArtifactGenkitMetadata> {
    this.resolvedMetadata ??= resolveArtifactGenkitMetadata();
    return this.resolvedMetadata;
  }
}
