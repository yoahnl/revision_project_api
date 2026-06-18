import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionPayload,
  RevisionSessionPreferredAction,
  RevisionSessionRichClosedExercisePayload,
  RevisionSessionResponseDto,
} from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class StartRevisionSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    courseId?: string | null;
    documentId?: string;
    knowledgeUnitId?: string;
    preferredAction?: RevisionSessionPreferredAction;
    questionCount?: number;
  }): Promise<RevisionSessionResponseDto> {
    const actionKind = resolveInitialActionKind(input);

    if (actionKindRequiresKnowledgeUnit(actionKind) && !input.knowledgeUnitId) {
      throw new Error(requiresKnowledgeUnitError(actionKind));
    }

    const context = await this.revisionSessionsRepository.ensureStartContext({
      studentId: input.studentId,
      subjectId: input.subjectId,
      documentId: input.documentId,
      knowledgeUnitId: input.knowledgeUnitId,
    });

    if (actionKind === 'OPEN_QUESTION') {
      const activity = await this.startOpenQuestionActivity.execute({
        studentId: input.studentId,
        subjectId: context.subjectId,
        knowledgeUnitId: input.knowledgeUnitId ?? context.knowledgeUnitId ?? '',
      });

      return this.createSessionWithPayload({
        input,
        context,
        actionKind,
        payload: activity,
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? context.documentId,
        knowledgeUnitId: activity.knowledgeUnitId,
      });
    }

    if (actionKind === 'RICH_CLOSED_EXERCISE') {
      if (!context.knowledgeUnitId) {
        throw new Error(requiresKnowledgeUnitError(actionKind));
      }

      return this.createSessionWithPayload({
        input,
        context,
        actionKind,
        payload: createRichClosedExercisePayload({
          subjectId: context.subjectId,
          documentId: context.documentId,
          knowledgeUnitId: context.knowledgeUnitId,
          knowledgeUnitTitle: context.knowledgeUnitTitle,
        }),
        activitySessionId: null,
        documentId: context.documentId,
        knowledgeUnitId: context.knowledgeUnitId,
      });
    }

    const activity = await this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: context.subjectId,
      knowledgeUnitId: context.knowledgeUnitId ?? undefined,
      ...(input.questionCount !== undefined
        ? { questionCount: input.questionCount }
        : {}),
    });

    return this.createSessionWithPayload({
      input,
      context,
      actionKind,
      payload: activity,
      activitySessionId: activity.sessionId,
      documentId: activity.documentId ?? context.documentId,
      knowledgeUnitId: context.knowledgeUnitId,
    });
  }

  private async createSessionWithPayload(input: {
    input: {
      studentId: string;
      subjectId: string;
      courseId?: string | null;
    };
    context: {
      subjectId: string;
      documentId: string | null;
      knowledgeUnitId: string | null;
      knowledgeUnitTitle?: string | null;
    };
    actionKind: RevisionSessionActionKindValue;
    payload: RevisionSessionActionPayload;
    activitySessionId: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
  }): Promise<RevisionSessionResponseDto> {
    const response =
      await this.revisionSessionsRepository.createWithInitialAction({
        studentId: input.input.studentId,
        subjectId: input.context.subjectId,
        ...(input.input.courseId !== undefined
          ? { courseId: input.input.courseId }
          : {}),
        documentId: input.documentId,
        knowledgeUnitId: input.knowledgeUnitId,
        action: {
          kind: input.actionKind,
          status: 'READY',
          displayOrder: 0,
          activitySessionId: input.activitySessionId,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
        },
      });

    return {
      ...response,
      currentAction: response.currentAction
        ? {
            ...response.currentAction,
            payload: input.payload,
          }
        : null,
    };
  }
}

function resolveInitialActionKind(input: {
  knowledgeUnitId?: string;
  preferredAction?: RevisionSessionPreferredAction;
}): RevisionSessionActionKindValue {
  if (input.preferredAction === 'diagnostic_quiz') {
    return 'DIAGNOSTIC_QUIZ';
  }

  if (input.preferredAction === 'open_question') {
    return 'OPEN_QUESTION';
  }

  if (input.preferredAction === 'rich_closed_exercise') {
    return 'RICH_CLOSED_EXERCISE';
  }

  return input.knowledgeUnitId ? 'OPEN_QUESTION' : 'DIAGNOSTIC_QUIZ';
}

function actionKindRequiresKnowledgeUnit(
  actionKind: RevisionSessionActionKindValue,
): boolean {
  return (
    actionKind === 'OPEN_QUESTION' || actionKind === 'RICH_CLOSED_EXERCISE'
  );
}

function requiresKnowledgeUnitError(
  actionKind: RevisionSessionActionKindValue,
): string {
  return actionKind === 'RICH_CLOSED_EXERCISE'
    ? 'Rich closed revision session requires a knowledge unit'
    : 'Open question revision session requires a knowledge unit';
}

function createRichClosedExercisePayload(input: {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle: string | null;
}): RevisionSessionRichClosedExercisePayload {
  return {
    type: 'rich_closed_exercise',
    subjectId: input.subjectId,
    documentId: input.documentId,
    knowledgeUnitId: input.knowledgeUnitId,
    knowledgeUnitTitle: input.knowledgeUnitTitle,
    reason: revisionRichClosedReason(),
    estimatedMinutes: 8,
    preferredAction: 'rich_closed_exercise',
  };
}

function revisionRichClosedReason(): string {
  return 'Questions riches recommandées pour consolider cette notion.';
}
