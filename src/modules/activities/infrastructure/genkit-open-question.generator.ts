import { Inject, Injectable } from '@nestjs/common';
import { genkit, z } from 'genkit';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import {
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
  type ResolvedArtifactGenkitMetadata,
} from '../../ai/infrastructure/document-artifact-genkit-config';
import type {
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationKnowledgeUnit,
} from '../application/diagnostic-quiz-generator';
import {
  type GeneratedOpenQuestion,
  type OpenQuestionGenerationInput,
  type OpenQuestionGenerator,
} from '../application/open-question-generator';
import { OPEN_QUESTION_MAX_ANSWER_LENGTH } from '../application/start-open-question-activity.use-case';

const FLOW_NAME = 'openQuestionGeneration';
const PROMPT_VERSION = 'open-question-generation-v1';
const SCHEMA_VERSION = 'open-question-generation-v1';
const SOURCE_INVALID_ERROR_CODE = 'OPEN_QUESTION_SOURCE_INVALID';
const EMPTY_OUTPUT_ERROR_CODE = 'OPEN_QUESTION_EMPTY_OUTPUT';
const DEFAULT_MAX_CHUNKS = 8;
const DEFAULT_MAX_CHARS = 8000;
const MIN_OPEN_QUESTION_MAX_ANSWER_LENGTH = 500;

const NonEmptyStringSchema = z.string().trim().min(1);

const GeneratedOpenQuestionSchema = z
  .object({
    prompt: z.string().trim().min(8).max(700),
    instructions: z.string().trim().min(8).max(500).nullable(),
    maxAnswerLength: z
      .number()
      .int()
      .min(MIN_OPEN_QUESTION_MAX_ANSWER_LENGTH)
      .max(OPEN_QUESTION_MAX_ANSWER_LENGTH),
    sourceChunkIds: z.array(NonEmptyStringSchema).max(8),
  })
  .strict();

type SelectedOpenQuestionChunk = DiagnosticQuizGenerationChunk & {
  text: string;
};

@Injectable()
export class GenkitOpenQuestionGenerator implements OpenQuestionGenerator {
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedArtifactGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: OpenQuestionGenerationInput,
  ): Promise<GeneratedOpenQuestion> {
    const metadata = this.resolveMetadata();
    const chunks = selectChunks({
      chunks: input.chunks ?? [],
      sourceChunkIds: input.knowledgeUnit.sourceChunkIds ?? [],
      maxChunksEnv: process.env.OPEN_QUESTION_GENERATION_MAX_CHUNKS,
      maxCharsEnv: process.env.OPEN_QUESTION_GENERATION_MAX_CHARS,
    });
    const prompt = buildOpenQuestionPrompt(input, chunks);
    const inputSize = prompt.length;
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi(metadata).generate({
        prompt,
        output: {
          schema: GeneratedOpenQuestionSchema,
        },
      });

      if (!output) {
        throw new Error(EMPTY_OUTPUT_ERROR_CODE);
      }

      const parsed = GeneratedOpenQuestionSchema.parse(output);
      const sourceChunkIds = normalizeSourceChunkIds(
        parsed.sourceChunkIds,
        chunks,
        SOURCE_INVALID_ERROR_CODE,
      );
      const question: GeneratedOpenQuestion = {
        version: 1,
        prompt: parsed.prompt,
        instructions: parsed.instructions,
        maxAnswerLength: parsed.maxAnswerLength,
        sourceChunkIds,
        metadata: {
          flowName: FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: PROMPT_VERSION,
          schemaVersion: SCHEMA_VERSION,
          inputSize,
        },
      };

      this.observer.observe({
        flowName: FLOW_NAME,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        inputSize,
        durationMs: Date.now() - startedAt,
        status: 'success',
        documentId: input.documentId ?? undefined,
        subjectId: input.subjectId,
        knowledgeUnitId: input.knowledgeUnit.id,
        studentId: input.studentId,
      });

      return question;
    } catch (error) {
      this.observer.observe({
        flowName: FLOW_NAME,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        inputSize,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorCode: resolveOpenQuestionErrorCode(error),
        documentId: input.documentId ?? undefined,
        subjectId: input.subjectId,
        knowledgeUnitId: input.knowledgeUnit.id,
        studentId: input.studentId,
      });

      throw error;
    }
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

  private resolveMetadata(): ResolvedArtifactGenkitMetadata {
    this.resolvedMetadata ??= resolveArtifactGenkitMetadata();
    return this.resolvedMetadata;
  }
}

function buildOpenQuestionPrompt(
  input: OpenQuestionGenerationInput,
  chunks: SelectedOpenQuestionChunk[],
): string {
  const payload = {
    subjectId: input.subjectId,
    documentId: input.documentId ?? null,
    knowledgeUnit: toKnowledgeUnitPayload(input.knowledgeUnit),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      pageNumber: chunk.pageNumber ?? null,
      text: chunk.text,
    })),
  };

  return [
    'Tu es un tuteur universitaire qui prépare une question ouverte de révision en français.',
    'Crée une seule question ouverte exigeant une réponse structurée, explicative et sourcée.',
    'La question doit évaluer la compréhension, l’argumentation ou l’application de la notion, pas une simple définition.',
    'N’utilise que la notion et les chunks fournis. N’ajoute aucune connaissance externe.',
    'Retourne uniquement du JSON strict avec prompt, instructions, maxAnswerLength et sourceChunkIds.',
    chunks.length > 0
      ? 'sourceChunkIds doit contenir au moins un ID exact parmi les chunks fournis.'
      : 'Aucun chunk vérifiable n’est fourni: sourceChunkIds doit être vide.',
    JSON.stringify(payload),
  ].join('\n\n');
}

function toKnowledgeUnitPayload(
  knowledgeUnit: DiagnosticQuizGenerationKnowledgeUnit,
) {
  return {
    id: knowledgeUnit.id,
    subjectId: knowledgeUnit.subjectId,
    title: knowledgeUnit.title,
    summary: knowledgeUnit.summary,
    difficulty: knowledgeUnit.difficulty ?? null,
    sourceChunkIds: knowledgeUnit.sourceChunkIds ?? [],
  };
}

function selectChunks(input: {
  chunks: DiagnosticQuizGenerationChunk[];
  sourceChunkIds: string[];
  maxChunksEnv: string | undefined;
  maxCharsEnv: string | undefined;
}): SelectedOpenQuestionChunk[] {
  const chunks = deduplicateChunks(input.chunks);
  const sourceChunkIds = new Set(input.sourceChunkIds);
  const prioritizedChunks = [
    ...chunks.filter((chunk) => sourceChunkIds.has(chunk.id)),
    ...chunks.filter((chunk) => !sourceChunkIds.has(chunk.id)),
  ];
  const maxChunks = resolvePositiveInteger(
    input.maxChunksEnv,
    DEFAULT_MAX_CHUNKS,
  );
  const maxChars = resolvePositiveInteger(input.maxCharsEnv, DEFAULT_MAX_CHARS);
  let remainingChars = maxChars;

  return prioritizedChunks.slice(0, maxChunks).flatMap((chunk) => {
    if (remainingChars <= 0) {
      return [];
    }

    const text = chunk.text.slice(0, remainingChars);
    remainingChars -= text.length;

    if (text.trim().length === 0) {
      return [];
    }

    return [{ ...chunk, text }];
  });
}

function deduplicateChunks(
  chunks: DiagnosticQuizGenerationChunk[],
): SelectedOpenQuestionChunk[] {
  const chunksById = new Map<string, DiagnosticQuizGenerationChunk>();

  for (const chunk of chunks) {
    if (chunk.text.trim().length > 0 && !chunksById.has(chunk.id)) {
      chunksById.set(chunk.id, chunk);
    }
  }

  return [...chunksById.values()].sort(
    (left, right) => left.index - right.index,
  );
}

function normalizeSourceChunkIds(
  sourceChunkIds: string[],
  chunks: SelectedOpenQuestionChunk[],
  errorCode: string,
): string[] {
  if (chunks.length === 0) {
    if (sourceChunkIds.length > 0) {
      throw new Error(errorCode);
    }

    return [];
  }

  const knownChunkIds = new Set(chunks.map((chunk) => chunk.id));
  const normalized = [...new Set(sourceChunkIds)];

  if (
    normalized.length === 0 ||
    normalized.some((chunkId) => !knownChunkIds.has(chunkId))
  ) {
    throw new Error(errorCode);
  }

  return normalized;
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveOpenQuestionErrorCode(error: unknown): string {
  if (error instanceof Error && error.message === SOURCE_INVALID_ERROR_CODE) {
    return SOURCE_INVALID_ERROR_CODE;
  }

  if (error instanceof Error && error.message === EMPTY_OUTPUT_ERROR_CODE) {
    return EMPTY_OUTPUT_ERROR_CODE;
  }

  return 'OPEN_QUESTION_GENERATION_INVALID';
}
