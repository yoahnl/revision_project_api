import { Inject, Injectable } from '@nestjs/common';
import openAICompatible from '@genkit-ai/compat-oai';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit, z } from 'genkit';
import type {
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationInput,
  DiagnosticQuizGenerator,
  GeneratedDiagnosticQuiz,
  GeneratedDiagnosticQuizChoice,
  GeneratedDiagnosticQuizQuestion,
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
  normalizeMistralModelName,
  resolveMistralFallbackModel,
} from '../../ai/infrastructure/mistral-model-fallback';

const MISTRAL_PLUGIN_NAME = 'mistral';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
const FLOW_NAME = 'diagnosticQuizGeneration';
const GOOGLE_PROVIDER = 'google-genai';
const MISTRAL_PROVIDER = 'mistral';
const PROMPT_VERSION = 'diagnostic-quiz-v2';
const SCHEMA_VERSION = 'diagnostic-quiz-v2';
const GENERATION_FAILED_ERROR_CODE = 'GENKIT_GENERATION_FAILED';
const EMPTY_OUTPUT_ERROR_CODE = 'GENKIT_EMPTY_OUTPUT';
const SOURCE_INVALID_ERROR_CODE = 'DIAGNOSTIC_QUIZ_SOURCE_INVALID';
const QUESTION_COUNT_INVALID_ERROR_CODE =
  DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID;
const DEFAULT_MAX_CHUNKS = 8;
const DEFAULT_MAX_CHARS = 8000;
const MAX_QUESTION_COUNT = DEFAULT_DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT;

const NonEmptyStringSchema = z.string().trim().min(1);
const DiagnosticQuizDifficultySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const GeneratedDiagnosticQuizChoiceSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    feedback: NonEmptyStringSchema.nullish(),
  })
  .strict();

const GeneratedDiagnosticQuizQuestionSchema = z
  .object({
    prompt: z.string().min(8),
    difficulty: DiagnosticQuizDifficultySchema.nullish(),
    choices: z.array(GeneratedDiagnosticQuizChoiceSchema).min(2).max(4),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().min(8),
    sourceChunkIds: z.array(NonEmptyStringSchema).optional(),
  })
  .strict()
  .refine(
    (question) =>
      new Set(question.choices.map((choice) => choice.id)).size ===
        question.choices.length &&
      question.choices.some((choice) => choice.id === question.correctChoiceId),
    {
      message:
        'Question choices must be unique and include the correct choice id',
    },
  );

const GeneratedDiagnosticQuizSchema = z
  .object({
    title: z.string().min(2),
    questions: z
      .array(GeneratedDiagnosticQuizQuestionSchema)
      .min(1)
      .max(MAX_QUESTION_COUNT),
  })
  .strict();

@Injectable()
export class GenkitDiagnosticQuizGenerator implements DiagnosticQuizGenerator {
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
      resolveDiagnosticQuizMistralFallbackMetadata(primaryMetadata);
    const attempts = fallbackMetadata
      ? [primaryMetadata, fallbackMetadata]
      : [primaryMetadata];
    const chunks = selectDiagnosticQuizChunks(input);
    const prompt = buildPrompt(input, chunks);
    const inputSize = prompt.length;

    for (const [index, metadata] of attempts.entries()) {
      const startedAt = Date.now();

      try {
        const { output } = await this.getAi(metadata).generate({
          prompt,
          output: {
            schema: GeneratedDiagnosticQuizSchema,
          },
        });

        if (!output) {
          throw new Error('Generated diagnostic quiz is empty');
        }

        const quiz = normalizeGeneratedQuiz({
          output: GeneratedDiagnosticQuizSchema.parse(output),
          chunks,
          expectedQuestionCount: input.questionCount,
          metadata: {
            provider: metadata.provider,
            model: metadata.model,
            inputSize,
          },
        });

        this.observer.observe({
          flowName: FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: PROMPT_VERSION,
          schemaVersion: SCHEMA_VERSION,
          inputSize,
          durationMs: Date.now() - startedAt,
          status: 'success',
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
          documentId: input.documentId ?? undefined,
        });

        return quiz;
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
          errorCode: resolveDiagnosticQuizGenerationErrorCode(error),
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId ?? input.knowledgeUnit.subjectId,
          documentId: input.documentId ?? undefined,
        });

        if (
          index === 0 &&
          attempts.length > 1 &&
          isInvalidAiOutputError(error, [
            SOURCE_INVALID_ERROR_CODE,
            QUESTION_COUNT_INVALID_ERROR_CODE,
            'Generated diagnostic quiz is empty',
          ])
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(GENERATION_FAILED_ERROR_CODE);
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

type ResolvedGenkitMetadata = {
  provider: string;
  model: string;
  useMistral: boolean;
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
  const basePrompt = [
    'Tu es un tuteur universitaire qui genere un QCM de revision en francais.',
    'Genere le QCM exclusivement a partir de l unite de connaissance et des chunks fournis.',
    'N ajoute aucun sujet externe, aucun exemple generique et aucune question hors cours.',
    'Le QCM est mono-reponse: chaque question a un seul correctChoiceId.',
    'Les distracteurs doivent etre plausibles mais faux, distincts et non ambigus.',
    'Chaque explication doit rester fondee sur le cours fourni.',
    `Genere exactement ${questionCount} questions.`,
    'Les questions doivent etre variees, non redondantes et couvrir plusieurs angles de la notion quand les sources le permettent.',
    'Si les sources ne permettent pas un QCM fiable, retourne uniquement des questions strictement justifiables par le cours.',
    'Retourne uniquement du JSON strict respectant le schema demande.',
    'Champs attendus: title, questions, prompt, difficulty, choices, correctChoiceId, explanation, sourceChunkIds.',
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
    JSON.stringify(toPromptPayload(input, chunks)),
  ].join('\n\n');
}

function normalizeGeneratedQuiz(input: {
  output: GeneratedDiagnosticQuiz;
  chunks: DiagnosticQuizPromptChunk[];
  expectedQuestionCount?: number;
  metadata: {
    provider: string;
    model: string;
    inputSize: number;
  };
}): GeneratedDiagnosticQuiz {
  if (
    input.expectedQuestionCount !== undefined &&
    input.output.questions.length !== input.expectedQuestionCount
  ) {
    throw new Error(QUESTION_COUNT_INVALID_ERROR_CODE);
  }

  if (input.chunks.length === 0) {
    return input.output;
  }

  const knownChunkIds = new Set(input.chunks.map((chunk) => chunk.id));

  return {
    title: input.output.title,
    version: 2,
    questions: input.output.questions.map((question) =>
      normalizeSourcedQuestion(question, knownChunkIds),
    ),
    metadata: {
      flowName: FLOW_NAME,
      provider: input.metadata.provider,
      model: input.metadata.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      inputSize: input.metadata.inputSize,
    },
  };
}

function normalizeSourcedQuestion(
  question: GeneratedDiagnosticQuizQuestion,
  knownChunkIds: Set<string>,
): GeneratedDiagnosticQuizQuestion {
  return {
    prompt: question.prompt,
    ...(question.difficulty === undefined
      ? {}
      : { difficulty: question.difficulty }),
    choices: question.choices.map(normalizeChoice),
    correctChoiceId: question.correctChoiceId,
    explanation: question.explanation,
    sourceChunkIds: normalizeSourceChunkIds(
      question.sourceChunkIds,
      knownChunkIds,
    ),
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
): string[] {
  const normalized = [...new Set(sourceChunkIds ?? [])];

  if (
    normalized.length === 0 ||
    normalized.some((chunkId) => !knownChunkIds.has(chunkId))
  ) {
    throw new Error(SOURCE_INVALID_ERROR_CODE);
  }

  return normalized;
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
  const maxChars = resolvePositiveInteger(
    process.env.DIAGNOSTIC_QUIZ_GENERATION_MAX_CHARS,
    DEFAULT_MAX_CHARS,
  );
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

  if (
    provider === 'mistral' ||
    (!hasValue(process.env.GOOGLE_GENAI_API_KEY) &&
      hasValue(process.env.MISTRAL_API_KEY))
  ) {
    return {
      provider: MISTRAL_PROVIDER,
      model: resolveMistralModel(),
      useMistral: true,
    };
  }

  return {
    provider: GOOGLE_PROVIDER,
    model: process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL,
    useMistral: false,
  };
}

function resolveDiagnosticQuizMistralFallbackMetadata(
  metadata: ResolvedGenkitMetadata,
): ResolvedGenkitMetadata | null {
  if (!metadata.useMistral) {
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
  };
}

function resolveGenkitConfig(
  metadata: ResolvedGenkitMetadata,
): ResolvedGenkitConfig {
  if (metadata.useMistral) {
    return {
      config: {
        plugins: [
          openAICompatible({
            name: MISTRAL_PLUGIN_NAME,
            apiKey: resolveMistralApiKey(),
            baseURL: MISTRAL_BASE_URL,
          }),
        ],
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

  return normalizeMistralModelName(model);
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

  if (
    error instanceof Error &&
    error.message === QUESTION_COUNT_INVALID_ERROR_CODE
  ) {
    return QUESTION_COUNT_INVALID_ERROR_CODE;
  }

  return GENERATION_FAILED_ERROR_CODE;
}
