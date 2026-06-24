import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit, z } from 'genkit';
import type {
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationInput,
  DiagnosticQuizGenerator,
  DiagnosticQuizSelectionMode,
  DiagnosticQuizVisualType,
  GeneratedDiagnosticQuizChartVisual,
  GeneratedDiagnosticQuiz,
  GeneratedDiagnosticQuizChoice,
  GeneratedDiagnosticQuizDiagramVisual,
  GeneratedDiagnosticQuizQuestion,
  GeneratedDiagnosticQuizVisual,
} from '../application/diagnostic-quiz-generator';
import {
  DEFAULT_DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT,
  DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID,
  resolveDiagnosticQuizQuestionCount,
} from '../application/diagnostic-quiz-question-count';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import {
  isInvalidAiOutputError,
  resolveMistralFallbackModel,
} from '../../ai/infrastructure/mistral-model-fallback';
import { buildAiErrorDiagnostics } from '../../ai/infrastructure/ai-error-diagnostics';
import {
  createOpenAiCompatiblePlugin,
  hasOpenAiCompatibleApiKey,
  isOpenAiCompatibleProvider,
  MIMO_PROVIDER,
  MISTRAL_PROVIDER,
  normalizeMistralModelName,
  resolveOpenAiCompatibleProvider,
  type OpenAiCompatibleProviderName,
  type ResolvedOpenAiCompatibleProvider,
} from '../../ai/infrastructure/openai-compatible-ai-provider';
import {
  buildExplicitJsonInstruction,
  buildStructuredGenerationConfig,
  resolveStructuredGenerationPolicy,
} from '../../ai/infrastructure/structured-generation-policy';

const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
const FLOW_NAME = 'diagnosticQuizGeneration';
const GOOGLE_PROVIDER = 'google-genai';
const DIAGNOSTIC_QUIZ_V2_VERSION = 'diagnostic-quiz-v2';
const DIAGNOSTIC_QUIZ_V3_VERSION = 'diagnostic-quiz-v3';
const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';
const EMPTY_OUTPUT_ERROR_CODE = 'GENKIT_EMPTY_OUTPUT';
const SOURCE_INVALID_ERROR_CODE = 'DIAGNOSTIC_QUIZ_SOURCE_INVALID';
const VISUAL_INVALID_ERROR_CODE = 'DIAGNOSTIC_QUIZ_VISUAL_INVALID';
const MULTI_ANSWER_INVALID_ERROR_CODE = 'DIAGNOSTIC_QUIZ_MULTI_ANSWER_INVALID';
const QUESTION_COUNT_INVALID_ERROR_CODE =
  DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID;
const DEFAULT_MAX_CHUNKS = 8;
const DEFAULT_MAX_CHARS = 8000;
const MAX_QUESTION_COUNT = DEFAULT_DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT;
const MAX_VISUALS_PER_QUESTION = 2;
const MAX_CHART_ROWS = 12;
const MAX_CHART_KEYS = 8;
const MAX_DIAGRAM_NODES = 12;
const MAX_DIAGRAM_EDGES = 20;
const OPENAI_COMPAT_DIAGNOSTIC_QUIZ_TRANSPORT_ENV =
  'DIAGNOSTIC_QUIZ_OPENAI_COMPAT_TRANSPORT';
const AI_RESPONSE_PREVIEW_CHARS_ENV =
  'DIAGNOSTIC_QUIZ_AI_RESPONSE_PREVIEW_CHARS';
const DEFAULT_AI_RESPONSE_PREVIEW_CHARS = 1500;
const MAX_AI_RESPONSE_PREVIEW_CHARS = 4000;

const NonEmptyStringSchema = z.string().trim().min(1);
const DiagnosticQuizDifficultySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const DiagnosticQuizSelectionModeSchema = z.enum(['single', 'multiple']);

const GeneratedDiagnosticQuizChoiceSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    feedback: NonEmptyStringSchema.nullish(),
  })
  .strict();

const ChartValueSchema = z.union([z.string(), z.number(), z.null()]);

const GeneratedDiagnosticQuizImageVisualSchema = z
  .object({
    type: z.literal('IMAGE'),
    displayOrder: z.number().int().min(0).optional(),
    imageUrl: NonEmptyStringSchema,
    altText: NonEmptyStringSchema,
    caption: NonEmptyStringSchema.nullish(),
    sourceChunkIds: z.array(NonEmptyStringSchema).min(1),
  })
  .strict();

const GeneratedDiagnosticQuizChartVisualSchema = z
  .object({
    type: z.literal('CHART'),
    displayOrder: z.number().int().min(0).optional(),
    chartType: z.enum(['bar', 'line', 'pie', 'scatter']),
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullish(),
    data: z
      .array(z.record(z.string(), ChartValueSchema))
      .min(1)
      .max(MAX_CHART_ROWS),
    xKey: NonEmptyStringSchema.nullish(),
    yKeys: z.array(NonEmptyStringSchema).min(1).max(4).nullish(),
    sourceChunkIds: z.array(NonEmptyStringSchema).min(1),
  })
  .strict();

const GeneratedDiagnosticQuizDiagramVisualSchema = z
  .object({
    type: z.literal('DIAGRAM'),
    displayOrder: z.number().int().min(0).optional(),
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullish(),
    nodes: z
      .array(
        z
          .object({
            id: NonEmptyStringSchema,
            label: NonEmptyStringSchema,
          })
          .strict(),
      )
      .min(2)
      .max(MAX_DIAGRAM_NODES),
    edges: z
      .array(
        z
          .object({
            from: NonEmptyStringSchema,
            to: NonEmptyStringSchema,
            label: NonEmptyStringSchema.nullish(),
          })
          .strict(),
      )
      .max(MAX_DIAGRAM_EDGES)
      .optional(),
    sourceChunkIds: z.array(NonEmptyStringSchema).min(1),
  })
  .strict();

const GeneratedDiagnosticQuizVisualSchema = z.union([
  GeneratedDiagnosticQuizImageVisualSchema,
  GeneratedDiagnosticQuizChartVisualSchema,
  GeneratedDiagnosticQuizDiagramVisualSchema,
]);

const GeneratedDiagnosticQuizQuestionSchema = z
  .object({
    prompt: z.string().min(8),
    difficulty: DiagnosticQuizDifficultySchema.nullish(),
    choices: z.array(GeneratedDiagnosticQuizChoiceSchema).min(2).max(4),
    selectionMode: DiagnosticQuizSelectionModeSchema.optional(),
    minSelections: z.number().int().min(1).nullish(),
    maxSelections: z.number().int().min(1).nullish(),
    correctChoiceId: NonEmptyStringSchema.nullish(),
    correctChoiceIds: z.array(NonEmptyStringSchema).min(1).optional(),
    explanation: z.string().min(8),
    sourceChunkIds: z.array(NonEmptyStringSchema).optional(),
    visuals: z
      .array(GeneratedDiagnosticQuizVisualSchema)
      .max(MAX_VISUALS_PER_QUESTION)
      .optional(),
  })
  .strict()
  .refine(
    (question) => {
      const choiceIds = question.choices.map((choice) => choice.id);
      const choiceIdSet = new Set(choiceIds);

      if (choiceIdSet.size !== choiceIds.length) {
        return false;
      }

      const selectionMode = question.selectionMode ?? 'single';

      if (selectionMode === 'single') {
        return (
          typeof question.correctChoiceId === 'string' &&
          choiceIdSet.has(question.correctChoiceId) &&
          question.correctChoiceIds === undefined
        );
      }

      const correctChoiceIds = question.correctChoiceIds ?? [];

      return (
        correctChoiceIds.length > 0 &&
        new Set(correctChoiceIds).size === correctChoiceIds.length &&
        correctChoiceIds.every((choiceId) => choiceIdSet.has(choiceId)) &&
        !question.correctChoiceId &&
        (question.minSelections ?? 1) <=
          (question.maxSelections ?? correctChoiceIds.length) &&
        (question.maxSelections ?? correctChoiceIds.length) <=
          question.choices.length
      );
    },
    {
      message: 'Question choices and correction fields must be coherent',
    },
  );

const GeneratedDiagnosticQuizSingleChoiceQuestionSchema = z
  .object({
    prompt: z.string().min(8),
    difficulty: DiagnosticQuizDifficultySchema.nullish(),
    choices: z.array(GeneratedDiagnosticQuizChoiceSchema).min(2).max(4),
    selectionMode: z.literal('single').optional(),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().min(8),
    sourceChunkIds: z.array(NonEmptyStringSchema).optional(),
  })
  .strict();

const GeneratedDiagnosticQuizSchema = z
  .object({
    title: z.string().min(2),
    questions: z
      .array(GeneratedDiagnosticQuizQuestionSchema)
      .min(1)
      .max(MAX_QUESTION_COUNT),
  })
  .strict();

const GeneratedDiagnosticQuizSingleChoiceSchema = z
  .object({
    title: z.string().min(2),
    questions: z
      .array(GeneratedDiagnosticQuizSingleChoiceQuestionSchema)
      .min(1)
      .max(MAX_QUESTION_COUNT),
  })
  .strict();

@Injectable()
export class GenkitDiagnosticQuizGenerator implements DiagnosticQuizGenerator {
  private readonly logger = new Logger(GenkitDiagnosticQuizGenerator.name);
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: DiagnosticQuizGenerationInput,
  ): Promise<GeneratedDiagnosticQuiz> {
    const primaryMetadata = this.resolveMetadata();
    const fallbackMetadata =
      resolveDiagnosticQuizFallbackMetadata(primaryMetadata);
    const attempts = fallbackMetadata
      ? [primaryMetadata, fallbackMetadata]
      : [primaryMetadata];
    const generationVersion = resolveDiagnosticQuizGenerationVersion(input);
    const chunks = selectDiagnosticQuizChunks(input);
    const prompt = buildPrompt(input, chunks);
    const inputSize = prompt.length;
    const allowedSelectionModes = resolveAllowedSelectionModes(
      input.selectionModes,
    );
    const allowedVisualTypes = resolveAllowedVisualTypes(input);
    const outputSchema = resolveGeneratedDiagnosticQuizSchema({
      allowedSelectionModes,
      allowedVisualTypes,
    });

    this.logger.log(
      JSON.stringify(
        buildDiagnosticQuizContextLog({
          input,
          chunks,
          metadata: primaryMetadata,
          generationVersion,
          inputSize,
          allowedSelectionModes,
          allowedVisualTypes,
        }),
      ),
    );

    for (const [index, metadata] of attempts.entries()) {
      const startedAt = Date.now();
      let output: unknown;
      const policy = resolveStructuredGenerationPolicy({
        provider: metadata.provider,
        structuredOutput: true,
      });

      try {
        output = await this.generateOutput({
          metadata,
          prompt,
          outputSchema,
          correlationId: input.correlationId,
          policy,
        });
      } catch (error) {
        const errorCode = resolveDiagnosticQuizGenerationErrorCode(error);

        const diagnostics = buildAiErrorDiagnostics(error);

        this.logger.warn(
          JSON.stringify(
            buildDiagnosticQuizErrorLog({
              input,
              metadata,
              generationVersion,
              errorCode,
              diagnostics,
            }),
          ),
        );

        this.observer.observe({
          flowName: FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: generationVersion,
          schemaVersion: generationVersion,
          inputSize,
          durationMs: Date.now() - startedAt,
          status: 'error',
          stream: policy.stream,
          structuredOutputMode: policy.structuredOutputMode,
          responseFormat: policy.responseFormat?.type,
          thinkingDisabled: policy.thinkingDisabled,
          attempt: index + 1,
          maxAttempts: attempts.length,
          retryReason:
            index < attempts.length - 1
              ? resolveDiagnosticQuizRetryReason(error, diagnostics)
              : undefined,
          fallbackFrom:
            index < attempts.length - 1 ? metadata.model : undefined,
          fallbackTo:
            index < attempts.length - 1 ? attempts[index + 1].model : undefined,
          errorCode,
          ...diagnostics,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
          documentId: input.documentId ?? undefined,
        });

        if (
          index < attempts.length - 1 &&
          shouldRetryDiagnosticQuizGeneration(error)
        ) {
          continue;
        }

        throw error;
      }

      if (!output) {
        const error = new Error('Generated diagnostic quiz is empty');
        const errorCode = resolveDiagnosticQuizGenerationErrorCode(error);
        const diagnostics = buildAiErrorDiagnostics(error);

        this.logger.warn(
          JSON.stringify(
            buildDiagnosticQuizErrorLog({
              input,
              metadata,
              generationVersion,
              errorCode,
              diagnostics,
            }),
          ),
        );

        this.observer.observe({
          flowName: FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: generationVersion,
          schemaVersion: generationVersion,
          inputSize,
          durationMs: Date.now() - startedAt,
          status: 'error',
          stream: policy.stream,
          structuredOutputMode: policy.structuredOutputMode,
          responseFormat: policy.responseFormat?.type,
          thinkingDisabled: policy.thinkingDisabled,
          attempt: index + 1,
          maxAttempts: attempts.length,
          retryReason: index < attempts.length - 1 ? 'empty_output' : undefined,
          fallbackFrom:
            index < attempts.length - 1 ? metadata.model : undefined,
          fallbackTo:
            index < attempts.length - 1 ? attempts[index + 1].model : undefined,
          errorCode,
          ...diagnostics,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
          documentId: input.documentId ?? undefined,
        });

        if (
          index < attempts.length - 1 &&
          shouldRetryDiagnosticQuizGeneration(error)
        ) {
          continue;
        }

        throw error;
      }

      try {
        const quiz = normalizeGeneratedQuiz({
          output: GeneratedDiagnosticQuizSchema.parse(output),
          chunks,
          expectedQuestionCount: input.questionCount,
          visualsEnabled: input.visualsEnabled === true,
          allowedVisualTypes,
          allowedSelectionModes,
          metadata: {
            provider: metadata.provider,
            model: metadata.model,
            fallbackUsed: index > 0,
            generationVersion,
            inputSize,
          },
        });

        this.logger.log(
          JSON.stringify(
            buildDiagnosticQuizOutputLog({
              input,
              quiz,
              metadata,
              generationVersion,
            }),
          ),
        );

        this.observer.observe({
          flowName: FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: generationVersion,
          schemaVersion: generationVersion,
          inputSize,
          durationMs: Date.now() - startedAt,
          status: 'success',
          stream: policy.stream,
          structuredOutputMode: policy.structuredOutputMode,
          responseFormat: policy.responseFormat?.type,
          thinkingDisabled: policy.thinkingDisabled,
          attempt: index + 1,
          maxAttempts: attempts.length,
          fallbackFrom: index > 0 ? attempts[0].model : undefined,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
          documentId: input.documentId ?? undefined,
        });

        return quiz;
      } catch (error) {
        const errorCode = resolveDiagnosticQuizGenerationErrorCode(error);

        const diagnostics = buildAiErrorDiagnostics(error);

        this.logger.warn(
          JSON.stringify(
            buildDiagnosticQuizErrorLog({
              input,
              metadata,
              generationVersion,
              errorCode,
              diagnostics,
            }),
          ),
        );

        this.observer.observe({
          flowName: FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: generationVersion,
          schemaVersion: generationVersion,
          inputSize,
          durationMs: Date.now() - startedAt,
          status: 'error',
          stream: policy.stream,
          structuredOutputMode: policy.structuredOutputMode,
          responseFormat: policy.responseFormat?.type,
          thinkingDisabled: policy.thinkingDisabled,
          attempt: index + 1,
          maxAttempts: attempts.length,
          retryReason:
            index < attempts.length - 1
              ? resolveDiagnosticQuizRetryReason(error, diagnostics)
              : undefined,
          fallbackFrom:
            index < attempts.length - 1 ? metadata.model : undefined,
          fallbackTo:
            index < attempts.length - 1 ? attempts[index + 1].model : undefined,
          errorCode,
          ...diagnostics,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
          documentId: input.documentId ?? undefined,
        });

        if (
          index < attempts.length - 1 &&
          shouldRetryDiagnosticQuizGeneration(error)
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(GENERATION_FAILED_ERROR_CODE);
  }

  private async generateOutput(input: {
    metadata: ResolvedGenkitMetadata;
    prompt: string;
    outputSchema: z.ZodTypeAny;
    correlationId?: string;
    policy: ReturnType<typeof resolveStructuredGenerationPolicy>;
  }): Promise<unknown> {
    if (shouldUseDirectOpenAiCompatibleGeneration(input.metadata)) {
      return generateOpenAiCompatibleDiagnosticQuizJson({
        metadata: input.metadata.openAiCompatible,
        prompt: input.prompt,
        correlationId: input.correlationId,
        logger: this.logger,
      });
    }

    const generationPrompt = buildExplicitJsonInstruction({
      prompt: input.prompt,
      requiresJsonInstruction: input.policy.requiresJsonInstruction,
    });
    const result = (await this.getAi(input.metadata).generate({
      prompt: generationPrompt,
      config: buildStructuredGenerationConfig(input.policy),
      output: {
        schema: input.outputSchema,
      },
    })) as { output?: unknown };

    this.logger.log(
      JSON.stringify(
        buildDiagnosticQuizRawOutputLog({
          metadata: input.metadata,
          correlationId: input.correlationId,
          output: result.output,
        }),
      ),
    );

    return result.output;
  }

  private getAi(metadata: ResolvedGenkitMetadata): ReturnType<typeof genkit> {
    const cacheKey = `${metadata.provider}:${metadata.model}`;
    const existingAi = this.aiByModel.get(cacheKey);

    if (existingAi) {
      return existingAi;
    }

    const ai = genkit(resolveGenkitConfig(metadata).config);
    this.aiByModel.set(cacheKey, ai);

    return ai;
  }

  private resolveMetadata(): ResolvedGenkitMetadata {
    this.resolvedMetadata ??= resolveGenkitMetadata();
    return this.resolvedMetadata;
  }
}

function resolveDiagnosticQuizRetryReason(
  error: unknown,
  diagnostics: ReturnType<typeof buildAiErrorDiagnostics>,
): string {
  const providerCode = diagnostics.errorProviderCode?.toLowerCase() ?? '';
  const errorName = diagnostics.errorName?.toLowerCase() ?? '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (
    providerCode === 'err_stream_premature_close' ||
    /premature.*close|stream.*close/.test(`${errorName} ${message}`)
  ) {
    return 'stream_premature_close';
  }

  return diagnostics.errorCategory?.toLowerCase() ?? 'generation_failed';
}

function resolveGeneratedDiagnosticQuizSchema(input: {
  allowedSelectionModes: DiagnosticQuizSelectionMode[];
  allowedVisualTypes: DiagnosticQuizVisualType[];
}) {
  const isSingleChoiceOnly =
    input.allowedSelectionModes.length === 1 &&
    input.allowedSelectionModes[0] === 'single' &&
    input.allowedVisualTypes.length === 0;

  if (!isSingleChoiceOnly) {
    return GeneratedDiagnosticQuizSchema;
  }

  // Gemini rejects the full V3-capable schema for simple quick sessions because
  // the visual/multiple-choice union creates too many serving states. The compact
  // schema is only the provider-facing contract; the full backend parser below
  // still validates and normalizes the generated quiz before persistence.
  return GeneratedDiagnosticQuizSingleChoiceSchema;
}

function shouldRetryDiagnosticQuizGeneration(error: unknown): boolean {
  if (
    isInvalidAiOutputError(error, [
      SOURCE_INVALID_ERROR_CODE,
      VISUAL_INVALID_ERROR_CODE,
      MULTI_ANSWER_INVALID_ERROR_CODE,
      QUESTION_COUNT_INVALID_ERROR_CODE,
      'Generated diagnostic quiz is empty',
    ])
  ) {
    return true;
  }

  // Provider/config/network failures are safe to retry against the configured
  // fallback model because the retry payload remains metadata-only in logs and
  // does not change the public quiz contract.
  return true;
}

function shouldUseDirectOpenAiCompatibleGeneration(
  metadata: ResolvedGenkitMetadata,
): metadata is ResolvedGenkitMetadata & {
  openAiCompatible: ResolvedOpenAiCompatibleProvider;
} {
  if (!metadata.openAiCompatible) {
    return false;
  }

  // The Genkit compat-oai streaming path can close early with MiMo/Mistral on
  // schema-heavy quiz generations. The direct transport keeps the same public
  // contract but forces a plain non-streaming chat completion. Tests can opt
  // back into the legacy transport to keep the older Genkit path covered.
  return (
    process.env[
      OPENAI_COMPAT_DIAGNOSTIC_QUIZ_TRANSPORT_ENV
    ]?.trim().toLowerCase() !== 'genkit'
  );
}

async function generateOpenAiCompatibleDiagnosticQuizJson(input: {
  metadata: ResolvedOpenAiCompatibleProvider;
  prompt: string;
  correlationId?: string;
  logger: Logger;
}): Promise<unknown> {
  if (!input.metadata.apiKey) {
    throw new Error(`${input.metadata.apiKeyEnv} is required`);
  }

  const response = await fetch(
    `${input.metadata.baseURL.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.metadata.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        buildOpenAiCompatibleDiagnosticQuizRequestBody(input),
      ),
    },
  );

  const payload = await readOpenAiCompatibleResponsePayload(response);

  if (!response.ok) {
    input.logger.warn(
      JSON.stringify(
        buildOpenAiCompatibleProviderResponseLog({
          metadata: input.metadata,
          correlationId: input.correlationId,
          httpStatus: response.status,
          payload,
          content: null,
          providerErrorCode: readProviderErrorCode(payload),
        }),
      ),
    );
    throw new OpenAiCompatibleDiagnosticQuizError({
      status: response.status,
      code: readProviderErrorCode(payload),
    });
  }

  const content = extractOpenAiCompatibleMessageContent(payload);
  input.logger.log(
    JSON.stringify(
      buildOpenAiCompatibleProviderResponseLog({
        metadata: input.metadata,
        correlationId: input.correlationId,
        httpStatus: response.status,
        payload,
        content,
      }),
    ),
  );

  return normalizeOpenAiCompatibleDiagnosticQuizOutput(
    parseOpenAiCompatibleJsonContent(content),
  );
}

function normalizeOpenAiCompatibleDiagnosticQuizOutput(
  payload: unknown,
): unknown {
  const unwrappedPayload = unwrapOpenAiCompatibleQuizPayload(payload);
  if (!isRecord(unwrappedPayload)) {
    return payload;
  }

  const questionsValue =
    unwrappedPayload['questions'] ??
    unwrappedPayload['items'] ??
    unwrappedPayload['quizQuestions'];
  if (!Array.isArray(questionsValue)) {
    return unwrappedPayload;
  }

  return removeUndefinedProperties({
    title:
      readStringField(unwrappedPayload, ['title', 'name']) ?? 'QCM diagnostic',
    questions: questionsValue.map((question, index) =>
      normalizeOpenAiCompatibleQuestion(question, index),
    ),
  });
}

function unwrapOpenAiCompatibleQuizPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  for (const key of ['quiz', 'diagnosticQuiz', 'result', 'data']) {
    const value = payload[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return payload;
}

function normalizeOpenAiCompatibleQuestion(
  value: unknown,
  questionIndex: number,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const choices = normalizeOpenAiCompatibleChoices(
    value['choices'] ?? value['options'] ?? value['answers'],
  );
  const correctChoiceIds = normalizeOpenAiCompatibleCorrectChoiceIds(
    value,
    choices,
  );
  const selectionMode = resolveOpenAiCompatibleSelectionMode(
    value,
    correctChoiceIds,
  );
  const effectiveSelectionMode =
    selectionMode ?? (correctChoiceIds.length > 1 ? 'multiple' : 'single');
  const sourceChunkIds = readStringArrayValue(
    value['sourceChunkIds'] ?? value['sourceChunkId'] ?? value['sources'],
  );

  return removeUndefinedProperties({
    prompt:
      readStringField(value, ['prompt', 'question', 'text']) ??
      `Question ${questionIndex + 1}`,
    difficulty: readDiagnosticQuizDifficulty(value['difficulty']),
    choices,
    selectionMode,
    correctChoiceId:
      effectiveSelectionMode === 'single' ? correctChoiceIds[0] : undefined,
    correctChoiceIds:
      effectiveSelectionMode === 'multiple' && correctChoiceIds.length > 0
        ? correctChoiceIds
        : undefined,
    minSelections:
      effectiveSelectionMode === 'multiple'
        ? readPositiveInteger(value['minSelections'])
        : undefined,
    maxSelections:
      effectiveSelectionMode === 'multiple'
        ? readPositiveInteger(value['maxSelections'])
        : undefined,
    explanation:
      readStringField(value, ['explanation', 'rationale', 'feedback']) ??
      readStringField(value, ['reason']),
    sourceChunkIds: sourceChunkIds.length > 0 ? sourceChunkIds : undefined,
    visuals: Array.isArray(value['visuals']) ? value['visuals'] : undefined,
  });
}

function normalizeOpenAiCompatibleChoices(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const usedIds = new Set<string>();
  return value.map((choice, index) => {
    const fallbackId = fallbackChoiceId(index);
    const normalized = normalizeOpenAiCompatibleChoice(choice, fallbackId);
    const rawId = normalized.id;
    const id = usedIds.has(rawId) ? fallbackId : rawId;
    usedIds.add(id);

    return {
      ...normalized,
      id,
    };
  });
}

function normalizeOpenAiCompatibleChoice(
  value: unknown,
  fallbackId: string,
): { id: string; label: string; feedback?: string | null } {
  if (typeof value === 'string') {
    return {
      id: fallbackId,
      label: value,
    };
  }

  if (!isRecord(value)) {
    return {
      id: fallbackId,
      label: fallbackId.toUpperCase(),
    };
  }

  const id = readStringField(value, ['id', 'key', 'letter']);
  const label =
    readStringField(value, ['label', 'text', 'content', 'answer', 'option']) ??
    readStringField(value, ['value']) ??
    id ??
    fallbackId.toUpperCase();
  const feedback = readStringField(value, ['feedback', 'rationale']);

  return removeUndefinedProperties({
    id: normalizeChoiceId(id) ?? fallbackId,
    label,
    feedback,
  });
}

function normalizeOpenAiCompatibleCorrectChoiceIds(
  question: Record<string, unknown>,
  choices: unknown[],
): string[] {
  const choiceRecords = choices.filter(isRecord);
  const candidates = [
    ...readStringArrayValue(question['correctChoiceIds']),
    ...readStringArrayValue(question['correctAnswerIds']),
    ...readStringArrayValue(question['correctOptionIds']),
    ...readStringArrayValue(question['answers']),
    ...readStringArrayValue(question['answer']),
    ...readStringArrayValue(question['correctChoiceId']),
    ...readStringArrayValue(question['correctAnswerId']),
    ...readStringArrayValue(question['correctOptionId']),
    ...readStringArrayValue(question['correctAnswer']),
  ];

  const normalized = candidates
    .map((candidate) => matchOpenAiCompatibleChoiceId(candidate, choiceRecords))
    .filter((candidate): candidate is string => candidate !== undefined);

  return [...new Set(normalized)];
}

function matchOpenAiCompatibleChoiceId(
  candidate: string,
  choices: Array<Record<string, unknown>>,
): string | undefined {
  const normalizedCandidate = candidate.trim();
  const directId = normalizeChoiceId(normalizedCandidate);

  if (
    directId &&
    choices.some((choice) => readStringField(choice, ['id']) === directId)
  ) {
    return directId;
  }

  const numericIndex = Number.parseInt(normalizedCandidate, 10);
  if (
    Number.isInteger(numericIndex) &&
    numericIndex >= 1 &&
    numericIndex <= choices.length
  ) {
    return readStringField(choices[numericIndex - 1], ['id']);
  }

  const byLabel = choices.find((choice) => {
    const label = readStringField(choice, ['label']);
    return (
      label !== undefined &&
      label.trim().toLowerCase() === normalizedCandidate.toLowerCase()
    );
  });

  return byLabel ? readStringField(byLabel, ['id']) : undefined;
}

function resolveOpenAiCompatibleSelectionMode(
  question: Record<string, unknown>,
  correctChoiceIds: string[],
): 'single' | 'multiple' | undefined {
  const explicitMode = readStringField(question, [
    'selectionMode',
    'type',
    'mode',
  ])?.toLowerCase();

  if (explicitMode === 'multiple') {
    return 'multiple';
  }

  if (explicitMode === 'single') {
    return 'single';
  }

  return correctChoiceIds.length > 1 ? 'multiple' : undefined;
}

function readDiagnosticQuizDifficulty(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH'].includes(normalized)
    ? normalized
    : undefined;
}

function readStringField(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readStringArrayValue(value: unknown): string[] {
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return undefined;
  }

  return value;
}

function normalizeChoiceId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(normalized) ? normalized : undefined;
}

function fallbackChoiceId(index: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + index);
}

function removeUndefinedProperties<T extends Record<string, unknown>>(
  value: T,
): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as T;
}

function buildOpenAiCompatibleDiagnosticQuizRequestBody(input: {
  metadata: ResolvedOpenAiCompatibleProvider;
  prompt: string;
}) {
  const policy = resolveStructuredGenerationPolicy({
    provider: input.metadata.provider,
    structuredOutput: true,
  });
  const body: Record<string, unknown> = {
    model: stripOpenAiCompatibleModelNamespace(
      input.metadata.provider,
      input.metadata.model,
    ),
    messages: [
      {
        role: 'system',
        content:
          'Tu retournes uniquement un objet JSON strict, sans Markdown et sans texte autour.',
      },
      {
        role: 'user',
        content: buildExplicitJsonInstruction({
          prompt: input.prompt,
          requiresJsonInstruction: policy.requiresJsonInstruction,
        }),
      },
    ],
    ...buildStructuredGenerationConfig(policy),
  };

  return body;
}

async function readOpenAiCompatibleResponsePayload(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new OpenAiCompatibleDiagnosticQuizError({
      status: response.status,
      code: 'NON_JSON_RESPONSE',
    });
  }
}

function extractOpenAiCompatibleMessageContent(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new Error('OpenAI-compatible response payload is invalid');
  }

  const choicesValue = payload.choices;
  if (!Array.isArray(choicesValue) || choicesValue.length === 0) {
    throw new Error('OpenAI-compatible response choices are missing');
  }

  const choices: unknown[] = choicesValue;
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) {
    throw new Error('OpenAI-compatible response message is missing');
  }

  const message = firstChoice['message'];
  if (!isRecord(message)) {
    throw new Error('OpenAI-compatible response message is missing');
  }

  const content = message['content'];

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!isRecord(part)) {
          return '';
        }

        const textPart = part['text'];
        return typeof textPart === 'string' ? textPart : '';
      })
      .join('');

    if (text.trim().length > 0) {
      return text;
    }
  }

  throw new Error('OpenAI-compatible response content is missing');
}

function parseOpenAiCompatibleJsonContent(content: string): unknown {
  const normalized = stripMarkdownJsonFence(content.trim());
  const start = normalized.indexOf('{');
  const end = normalized.lastIndexOf('}');

  if (start < 0 || end < start) {
    throw new Error('OpenAI-compatible JSON response is missing');
  }

  try {
    return JSON.parse(normalized.slice(start, end + 1));
  } catch {
    throw new Error('OpenAI-compatible JSON response could not be parsed');
  }
}

function stripMarkdownJsonFence(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function stripOpenAiCompatibleModelNamespace(
  provider: OpenAiCompatibleProviderName,
  model: string,
): string {
  const prefix = `${provider}/`;
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

function readProviderErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const error = payload.error;
  if (!isRecord(error)) {
    return undefined;
  }

  for (const key of ['code', 'type']) {
    const value = error[key];
    if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)) {
      return value;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

class OpenAiCompatibleDiagnosticQuizError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(input: { status?: number; code?: string }) {
    super('OpenAI-compatible provider request failed');
    this.name = 'OpenAiCompatibleDiagnosticQuizError';
    this.status = input.status;
    this.code = input.code;
  }
}

type ResolvedGenkitMetadata = {
  provider: string;
  model: string;
  openAiCompatible?: ResolvedOpenAiCompatibleProvider;
};

type ResolvedGenkitConfig = {
  config: Parameters<typeof genkit>[0];
  provider: string;
  model: string;
};

type DiagnosticQuizPromptChunk = DiagnosticQuizGenerationChunk & {
  text: string;
};

function buildPrompt(
  input: DiagnosticQuizGenerationInput,
  chunks: DiagnosticQuizPromptChunk[],
): string {
  const questionCount = resolveDiagnosticQuizQuestionCount(input.questionCount);
  const selectionModes = resolveAllowedSelectionModes(input.selectionModes);
  const visualTypes = resolveAllowedVisualTypes(input);
  const basePrompt = [
    'Tu es un tuteur universitaire qui genere un QCM de revision en francais.',
    'Genere le QCM exclusivement a partir de l unite de connaissance et des chunks fournis.',
    'N ajoute aucun sujet externe, aucun exemple generique et aucune question hors cours.',
    `Modes de selection autorises: ${selectionModes.join(', ')}.`,
    selectionModes.includes('multiple')
      ? 'Pour une question multiple, utilise selectionMode=multiple, correctChoiceIds, minSelections et maxSelections. N utilise pas correctChoiceId.'
      : 'Le QCM est mono-reponse: chaque question a selectionMode=single et un seul correctChoiceId.',
    'Les distracteurs doivent etre plausibles mais faux, distincts et non ambigus.',
    'Chaque explication doit rester fondee sur le cours fourni.',
    `Genere exactement ${questionCount} questions.`,
    'Les questions doivent etre variees, non redondantes et couvrir plusieurs angles de la notion quand les sources le permettent.',
    'Varie les niveaux cognitifs: restitution, comprehension, comparaison, application, piege conceptuel et raisonnement source.',
    'Evite les questions dont la reponse est directement recopiee dans un choix.',
    'Au moins 70% des questions doivent evaluer une comparaison, une application a un cas, une consequence, une exception ou un piege conceptuel.',
    'Limite les questions de simple auteur, date, definition ou identification isolee a 30% maximum du QCM.',
    'Les distracteurs doivent representer des confusions plausibles entre notions proches, conditions, exceptions ou consequences.',
    'Interdit: ne pose jamais de question sur la structure du PDF, la table des matieres, le sommaire, le plan du document, les numeros de page, les contacts, l auteur, l annee universitaire, la bibliographie, les consignes de plagiat ou les metadonnees du support.',
    'Chaque question doit evaluer une notion de fond utile pour reviser, pas l organisation materielle du fichier source.',
    'Ne classe jamais une simple question de restitution en difficulty=HIGH.',
    'Pour difficulty=HIGH, la question doit exiger comparaison, application, diagnostic d erreur ou raisonnement a partir d une source.',
    'Si les sources ne permettent pas une question avancee fiable, genere une question LOW ou MEDIUM plutot qu une question HIGH artificielle.',
    'Si les sources ne permettent pas un QCM fiable, retourne uniquement des questions strictement justifiables par le cours.',
    'Retourne uniquement du JSON strict respectant le schema demande.',
    'Champs attendus: title, questions, prompt, difficulty, choices, selectionMode, correctChoiceId ou correctChoiceIds, explanation, sourceChunkIds.',
    `Titre de l unite: ${input.knowledgeUnit.title}`,
    `Resume de l unite: ${input.knowledgeUnit.summary}`,
  ];

  if (chunks.length === 0) {
    return [
      ...basePrompt,
      'Aucun chunk verifiable n est fourni pour ce mode legacy.',
      'Dans ce mode uniquement, sourceChunkIds peut etre omis.',
      'Contraintes: 2 a 4 choix par question, une seule bonne reponse, explication concise.',
    ].join('\n\n');
  }

  return [
    ...basePrompt,
    'Chaque question doit contenir au moins un sourceChunkId choisi uniquement parmi les chunks fournis.',
    'N invente aucune source libre et ne cite jamais un chunkId absent de la liste.',
    'Si l information n est pas dans les chunks ou la notion, ne pose pas la question.',
    'Le feedback par choix est optionnel et ne sera jamais expose avant soumission.',
    visualTypes.length > 0
      ? `Tu peux ajouter visuals avec les types autorises suivants: ${visualTypes.join(', ')}. Chaque visual doit etre strictement justifie par sourceChunkIds.`
      : 'Ne produis aucun champ visuals.',
    JSON.stringify(toPromptPayload(input, chunks)),
  ].join('\n\n');
}

function normalizeGeneratedQuiz(input: {
  output: GeneratedDiagnosticQuiz;
  chunks: DiagnosticQuizPromptChunk[];
  expectedQuestionCount?: number;
  visualsEnabled: boolean;
  allowedVisualTypes: DiagnosticQuizVisualType[];
  allowedSelectionModes: DiagnosticQuizSelectionMode[];
  metadata: {
    provider: string;
    model: string;
    generationVersion: DiagnosticQuizGenerationVersion;
    inputSize: number;
    fallbackUsed?: boolean;
  };
}): GeneratedDiagnosticQuiz {
  if (
    input.expectedQuestionCount !== undefined &&
    input.output.questions.length !== input.expectedQuestionCount
  ) {
    throw new Error(QUESTION_COUNT_INVALID_ERROR_CODE);
  }

  const metadata = {
    flowName: FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    promptVersion: input.metadata.generationVersion,
    schemaVersion: input.metadata.generationVersion,
    inputSize: input.metadata.inputSize,
    fallbackUsed: input.metadata.fallbackUsed === true,
  };

  if (input.chunks.length === 0) {
    return {
      ...input.output,
      metadata,
    };
  }

  const knownChunkIds = new Set(input.chunks.map((chunk) => chunk.id));

  return {
    title: input.output.title,
    version: shouldUseV3(input.output, input) ? 3 : 2,
    questions: input.output.questions.map((question) =>
      normalizeSourcedQuestion(question, {
        knownChunkIds,
        visualsEnabled: input.visualsEnabled,
        allowedVisualTypes: input.allowedVisualTypes,
        allowedSelectionModes: input.allowedSelectionModes,
      }),
    ),
    metadata,
  };
}

type DiagnosticQuizGenerationVersion =
  | typeof DIAGNOSTIC_QUIZ_V2_VERSION
  | typeof DIAGNOSTIC_QUIZ_V3_VERSION;

function resolveDiagnosticQuizGenerationVersion(
  input: DiagnosticQuizGenerationInput,
): DiagnosticQuizGenerationVersion {
  const selectionModes = resolveAllowedSelectionModes(input.selectionModes);

  if (
    input.visualsEnabled === true ||
    (input.visualTypes ?? []).length > 0 ||
    selectionModes.includes('multiple')
  ) {
    return DIAGNOSTIC_QUIZ_V3_VERSION;
  }

  return DIAGNOSTIC_QUIZ_V2_VERSION;
}

function normalizeSourcedQuestion(
  question: GeneratedDiagnosticQuizQuestion,
  input: {
    knownChunkIds: Set<string>;
    visualsEnabled: boolean;
    allowedVisualTypes: DiagnosticQuizVisualType[];
    allowedSelectionModes: DiagnosticQuizSelectionMode[];
  },
): GeneratedDiagnosticQuizQuestion {
  const selectionMode = question.selectionMode ?? 'single';

  if (!input.allowedSelectionModes.includes(selectionMode)) {
    throw new Error(MULTI_ANSWER_INVALID_ERROR_CODE);
  }

  const normalizedVisuals = normalizeVisuals(question.visuals, input);
  const normalizedQuestion: GeneratedDiagnosticQuizQuestion = {
    prompt: question.prompt,
    ...(question.difficulty === undefined
      ? {}
      : { difficulty: question.difficulty }),
    choices: question.choices.map(normalizeChoice),
    explanation: question.explanation,
    sourceChunkIds: normalizeSourceChunkIds(
      question.sourceChunkIds,
      input.knownChunkIds,
      SOURCE_INVALID_ERROR_CODE,
    ),
    ...(question.selectionMode === undefined
      ? {}
      : { selectionMode: question.selectionMode }),
    ...(normalizedVisuals.length > 0 ? { visuals: normalizedVisuals } : {}),
  };

  if (selectionMode === 'multiple') {
    return normalizeMultipleAnswerQuestion(normalizedQuestion, question);
  }

  return {
    ...normalizedQuestion,
    correctChoiceId: question.correctChoiceId ?? null,
  };
}

function normalizeMultipleAnswerQuestion(
  baseQuestion: GeneratedDiagnosticQuizQuestion,
  question: GeneratedDiagnosticQuizQuestion,
): GeneratedDiagnosticQuizQuestion {
  const correctChoiceIds = dedupeStrings(question.correctChoiceIds ?? []);
  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  const minSelections = question.minSelections ?? 1;
  const maxSelections = question.maxSelections ?? correctChoiceIds.length;

  if (
    correctChoiceIds.length === 0 ||
    correctChoiceIds.some((choiceId) => !choiceIds.has(choiceId)) ||
    minSelections < 1 ||
    maxSelections < minSelections ||
    maxSelections > question.choices.length
  ) {
    throw new Error(MULTI_ANSWER_INVALID_ERROR_CODE);
  }

  return {
    ...baseQuestion,
    selectionMode: 'multiple',
    correctChoiceIds,
    minSelections,
    maxSelections,
  };
}

function normalizeChoice(
  choice: GeneratedDiagnosticQuizChoice,
): GeneratedDiagnosticQuizChoice {
  if (choice.feedback === undefined) {
    return {
      id: choice.id,
      label: choice.label,
    };
  }

  return {
    id: choice.id,
    label: choice.label,
    feedback: choice.feedback ?? null,
  };
}

function normalizeSourceChunkIds(
  sourceChunkIds: string[] | undefined,
  knownChunkIds: Set<string>,
  errorCode = SOURCE_INVALID_ERROR_CODE,
): string[] {
  const normalized = [...new Set(sourceChunkIds ?? [])];

  if (
    normalized.length === 0 ||
    normalized.some((chunkId) => !knownChunkIds.has(chunkId))
  ) {
    throw new Error(errorCode);
  }

  return normalized;
}

function shouldUseV3(
  output: GeneratedDiagnosticQuiz,
  input: {
    visualsEnabled: boolean;
    allowedSelectionModes: DiagnosticQuizSelectionMode[];
  },
): boolean {
  return (
    input.visualsEnabled ||
    input.allowedSelectionModes.includes('multiple') ||
    output.questions.some(
      (question) =>
        question.selectionMode === 'multiple' ||
        (question.visuals ?? []).length > 0,
    )
  );
}

function buildDiagnosticQuizContextLog(input: {
  input: DiagnosticQuizGenerationInput;
  chunks: DiagnosticQuizPromptChunk[];
  metadata: ResolvedGenkitMetadata;
  generationVersion: DiagnosticQuizGenerationVersion;
  inputSize: number;
  allowedSelectionModes: DiagnosticQuizSelectionMode[];
  allowedVisualTypes: DiagnosticQuizVisualType[];
}) {
  return {
    event: 'diagnostic.quiz.generation.context',
    flowName: FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    generationVersion: input.generationVersion,
    requestedQuestionCount: resolveDiagnosticQuizQuestionCount(
      input.input.questionCount,
    ),
    explicitQuestionCount: input.input.questionCount !== undefined,
    hasSourcedContext: input.chunks.length > 0,
    providedChunkCount: input.input.chunks?.length ?? 0,
    selectedChunkCount: input.chunks.length,
    selectedChunkCharCount: input.chunks.reduce(
      (total, chunk) => total + chunk.text.length,
      0,
    ),
    knowledgeUnitSourceCount:
      input.input.knowledgeUnit.sourceChunkIds?.length ?? 0,
    requestedSelectionModes: input.allowedSelectionModes,
    requestedVisualTypes: input.allowedVisualTypes,
    visualsEnabled: input.input.visualsEnabled === true,
    inputSize: input.inputSize,
    documentId: input.input.documentId ?? undefined,
    correlationId: input.input.correlationId,
    subjectId: input.input.subjectId ?? input.input.knowledgeUnit.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
  };
}

function buildDiagnosticQuizOutputLog(input: {
  input: DiagnosticQuizGenerationInput;
  quiz: GeneratedDiagnosticQuiz;
  metadata: ResolvedGenkitMetadata;
  generationVersion: DiagnosticQuizGenerationVersion;
}) {
  const summary = summarizeDiagnosticQuizOutput(input.quiz);

  return {
    event: 'diagnostic.quiz.generation.output',
    flowName: FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    generationVersion: input.generationVersion,
    outputVersion: input.quiz.version ?? null,
    outputQuestionCount: input.quiz.questions.length,
    difficultyCounts: summary.difficultyCounts,
    selectionModeCounts: summary.selectionModeCounts,
    visualCounts: summary.visualCounts,
    sourcedQuestionCount: summary.sourcedQuestionCount,
    visualQuestionCount: summary.visualQuestionCount,
    basicPromptHeuristicCount: summary.basicPromptHeuristicCount,
    documentId: input.input.documentId ?? undefined,
    correlationId: input.input.correlationId,
    subjectId: input.input.subjectId ?? input.input.knowledgeUnit.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
  };
}

function buildDiagnosticQuizRawOutputLog(input: {
  metadata: ResolvedGenkitMetadata;
  correlationId?: string;
  output: unknown;
}) {
  const serialized = serializeDiagnosticValue(input.output);
  const preview = serializeDiagnosticValue(
    summarizeDiagnosticPayloadForPreview(input.output),
  );

  return {
    event: 'diagnostic.quiz.genkit.raw_output',
    flowName: FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    correlationId: input.correlationId,
    outputKind: diagnosticValueKind(input.output),
    outputLength: serialized.length,
    outputHash: hashDiagnosticText(serialized),
    outputPreview: previewDiagnosticText(preview),
  };
}

function buildOpenAiCompatibleProviderResponseLog(input: {
  metadata: ResolvedOpenAiCompatibleProvider;
  correlationId?: string;
  httpStatus: number;
  payload: unknown;
  content: string | null;
  providerErrorCode?: string;
}) {
  const payloadSerialized = serializeDiagnosticValue(input.payload);
  const content = input.content ?? '';
  const choices = isRecord(input.payload)
    ? input.payload['choices']
    : undefined;
  const preview =
    content.length > 0
      ? serializeDiagnosticValue(
          summarizeDiagnosticPayloadForPreview(
            parseJsonIfPossible(stripMarkdownJsonFence(content.trim())),
          ),
        )
      : '';

  return {
    event: 'diagnostic.quiz.openai_compatible.response',
    flowName: FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    correlationId: input.correlationId,
    httpStatus: input.httpStatus,
    providerErrorCode: input.providerErrorCode,
    payloadKind: diagnosticValueKind(input.payload),
    payloadLength: payloadSerialized.length,
    payloadHash: hashDiagnosticText(payloadSerialized),
    choiceCount: Array.isArray(choices) ? choices.length : 0,
    contentLength: content.length,
    contentHash: content.length > 0 ? hashDiagnosticText(content) : null,
    contentPreview: content.length > 0 ? previewDiagnosticText(preview) : '',
  };
}

function buildDiagnosticQuizErrorLog(input: {
  input: DiagnosticQuizGenerationInput;
  metadata: ResolvedGenkitMetadata;
  generationVersion: DiagnosticQuizGenerationVersion;
  errorCode: string;
  diagnostics: ReturnType<typeof buildAiErrorDiagnostics>;
}) {
  return {
    event: 'diagnostic.quiz.generation.error',
    flowName: FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    generationVersion: input.generationVersion,
    errorCode: input.errorCode,
    errorCategory: input.diagnostics.errorCategory,
    errorName: input.diagnostics.errorName,
    errorStatus: input.diagnostics.errorStatus,
    errorProviderCode: input.diagnostics.errorProviderCode,
    errorSummary: input.diagnostics.errorSummary,
    documentId: input.input.documentId ?? undefined,
    correlationId: input.input.correlationId,
    subjectId: input.input.subjectId ?? input.input.knowledgeUnit.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
  };
}

function summarizeDiagnosticQuizOutput(quiz: GeneratedDiagnosticQuiz) {
  const difficultyCounts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    UNKNOWN: 0,
  };
  const selectionModeCounts = {
    single: 0,
    multiple: 0,
  };
  const visualCounts = {
    CHART: 0,
    DIAGRAM: 0,
  };
  let sourcedQuestionCount = 0;
  let visualQuestionCount = 0;
  let basicPromptHeuristicCount = 0;

  for (const question of quiz.questions) {
    const difficulty = question.difficulty ?? 'UNKNOWN';
    difficultyCounts[difficulty] += 1;

    const selectionMode = question.selectionMode ?? 'single';
    selectionModeCounts[selectionMode] += 1;

    if ((question.sourceChunkIds ?? []).length > 0) {
      sourcedQuestionCount += 1;
    }

    if ((question.visuals ?? []).length > 0) {
      visualQuestionCount += 1;
    }

    if (isLikelyBasicQuestion(question.prompt)) {
      basicPromptHeuristicCount += 1;
    }

    for (const visual of question.visuals ?? []) {
      if (visual.type === 'CHART' || visual.type === 'DIAGRAM') {
        visualCounts[visual.type] += 1;
      }
    }
  }

  return {
    difficultyCounts,
    selectionModeCounts,
    visualCounts,
    sourcedQuestionCount,
    visualQuestionCount,
    basicPromptHeuristicCount,
  };
}

function serializeDiagnosticValue(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : String(value);
  } catch {
    return String(value);
  }
}

function parseJsonIfPossible(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function summarizeDiagnosticPayloadForPreview(value: unknown): unknown {
  const unwrapped = unwrapOpenAiCompatibleQuizPayload(value);
  if (!isRecord(unwrapped)) {
    return {
      kind: diagnosticValueKind(unwrapped),
      length: typeof unwrapped === 'string' ? unwrapped.length : undefined,
    };
  }

  const questions = Array.isArray(unwrapped['questions'])
    ? unwrapped['questions']
    : [];
  const firstQuestion = questions.find(isRecord);
  const choices =
    firstQuestion && Array.isArray(firstQuestion['choices'])
      ? firstQuestion['choices']
      : [];
  const visuals =
    firstQuestion && Array.isArray(firstQuestion['visuals'])
      ? firstQuestion['visuals']
      : [];
  const sourceChunkIds =
    firstQuestion && Array.isArray(firstQuestion['sourceChunkIds'])
      ? firstQuestion['sourceChunkIds']
      : [];

  return {
    kind: 'object',
    topLevelKeys: Object.keys(unwrapped).slice(0, 12),
    questionCount: questions.length,
    firstQuestion: firstQuestion
      ? {
          promptLength:
            typeof firstQuestion['prompt'] === 'string'
              ? firstQuestion['prompt'].length
              : undefined,
          explanationLength:
            typeof firstQuestion['explanation'] === 'string'
              ? firstQuestion['explanation'].length
              : undefined,
          difficulty:
            typeof firstQuestion['difficulty'] === 'string'
              ? firstQuestion['difficulty']
              : undefined,
          selectionMode:
            typeof firstQuestion['selectionMode'] === 'string'
              ? firstQuestion['selectionMode']
              : undefined,
          choiceCount: choices.length,
          visualCount: visuals.length,
          sourceChunkCount: sourceChunkIds.length,
        }
      : null,
  };
}

function diagnosticValueKind(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function previewDiagnosticText(value: string): string {
  const limit = resolveAiResponsePreviewChars();
  if (limit <= 0) {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function hashDiagnosticText(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function resolveAiResponsePreviewChars(): number {
  const parsed = Number(process.env[AI_RESPONSE_PREVIEW_CHARS_ENV]);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_AI_RESPONSE_PREVIEW_CHARS;
  }

  return Math.min(parsed, MAX_AI_RESPONSE_PREVIEW_CHARS);
}

function isLikelyBasicQuestion(prompt: string): boolean {
  const normalized = prompt
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

  return [
    /^qui\b/,
    /^quand\b/,
    /^quel auteur\b/,
    /^quelle date\b/,
    /^quel est le nom\b/,
    /^comment s appelle\b/,
    /^quelle est la definition\b/,
    /^quel terme designe\b/,
  ].some((pattern) => pattern.test(normalized));
}

function resolveAllowedSelectionModes(
  selectionModes: DiagnosticQuizSelectionMode[] | undefined,
): DiagnosticQuizSelectionMode[] {
  const modes = selectionModes?.length ? selectionModes : ['single'];
  const allowed = modes.filter(
    (mode): mode is DiagnosticQuizSelectionMode =>
      mode === 'single' || mode === 'multiple',
  );

  return allowed.length > 0 ? dedupeStrings(allowed) : ['single'];
}

function resolveAllowedVisualTypes(
  input: DiagnosticQuizGenerationInput,
): DiagnosticQuizVisualType[] {
  if (input.visualsEnabled !== true) {
    return [];
  }

  const visualTypes = (input.visualTypes ?? []).filter(
    (type): type is DiagnosticQuizVisualType =>
      type === 'CHART' || type === 'DIAGRAM',
  );

  return dedupeStrings(visualTypes);
}

function dedupeStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeVisuals(
  visuals: GeneratedDiagnosticQuizVisual[] | undefined,
  input: {
    knownChunkIds: Set<string>;
    visualsEnabled: boolean;
    allowedVisualTypes: DiagnosticQuizVisualType[];
  },
): GeneratedDiagnosticQuizVisual[] {
  if (!visuals || visuals.length === 0) {
    return [];
  }

  if (!input.visualsEnabled) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  return visuals.map((visual, index) =>
    normalizeVisual(visual, {
      ...input,
      fallbackDisplayOrder: index,
    }),
  );
}

function normalizeVisual(
  visual: GeneratedDiagnosticQuizVisual,
  input: {
    knownChunkIds: Set<string>;
    allowedVisualTypes: DiagnosticQuizVisualType[];
    fallbackDisplayOrder: number;
  },
): GeneratedDiagnosticQuizVisual {
  if (
    !input.allowedVisualTypes.includes(visual.type) ||
    visual.type === 'IMAGE'
  ) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  const sourceChunkIds = normalizeSourceChunkIds(
    visual.sourceChunkIds,
    input.knownChunkIds,
    VISUAL_INVALID_ERROR_CODE,
  );
  const displayOrder = visual.displayOrder ?? input.fallbackDisplayOrder;

  if (visual.type === 'CHART') {
    return normalizeChartVisual(visual, sourceChunkIds, displayOrder);
  }

  return normalizeDiagramVisual(visual, sourceChunkIds, displayOrder);
}

function normalizeChartVisual(
  visual: GeneratedDiagnosticQuizChartVisual,
  sourceChunkIds: string[],
  displayOrder: number,
): GeneratedDiagnosticQuizChartVisual {
  const keys = new Set<string>();

  for (const row of visual.data) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }

  if (keys.size === 0 || keys.size > MAX_CHART_KEYS) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  if (visual.xKey && !keys.has(visual.xKey)) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  if (visual.yKeys?.some((key) => !keys.has(key))) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  return {
    type: 'CHART',
    displayOrder,
    chartType: visual.chartType,
    title: visual.title,
    ...(visual.description === undefined
      ? {}
      : { description: visual.description ?? null }),
    data: visual.data,
    ...(visual.xKey === undefined ? {} : { xKey: visual.xKey ?? null }),
    ...(visual.yKeys === undefined ? {} : { yKeys: visual.yKeys ?? null }),
    sourceChunkIds,
  };
}

function normalizeDiagramVisual(
  visual: GeneratedDiagnosticQuizDiagramVisual,
  sourceChunkIds: string[],
  displayOrder: number,
): GeneratedDiagnosticQuizDiagramVisual {
  const nodeIds = new Set(visual.nodes.map((node) => node.id));

  if (nodeIds.size !== visual.nodes.length) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  if (
    (visual.edges ?? []).some(
      (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to),
    )
  ) {
    throw new Error(VISUAL_INVALID_ERROR_CODE);
  }

  return {
    type: 'DIAGRAM',
    displayOrder,
    title: visual.title,
    ...(visual.description === undefined
      ? {}
      : { description: visual.description ?? null }),
    nodes: visual.nodes,
    ...(visual.edges === undefined ? {} : { edges: visual.edges }),
    sourceChunkIds,
  };
}

function selectDiagnosticQuizChunks(
  input: DiagnosticQuizGenerationInput,
): DiagnosticQuizPromptChunk[] {
  const chunks = deduplicateChunks(input.chunks ?? []);
  const sourceChunkIds = new Set(input.knowledgeUnit.sourceChunkIds ?? []);
  const prioritizedChunks = [
    ...chunks.filter((chunk) => sourceChunkIds.has(chunk.id)),
    ...chunks.filter((chunk) => !sourceChunkIds.has(chunk.id)),
  ];
  const maxChunks = resolvePositiveInteger(
    process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHUNKS,
    DEFAULT_MAX_CHUNKS,
  );
  let remainingChars = resolvePositiveInteger(
    process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHARS,
    DEFAULT_MAX_CHARS,
  );

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
): DiagnosticQuizPromptChunk[] {
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

function toPromptPayload(
  input: DiagnosticQuizGenerationInput,
  chunks: DiagnosticQuizPromptChunk[],
) {
  return {
    documentId: input.documentId ?? null,
    subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
    capabilities: {
      selectionModes: resolveAllowedSelectionModes(input.selectionModes),
      visualTypes: resolveAllowedVisualTypes(input),
    },
    knowledgeUnit: {
      id: input.knowledgeUnit.id,
      title: input.knowledgeUnit.title,
      summary: input.knowledgeUnit.summary,
      difficulty: input.knowledgeUnit.difficulty ?? null,
      sourceChunkIds: input.knowledgeUnit.sourceChunkIds ?? [],
    },
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      pageNumber: chunk.pageNumber ?? null,
      text: chunk.text,
    })),
  };
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveGenkitMetadata(): ResolvedGenkitMetadata {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (isOpenAiCompatibleProvider(provider)) {
    const openAiCompatibleProvider = resolveOpenAiCompatibleProvider(provider);

    return {
      provider: openAiCompatibleProvider.provider,
      model: openAiCompatibleProvider.model,
      openAiCompatible: openAiCompatibleProvider,
    };
  }

  if (!hasGoogleGenaiApiKey() && hasOpenAiCompatibleApiKey(MISTRAL_PROVIDER)) {
    const openAiCompatibleProvider =
      resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER);

    return {
      provider: openAiCompatibleProvider.provider,
      model: openAiCompatibleProvider.model,
      openAiCompatible: openAiCompatibleProvider,
    };
  }

  if (
    !hasGoogleGenaiApiKey() &&
    !hasOpenAiCompatibleApiKey(MISTRAL_PROVIDER) &&
    hasOpenAiCompatibleApiKey(MIMO_PROVIDER)
  ) {
    const openAiCompatibleProvider =
      resolveOpenAiCompatibleProvider(MIMO_PROVIDER);

    return {
      provider: openAiCompatibleProvider.provider,
      model: openAiCompatibleProvider.model,
      openAiCompatible: openAiCompatibleProvider,
    };
  }

  return {
    provider: GOOGLE_PROVIDER,
    model: process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL,
  };
}

function resolveDiagnosticQuizFallbackMetadata(
  metadata: ResolvedGenkitMetadata,
): ResolvedGenkitMetadata | null {
  if (!metadata.openAiCompatible) {
    return resolveDiagnosticMistralFallbackMetadata();
  }

  if (metadata.provider === MIMO_PROVIDER) {
    return resolveDiagnosticMistralFallbackMetadata();
  }

  if (metadata.provider !== MISTRAL_PROVIDER) {
    return null;
  }

  const fallbackModel = resolveMistralFallbackModel({
    primaryModel: metadata.model,
    specificFallbackEnv: 'MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL',
  });

  if (!fallbackModel) {
    return null;
  }

  return {
    ...metadata,
    model: fallbackModel,
    openAiCompatible: {
      ...metadata.openAiCompatible,
      model: fallbackModel,
    },
  };
}

function resolveDiagnosticMistralFallbackMetadata(): ResolvedGenkitMetadata | null {
  if (!hasValue(process.env.MISTRAL_API_KEY)) {
    return null;
  }

  const fallbackModel =
    process.env.MISTRAL_DIAGNOSTIC_QUIZ_FALLBACK_MODEL?.trim() ||
    process.env.MISTRAL_FALLBACK_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER).model;

  const openAiCompatibleProvider =
    resolveOpenAiCompatibleProvider(MISTRAL_PROVIDER);
  const normalizedFallbackModel = normalizeMistralModelName(fallbackModel);

  return {
    provider: MISTRAL_PROVIDER,
    model: normalizedFallbackModel,
    openAiCompatible: {
      ...openAiCompatibleProvider,
      model: normalizedFallbackModel,
    },
  };
}

function hasGoogleGenaiApiKey(): boolean {
  return (
    hasValue(process.env.GOOGLE_GENAI_API_KEY) ||
    hasValue(process.env.GEMINI_API_KEY) ||
    hasValue(process.env.GOOGLE_API_KEY)
  );
}

function resolveGenkitConfig(
  metadata: ResolvedGenkitMetadata,
): ResolvedGenkitConfig {
  if (metadata.openAiCompatible) {
    return {
      config: {
        plugins: [createOpenAiCompatiblePlugin(metadata.openAiCompatible)],
        model: metadata.model,
      },
      provider: metadata.provider,
      model: metadata.model,
    };
  }

  return {
    config: {
      plugins: [googleAI()],
      model: metadata.model,
    },
    provider: metadata.provider,
    model: metadata.model,
  };
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveDiagnosticQuizGenerationErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === 'Generated diagnostic quiz is empty'
  ) {
    return EMPTY_OUTPUT_ERROR_CODE;
  }

  if (error instanceof Error && error.message === SOURCE_INVALID_ERROR_CODE) {
    return SOURCE_INVALID_ERROR_CODE;
  }

  if (error instanceof Error && error.message === VISUAL_INVALID_ERROR_CODE) {
    return VISUAL_INVALID_ERROR_CODE;
  }

  if (
    error instanceof Error &&
    error.message === MULTI_ANSWER_INVALID_ERROR_CODE
  ) {
    return MULTI_ANSWER_INVALID_ERROR_CODE;
  }

  if (
    error instanceof Error &&
    error.message === QUESTION_COUNT_INVALID_ERROR_CODE
  ) {
    return QUESTION_COUNT_INVALID_ERROR_CODE;
  }

  return GENERATION_FAILED_ERROR_CODE;
}
