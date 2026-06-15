import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type {
  DiagnosticQuizActivity,
  OpenQuestionActivity,
} from '../../activities/application/activities.repository';
import { selectDeterministicRevisionSessionAction } from '../domain/deterministic-revision-session-action-selector';
import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';
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

    const coachInput = toCoachInput(input.studentId, context);
    const decision = await this.resolveDecision(coachInput);
    const activity = await this.createActivity({
      studentId: input.studentId,
      subjectId: context.session.subjectId,
      decision,
    });
    const response = await this.revisionSessionsRepository.appendAction({
      studentId: input.studentId,
      sessionId: input.sessionId,
      action: {
        kind: decision.actionKind,
        status: 'READY',
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? context.session.documentId,
        knowledgeUnitId:
          decision.actionKind === 'OPEN_QUESTION'
            ? decision.knowledgeUnitId
            : decision.knowledgeUnitId,
      },
    });

    return {
      ...response,
      currentAction: response.currentAction
        ? {
            ...response.currentAction,
            payload: activity,
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

  private async createActivity(input: {
    studentId: string;
    subjectId: string;
    decision: RevisionCoachNextActionDecision;
  }): Promise<DiagnosticQuizActivity | OpenQuestionActivity> {
    if (input.decision.actionKind === 'OPEN_QUESTION') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      return this.startOpenQuestionActivity.execute({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      });
    }

    return this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: input.decision.knowledgeUnitId ?? undefined,
    });
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
      ? (['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION'] as const)
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
    decision.actionKind === 'OPEN_QUESTION' &&
    (decision.knowledgeUnitId === null ||
      !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId))
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  return decision;
}
