import { Injectable } from '@nestjs/common';
import {
  RevisionSessionActionKind,
  RevisionSessionActionStatus,
  RevisionSessionMode,
  RevisionSessionStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionModeValue,
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../domain/revision-session.entity';
import type {
  RevisionSessionsRepository,
  RevisionSessionPlanningContext,
  RevisionSessionStartContext,
} from '../application/revision-sessions.repository';

type RevisionSessionRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  mode: RevisionSessionModeValue;
  status: RevisionSessionStatusValue;
  createdAt: Date;
  completedAt: Date | null;
  actions?: RevisionSessionActionRecord[];
};

type RevisionSessionActionRecord = {
  id: string;
  sessionId: string;
  studentId: string;
  subjectId: string;
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  activitySession?: {
    knowledgeUnitId: string;
  } | null;
};

@Injectable()
export class PrismaRevisionSessionsRepository implements RevisionSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureStartContext(input: {
    studentId: string;
    subjectId: string;
    documentId?: string;
    knowledgeUnitId?: string;
  }): Promise<RevisionSessionStartContext> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new Error('Revision subject not found');
    }

    let documentId: string | null = null;

    if (input.documentId) {
      const document = await this.prisma.document.findFirst({
        where: {
          id: input.documentId,
          subjectId: input.subjectId,
          studentId: input.studentId,
        },
        select: {
          id: true,
        },
      });

      if (!document) {
        throw new Error('Revision document not found');
      }

      documentId = document.id;
    }

    let knowledgeUnitId: string | null = null;
    let knowledgeUnitTitle: string | null = null;

    if (input.knowledgeUnitId) {
      const knowledgeUnit = await this.prisma.knowledgeUnit.findFirst({
        where: {
          id: input.knowledgeUnitId,
          subjectId: input.subjectId,
          ...(documentId ? { documentId } : {}),
          subject: {
            studentId: input.studentId,
          },
        },
        select: {
          id: true,
          documentId: true,
          title: true,
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Revision knowledge unit not found');
      }

      knowledgeUnitId = knowledgeUnit.id;
      knowledgeUnitTitle = knowledgeUnit.title;
      documentId = documentId ?? knowledgeUnit.documentId;
    }

    return {
      subjectId: input.subjectId,
      documentId,
      knowledgeUnitId,
      knowledgeUnitTitle,
    };
  }

  async createWithInitialAction(input: {
    studentId: string;
    subjectId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      displayOrder: number;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.revisionSession.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
          status: RevisionSessionStatus.STARTED,
          mode: RevisionSessionMode.QUICK,
        },
      });
      const action = await tx.revisionSessionAction.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: input.subjectId,
          kind: toPrismaActionKind(input.action.kind),
          status: toPrismaActionStatus(input.action.status),
          displayOrder: input.action.displayOrder,
          activitySessionId: input.action.activitySessionId,
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId,
        },
      });

      return toRevisionSessionResponse(session, [action]);
    });
  }

  async findByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    return toRevisionSessionResponse(session, session.actions ?? []);
  }

  async findPlanningContextByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionPlanningContext> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    const knowledgeUnits = await this.prisma.knowledgeUnit.findMany({
      where: {
        subjectId: session.subjectId,
        subject: { studentId: input.studentId },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });

    return {
      session: {
        id: session.id,
        status: session.status,
        subjectId: session.subjectId,
        courseId: session.courseId,
        documentId: session.documentId,
        knowledgeUnitId: session.knowledgeUnitId,
        mode: session.mode,
      },
      actions: (session.actions ?? []).map((action) => ({
        kind: action.kind,
        status: action.status,
        displayOrder: action.displayOrder,
        activitySessionId: action.activitySessionId,
        knowledgeUnitId:
          action.knowledgeUnitId ??
          action.activitySession?.knowledgeUnitId ??
          null,
      })),
      allowedKnowledgeUnitIds: knowledgeUnits.map((unit) => unit.id),
      allowedKnowledgeUnits: knowledgeUnits.map((unit) => ({
        id: unit.id,
        documentId: unit.documentId,
        title: unit.title,
      })),
    };
  }

  async appendAction(input: {
    studentId: string;
    sessionId: string;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
      });

      if (!session) {
        throw new Error('Revision session not found');
      }

      const maxOrder = await tx.revisionSessionAction.aggregate({
        where: { sessionId: input.sessionId },
        _max: { displayOrder: true },
      });
      const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      await tx.revisionSessionAction.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: session.subjectId,
          kind: toPrismaActionKind(input.action.kind),
          status: toPrismaActionStatus(input.action.status),
          displayOrder,
          activitySessionId: input.action.activitySessionId,
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId,
        },
      });

      const updatedSession = (await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          actions: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      })) as RevisionSessionRecord | null;

      if (!updatedSession) {
        throw new Error('Revision session not found');
      }

      return toRevisionSessionResponse(
        updatedSession,
        updatedSession.actions ?? [],
      );
    });
  }
}

function toRevisionSessionResponse(
  session: RevisionSessionRecord,
  actions: RevisionSessionActionRecord[],
): RevisionSessionResponseDto {
  const history = actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    status: action.status,
    displayOrder: action.displayOrder,
    activitySessionId: action.activitySessionId,
    documentId: action.documentId,
    knowledgeUnitId: action.knowledgeUnitId,
  }));
  const currentActionRecord = actions.length
    ? actions[actions.length - 1]
    : undefined;
  const currentAction = currentActionRecord
    ? {
        id: currentActionRecord.id,
        kind: currentActionRecord.kind,
        status: currentActionRecord.status,
        displayOrder: currentActionRecord.displayOrder,
        activitySessionId: currentActionRecord.activitySessionId,
        documentId: currentActionRecord.documentId,
        knowledgeUnitId: currentActionRecord.knowledgeUnitId,
        payload: toMinimalActionPayload(currentActionRecord),
      }
    : null;

  return {
    session: {
      id: session.id,
      status: session.status,
      subjectId: session.subjectId,
      courseId: session.courseId,
      documentId: session.documentId,
      knowledgeUnitId: session.knowledgeUnitId,
      mode: session.mode,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    },
    currentAction,
    history,
  };
}

function toMinimalActionPayload(action: RevisionSessionActionRecord) {
  if (action.kind === 'RICH_CLOSED_EXERCISE') {
    return {
      type: 'rich_closed_exercise' as const,
      subjectId: action.subjectId,
      documentId: action.documentId,
      knowledgeUnitId: action.knowledgeUnitId ?? '',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise' as const,
    };
  }

  return {
    type:
      action.kind === 'OPEN_QUESTION'
        ? ('open_question' as const)
        : ('diagnostic_quiz' as const),
    sessionId: action.activitySessionId,
  };
}

function toPrismaActionKind(kind: RevisionSessionActionKindValue) {
  if (kind === 'OPEN_QUESTION') {
    return RevisionSessionActionKind.OPEN_QUESTION;
  }

  if (kind === 'RICH_CLOSED_EXERCISE') {
    return RevisionSessionActionKind.RICH_CLOSED_EXERCISE;
  }

  return RevisionSessionActionKind.DIAGNOSTIC_QUIZ;
}

function toPrismaActionStatus(status: RevisionSessionActionStatusValue) {
  if (status === 'COMPLETED') {
    return RevisionSessionActionStatus.COMPLETED;
  }

  if (status === 'FAILED') {
    return RevisionSessionActionStatus.FAILED;
  }

  return RevisionSessionActionStatus.READY;
}
