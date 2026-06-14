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
import type { DiagnosticQuizGenerationChunk } from '../application/diagnostic-quiz-generator';
import {
  OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT,
  OPEN_ANSWER_EVALUATION_INVALID,
  OPEN_ANSWER_EVALUATION_SOURCE_INVALID,
  type GeneratedOpenAnswerEvaluation,
  type OpenAnswerEvaluationInput,
  type OpenAnswerEvaluator,
} from '../application/open-answer-evaluator';

const FLOW_NAME = 'openAnswerEvaluation';
const PROMPT_VERSION = 'open-answer-evaluation-v1';
const SCHEMA_VERSION = 'open-answer-evaluation-v1';
const DEFAULT_MAX_CHUNKS = 10;
const DEFAULT_MAX_CHARS = 10000;
const MAX_EVALUATION_SCORE = 20;

const NonEmptyStringSchema = z.string().trim().min(1);

const GeneratedOpenAnswerEvaluationSchema = z
  .object({
    score: z.number().min(0).max(MAX_EVALUATION_SCORE),
    maxScore: z.number().min(1).max(MAX_EVALUATION_SCORE),
    feedback: z.string().trim().min(8).max(1200),
    presentPoints: z.array(NonEmptyStringSchema.max(240)).max(8),
    missingPoints: z.array(NonEmptyStringSchema.max(240)).max(8),
    errors: z.array(NonEmptyStringSchema.max(240)).max(8),
    modelAnswer: z.string().trim().min(8).max(1200),
    advice: z.string().trim().min(4).max(600),
    sourceChunkIds: z.array(NonEmptyStringSchema).max(8),
  })
  .strict()
  .refine((output) => output.score <= output.maxScore, {
    message: 'Open answer score must be lower than maxScore',
  });

type SelectedOpenAnswerChunk = DiagnosticQuizGenerationChunk & {
  text: string;
};

@Injectable()
export class GenkitOpenAnswerEvaluator implements OpenAnswerEvaluator {
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedArtifactGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async evaluate(
    input: OpenAnswerEvaluationInput,
  ): Promise<GeneratedOpenAnswerEvaluation> {
    const metadata = this.resolveMetadata();
    const chunks = selectChunks({
      chunks: input.chunks ?? [],
      sourceChunkIds: input.question.sourceChunkIds,
      maxChunksEnv: process.env.OPEN_ANSWER_EVALUATION_MAX_CHUNKS,
      maxCharsEnv: process.env.OPEN_ANSWER_EVALUATION_MAX_CHARS,
    });
    const prompt = buildOpenAnswerEvaluationPrompt(input, chunks);
    const inputSize = prompt.length;
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi(metadata).generate({
        prompt,
        output: {
          schema: GeneratedOpenAnswerEvaluationSchema,
        },
      });

      if (!output) {
        throw new Error(OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT);
      }

      const parsed = GeneratedOpenAnswerEvaluationSchema.parse(output);
      const sourceChunkIds = normalizeSourceChunkIds(
        parsed.sourceChunkIds,
        chunks,
        OPEN_ANSWER_EVALUATION_SOURCE_INVALID,
      );
      const evaluation: GeneratedOpenAnswerEvaluation = {
        status: 'READY',
        score: parsed.score,
        maxScore: parsed.maxScore,
        feedback: parsed.feedback,
        presentPoints: parsed.presentPoints,
        missingPoints: parsed.missingPoints,
        errors: parsed.errors,
        modelAnswer: parsed.modelAnswer,
        advice: parsed.advice,
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
        activitySessionId: input.activitySessionId,
        studentId: input.studentId,
      });

      return evaluation;
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
        errorCode: resolveOpenAnswerEvaluationErrorCode(error),
        documentId: input.documentId ?? undefined,
        subjectId: input.subjectId,
        knowledgeUnitId: input.knowledgeUnit.id,
        activitySessionId: input.activitySessionId,
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

function buildOpenAnswerEvaluationPrompt(
  input: OpenAnswerEvaluationInput,
  chunks: SelectedOpenAnswerChunk[],
): string {
  const payload = {
    subjectId: input.subjectId,
    documentId: input.documentId ?? null,
    activitySessionId: input.activitySessionId,
    knowledgeUnit: {
      id: input.knowledgeUnit.id,
      title: input.knowledgeUnit.title,
      summary: input.knowledgeUnit.summary,
      sourceChunkIds: input.knowledgeUnit.sourceChunkIds ?? [],
    },
    question: input.question,
    answerText: input.answerText,
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      pageNumber: chunk.pageNumber ?? null,
      text: chunk.text,
    })),
  };

  return [
    'Tu es un correcteur universitaire qui évalue une réponse ouverte en français.',
    'Évalue uniquement à partir de la question, de la réponse étudiante, de la notion et des chunks fournis.',
    'Ne récompense pas une affirmation non justifiée par le cours.',
    'Retourne uniquement du JSON strict avec score, maxScore, feedback, presentPoints, missingPoints, errors, modelAnswer, advice et sourceChunkIds.',
    'maxScore doit être 20. score doit être entre 0 et maxScore.',
    chunks.length > 0
      ? 'sourceChunkIds doit contenir au moins un ID exact parmi les chunks fournis.'
      : 'Aucun chunk vérifiable n’est fourni: sourceChunkIds doit être vide.',
    JSON.stringify(payload),
  ].join('\n\n');
}

function selectChunks(input: {
  chunks: DiagnosticQuizGenerationChunk[];
  sourceChunkIds: string[];
  maxChunksEnv: string | undefined;
  maxCharsEnv: string | undefined;
}): SelectedOpenAnswerChunk[] {
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
): SelectedOpenAnswerChunk[] {
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
  chunks: SelectedOpenAnswerChunk[],
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

function resolveOpenAnswerEvaluationErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === OPEN_ANSWER_EVALUATION_SOURCE_INVALID
  ) {
    return OPEN_ANSWER_EVALUATION_SOURCE_INVALID;
  }

  if (
    error instanceof Error &&
    error.message === OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT
  ) {
    return OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT;
  }

  return OPEN_ANSWER_EVALUATION_INVALID;
}
