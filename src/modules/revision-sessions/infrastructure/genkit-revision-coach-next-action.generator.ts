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
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';
import type { RevisionCoachNextActionGenerator } from '../application/revision-coach-next-action.generator';

const FLOW_NAME = 'revisionCoachNextAction';
const PROMPT_VERSION = 'revision-coach-next-action-v1';
const SCHEMA_VERSION = 'revision-coach-next-action-v1';
const EMPTY_OUTPUT_ERROR_CODE = 'REVISION_COACH_EMPTY_OUTPUT';
const INVALID_OUTPUT_ERROR_CODE = 'REVISION_COACH_INVALID_OUTPUT';
const ACTION_NOT_ALLOWED_ERROR_CODE = 'REVISION_COACH_ACTION_NOT_ALLOWED';
const KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE =
  'REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED';
const FAILED_ERROR_CODE = 'REVISION_COACH_FAILED';

const RevisionCoachNextActionSchema = z
  .object({
    actionKind: z.enum([
      'DIAGNOSTIC_QUIZ',
      'OPEN_QUESTION',
      'RICH_CLOSED_EXERCISE',
    ]),
    knowledgeUnitId: z.string().trim().min(1).nullable(),
    reasonCode: z.enum([
      'ALTERNATE_ACTIVITY_TYPE',
      'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
      'CHECK_UNDERSTANDING',
      'CONTINUE_SESSION_DEFAULT',
    ]),
  })
  .strict();

@Injectable()
export class GenkitRevisionCoachNextActionGenerator implements RevisionCoachNextActionGenerator {
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedArtifactGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: RevisionCoachNextActionInput,
  ): Promise<RevisionCoachNextActionDecision> {
    const metadata = this.resolveMetadata();
    const prompt = buildRevisionCoachPrompt(input);
    const inputSize = prompt.length;
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi(metadata).generate({
        prompt,
        output: {
          schema: RevisionCoachNextActionSchema,
        },
      });

      if (!output) {
        throw new Error(EMPTY_OUTPUT_ERROR_CODE);
      }

      const parsed = RevisionCoachNextActionSchema.parse(output);
      const decision = normalizeDecision(parsed, input);

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
        knowledgeUnitId: decision.knowledgeUnitId ?? undefined,
        studentId: input.studentId,
      });

      return decision;
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
        errorCode: resolveRevisionCoachErrorCode(error),
        documentId: input.documentId ?? undefined,
        subjectId: input.subjectId,
        knowledgeUnitId: input.sessionKnowledgeUnitId ?? undefined,
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

function buildRevisionCoachPrompt(input: RevisionCoachNextActionInput): string {
  const payload = {
    sessionId: input.sessionId,
    subjectId: input.subjectId,
    documentId: input.documentId,
    sessionKnowledgeUnitId: input.sessionKnowledgeUnitId,
    history: input.history.map((action) => ({
      kind: action.kind,
      status: action.status,
      displayOrder: action.displayOrder,
      activitySessionId: action.activitySessionId,
      knowledgeUnitId: action.knowledgeUnitId,
    })),
    availableActions: input.availableActions,
    allowedKnowledgeUnitIds: input.allowedKnowledgeUnitIds,
  };

  return [
    'Tu es un coach de révision qui choisit uniquement la prochaine intention d’activité.',
    'Tu dois choisir une action strictement parmi availableActions.',
    'RICH_CLOSED_EXERCISE signifie uniquement démarrer le flow rich closed existant côté activities.',
    'Tu ne proposes jamais d’UI, de widget, de composant, de route ou de texte conversationnel.',
    'Tu ne produis jamais de question rich closed, de réponse, de correction, de contenu pédagogique ou de message libre.',
    'Réponds uniquement en JSON strict avec actionKind, knowledgeUnitId et reasonCode.',
    'Si la dernière action était un QCM et qu’une notion autorisée existe, privilégie OPEN_QUESTION.',
    'Si la dernière action était une question ouverte et que RICH_CLOSED_EXERCISE est disponible, tu peux la choisir pour varier la pratique.',
    'Si aucune notion fiable n’est disponible, privilégie DIAGNOSTIC_QUIZ.',
    'N’utilise que les IDs fournis dans allowedKnowledgeUnitIds.',
    JSON.stringify(payload),
  ].join('\n\n');
}

function normalizeDecision(
  decision: z.infer<typeof RevisionCoachNextActionSchema>,
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  if (!input.availableActions.includes(decision.actionKind)) {
    throw new Error(ACTION_NOT_ALLOWED_ERROR_CODE);
  }

  if (
    decision.knowledgeUnitId !== null &&
    !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId)
  ) {
    throw new Error(KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE);
  }

  if (
    (decision.actionKind === 'OPEN_QUESTION' ||
      decision.actionKind === 'RICH_CLOSED_EXERCISE') &&
    (decision.knowledgeUnitId === null ||
      !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId))
  ) {
    throw new Error(KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE);
  }

  return decision;
}

function resolveRevisionCoachErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message === EMPTY_OUTPUT_ERROR_CODE ||
      error.message === ACTION_NOT_ALLOWED_ERROR_CODE ||
      error.message === KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE
    ) {
      return error.message;
    }

    if (error.name === 'ZodError') {
      return INVALID_OUTPUT_ERROR_CODE;
    }
  }

  return FAILED_ERROR_CODE;
}
