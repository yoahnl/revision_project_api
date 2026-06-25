import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import { selectDeterministicRevisionSessionAction } from '../domain/deterministic-revision-session-action-selector';
import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';
import type {
  RevisionSessionActionPayload,
  RevisionSessionResponseDto,
  RevisionSessionRichClosedExercisePayload,
} from '../domain/revision-session.entity';
import {
  REVISION_COACH_NEXT_ACTION_GENERATOR,
  type RevisionCoachNextActionGenerator,
} from './revision-coach-next-action.generator';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionPlanningContext,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class RequestNextRevisionSessionActionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    @Inject(REVISION_COACH_NEXT_ACTION_GENERATOR)
    private readonly revisionCoachNextActionGenerator: RevisionCoachNextActionGenerator,
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const context =
      await this.revisionSessionsRepository.findPlanningContextByIdForStudent(
        input,
      );

    if (context.session.status !== 'STARTED') {
      throw new Error('Revision session is not started');
    }

    if (context.session.mode === 'QUICK' && context.session.courseId !== null) {
      throw new Error(
        'Quick course revision sessions do not support next actions',
      );
    }

    if (context.session.mode === 'DEEP') {
      throw new Error('Deep revision sessions do not support next actions');
    }

    const coachInput = toCoachInput(input.studentId, context);
    const decision = await this.resolveDecision(coachInput);
    const actionPayload = await this.createActionPayload({
      studentId: input.studentId,
      subjectId: context.session.subjectId,
      sessionDocumentId: context.session.documentId,
      context,
      decision,
    });
    const response = await this.revisionSessionsRepository.appendAction({
      studentId: input.studentId,
      sessionId: input.sessionId,
      action: {
        kind: decision.actionKind,
        status: 'READY',
        activitySessionId: actionPayload.activitySessionId,
        documentId: actionPayload.documentId,
        knowledgeUnitId: actionPayload.knowledgeUnitId,
      },
    });

    return {
      ...response,
      currentAction: response.currentAction
        ? {
            ...response.currentAction,
            payload: actionPayload.payload,
          }
        : null,
    };
  }

  private async resolveDecision(
    input: RevisionCoachNextActionInput,
  ): Promise<RevisionCoachNextActionDecision> {
    try {
      return normalizeDecision(
        await this.revisionCoachNextActionGenerator.generate(input),
        input,
      );
    } catch {
      return selectDeterministicRevisionSessionAction(input);
    }
  }

  private async createActionPayload(input: {
    studentId: string;
    subjectId: string;
    sessionDocumentId: string | null;
    context: RevisionSessionPlanningContext;
    decision: RevisionCoachNextActionDecision;
  }): Promise<{
    payload: RevisionSessionActionPayload;
    activitySessionId: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
  }> {
    if (input.decision.actionKind === 'OPEN_QUESTION') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      const activity = await this.startOpenQuestionActivity.execute({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      });

      return {
        payload: activity,
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? input.sessionDocumentId,
        knowledgeUnitId: activity.knowledgeUnitId,
      };
    }

    if (input.decision.actionKind === 'RICH_CLOSED_EXERCISE') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      const knowledgeUnit = input.context.allowedKnowledgeUnits.find(
        (unit) => unit.id === input.decision.knowledgeUnitId,
      );
      const documentId = knowledgeUnit?.documentId ?? input.sessionDocumentId;

      return {
        payload: createRichClosedExercisePayload({
          subjectId: input.subjectId,
          documentId,
          knowledgeUnitId: input.decision.knowledgeUnitId,
          knowledgeUnitTitle: knowledgeUnit?.title ?? null,
          reasonCode: input.decision.reasonCode,
        }),
        activitySessionId: null,
        documentId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      };
    }

    const courseBoundKnowledgeUnitId =
      input.context.session.courseId !== null
        ? (input.decision.knowledgeUnitId ??
          input.context.session.knowledgeUnitId ??
          input.context.allowedKnowledgeUnitIds[0])
        : input.decision.knowledgeUnitId;

    const activity = await this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: courseBoundKnowledgeUnitId ?? undefined,
    });

    return {
      payload: activity,
      activitySessionId: activity.sessionId,
      documentId: activity.documentId ?? input.sessionDocumentId,
      knowledgeUnitId: courseBoundKnowledgeUnitId ?? null,
    };
  }
}

function toCoachInput(
  studentId: string,
  context: RevisionSessionPlanningContext,
): RevisionCoachNextActionInput {
  const sessionKnowledgeUnitId =
    context.session.knowledgeUnitId &&
    context.allowedKnowledgeUnitIds.includes(context.session.knowledgeUnitId)
      ? context.session.knowledgeUnitId
      : null;
  const availableActions =
    context.allowedKnowledgeUnitIds.length > 0
      ? (['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION', 'RICH_CLOSED_EXERCISE'] as const)
      : (['DIAGNOSTIC_QUIZ'] as const);

  return {
    studentId,
    sessionId: context.session.id,
    subjectId: context.session.subjectId,
    documentId: context.session.documentId,
    sessionKnowledgeUnitId,
    history: context.actions.map((action) => ({
      kind: action.kind,
      status: action.status,
      displayOrder: action.displayOrder,
      activitySessionId: action.activitySessionId,
      knowledgeUnitId:
        action.knowledgeUnitId &&
        context.allowedKnowledgeUnitIds.includes(action.knowledgeUnitId)
          ? action.knowledgeUnitId
          : null,
    })),
    availableActions: [...availableActions],
    allowedKnowledgeUnitIds: [...context.allowedKnowledgeUnitIds],
  };
}

function normalizeDecision(
  decision: RevisionCoachNextActionDecision,
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  if (!input.availableActions.includes(decision.actionKind)) {
    throw new Error('REVISION_COACH_ACTION_NOT_ALLOWED');
  }

  if (
    decision.knowledgeUnitId !== null &&
    !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId)
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  if (
    (decision.actionKind === 'OPEN_QUESTION' ||
      decision.actionKind === 'RICH_CLOSED_EXERCISE') &&
    (decision.knowledgeUnitId === null ||
      !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId))
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  return decision;
}

function createRichClosedExercisePayload(input: {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle: string | null;
  reasonCode: RevisionCoachNextActionDecision['reasonCode'];
}): RevisionSessionRichClosedExercisePayload {
  return {
    type: 'rich_closed_exercise',
    subjectId: input.subjectId,
    documentId: input.documentId,
    knowledgeUnitId: input.knowledgeUnitId,
    knowledgeUnitTitle: input.knowledgeUnitTitle,
    reason: revisionRichClosedReason(input.reasonCode),
    estimatedMinutes: 8,
    preferredAction: 'rich_closed_exercise',
  };
}

function revisionRichClosedReason(
  reasonCode: RevisionCoachNextActionDecision['reasonCode'],
): string {
  return {
    ALTERNATE_ACTIVITY_TYPE:
      'Questions riches recommandées pour varier la révision.',
    REINFORCE_CURRENT_KNOWLEDGE_UNIT:
      'Questions riches recommandées pour consolider cette notion.',
    CHECK_UNDERSTANDING:
      'Questions riches recommandées pour vérifier la compréhension.',
    CONTINUE_SESSION_DEFAULT:
      'Questions riches recommandées pour poursuivre la session.',
  }[reasonCode];
}
