import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type {
  DiagnosticQuizActivity,
  OpenQuestionActivity,
} from '../../activities/application/activities.repository';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionPreferredAction,
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
    documentId?: string;
    knowledgeUnitId?: string;
    preferredAction?: RevisionSessionPreferredAction;
  }): Promise<RevisionSessionResponseDto> {
    const actionKind = resolveInitialActionKind(input);

    if (actionKind === 'OPEN_QUESTION' && !input.knowledgeUnitId) {
      throw new Error(
        'Open question revision session requires a knowledge unit',
      );
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
        activity,
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? context.documentId,
        knowledgeUnitId: activity.knowledgeUnitId,
      });
    }

    const activity = await this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: context.subjectId,
      knowledgeUnitId: context.knowledgeUnitId ?? undefined,
    });

    return this.createSessionWithPayload({
      input,
      context,
      actionKind,
      activity,
      activitySessionId: activity.sessionId,
      documentId: activity.documentId ?? context.documentId,
      knowledgeUnitId: context.knowledgeUnitId,
    });
  }

  private async createSessionWithPayload(input: {
    input: {
      studentId: string;
      subjectId: string;
    };
    context: {
      subjectId: string;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
    actionKind: RevisionSessionActionKindValue;
    activity: DiagnosticQuizActivity | OpenQuestionActivity;
    activitySessionId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
  }): Promise<RevisionSessionResponseDto> {
    const response =
      await this.revisionSessionsRepository.createWithInitialAction({
        studentId: input.input.studentId,
        subjectId: input.context.subjectId,
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
            payload: input.activity,
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

  return input.knowledgeUnitId ? 'OPEN_QUESTION' : 'DIAGNOSTIC_QUIZ';
}
