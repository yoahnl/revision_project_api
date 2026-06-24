import { Injectable } from '@nestjs/common';
import {
  ActivityStatus,
  ActivityType,
  RevisionSessionActionKind,
  RevisionSessionActionStatus,
  RevisionSessionMode,
  RevisionSessionStatus,
} from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionActionPayload,
  RevisionSessionModeValue,
  ResumableCourseRevisionSessionDto,
  RevisionSessionDraftAnswerDto,
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../domain/revision-session.entity';
import {
  revisionSessionResultStateForScore,
  type RevisionSessionHistoryItemDto,
  type RevisionSessionHistoryResponseDto,
  type RevisionSessionQuestionCorrectionDto,
  type RevisionSessionResultDto,
} from '../domain/revision-session-result.entity';
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
  draftAnswers?: RevisionSessionDraftAnswerRecord[];
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
    id?: string;
    subjectId?: string;
    documentId?: string | null;
    knowledgeUnitId: string;
    type?: string;
    version?: number;
    questions?: RevisionSessionActivityQuestionRecord[];
  } | null;
};

type RevisionSessionActivityQuestionRecord = {
  id: string;
  knowledgeUnitId: string;
  prompt: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  displayOrder: number;
  choices: unknown;
  selectionMode: 'SINGLE' | 'MULTIPLE';
  minSelections: number | null;
  maxSelections: number | null;
  sources?: Array<{
    chunkId: string;
    chunk: {
      pageNumber: number | null;
      index: number;
    };
  }>;
  visuals?: Array<{
    id: string;
    type: 'IMAGE' | 'CHART' | 'DIAGRAM';
    displayOrder: number;
    payload: unknown;
    sources?: Array<{
      chunkId: string;
      chunk: {
        pageNumber: number | null;
        index: number;
      };
    }>;
  }>;
};

type RevisionSessionDraftAnswerRecord = {
  questionId: string;
  selectedChoiceIds: unknown;
  updatedAt: Date;
};

type RevisionSessionDraftTargetQuestionRecord = {
  id: string;
  choices: unknown;
  selectionMode: 'SINGLE' | 'MULTIPLE';
  maxSelections: number | null;
};

type RevisionSessionActivityResultRecord = {
  correctAnswers: number;
  totalQuestions: number;
  score: number | null;
};

type RevisionSessionHistoryRecord = {
  id: string;
  subjectId: string;
  courseId: string | null;
  mode: RevisionSessionModeValue;
  status: RevisionSessionStatusValue;
  createdAt: Date;
  completedAt: Date;
  course: {
    id: string;
    title: string;
  } | null;
  actions: Array<{
    activitySession: {
      result: RevisionSessionActivityResultRecord | null;
    } | null;
  }>;
};

type RevisionSessionAnswerRecord = {
  isCorrect: boolean;
  selectedChoiceId?: string | null;
  selectedChoices?: Array<{ choiceId: string }>;
  question: {
    prompt?: string;
    choices?: unknown;
    correctChoiceId?: string | null;
    correctChoiceIds?: unknown;
    explanation?: string | null;
    knowledgeUnitId: string;
    knowledgeUnit: {
      title: string;
    };
  };
};

type RevisionSessionActivityForResultRecord = {
  id: string;
  studentId: string;
  status: string;
  type: string;
  result: RevisionSessionActivityResultRecord | null;
  answers: RevisionSessionAnswerRecord[];
};

type CompletedRevisionSessionRecord = RevisionSessionRecord & {
  status: 'COMPLETED';
  completedAt: Date;
};

type RevisionSessionActivityWithResultRecord =
  RevisionSessionActivityForResultRecord & {
    result: RevisionSessionActivityResultRecord;
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
    courseId?: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
    mode?: RevisionSessionModeValue;
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
          courseId: input.courseId ?? null,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
          status: RevisionSessionStatus.STARTED,
          mode: toPrismaSessionMode(input.mode ?? 'QUICK'),
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

      return toRevisionSessionResponse(session, [action], []);
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
        draftAnswers: {
          orderBy: { updatedAt: 'asc' },
          select: {
            questionId: true,
            selectedChoiceIds: true,
            updatedAt: true,
          },
        },
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: {
                id: true,
                subjectId: true,
                documentId: true,
                knowledgeUnitId: true,
                type: true,
                version: true,
                questions: {
                  orderBy: { displayOrder: 'asc' },
                  select: {
                    id: true,
                    knowledgeUnitId: true,
                    prompt: true,
                    difficulty: true,
                    displayOrder: true,
                    choices: true,
                    selectionMode: true,
                    minSelections: true,
                    maxSelections: true,
                    sources: {
                      include: {
                        chunk: {
                          select: {
                            pageNumber: true,
                            index: true,
                          },
                        },
                      },
                    },
                    visuals: {
                      orderBy: { displayOrder: 'asc' },
                      select: {
                        id: true,
                        type: true,
                        displayOrder: true,
                        payload: true,
                        sources: {
                          include: {
                            chunk: {
                              select: {
                                pageNumber: true,
                                index: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    return toRevisionSessionResponse(
      session,
      session.actions ?? [],
      session.draftAnswers ?? [],
    );
  }

  async findResumableCourseSessionForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<ResumableCourseRevisionSessionDto | null> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        mode: RevisionSessionMode.QUICK,
        status: RevisionSessionStatus.STARTED,
        completedAt: null,
        course: {
          archivedAt: null,
          subject: {
            archivedAt: null,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        draftAnswers: {
          select: {
            questionId: true,
            selectedChoiceIds: true,
            updatedAt: true,
          },
        },
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: {
                questions: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      return null;
    }

    const action = selectCurrentAction(session.actions ?? []);
    const questionIds =
      action?.activitySession?.questions?.map((question) => question.id) ?? [];
    const answeredQuestionCount = (session.draftAnswers ?? []).filter(
      (answer) =>
        questionIds.includes(answer.questionId) &&
        parseDraftChoiceIds(answer.selectedChoiceIds).length > 0,
    ).length;

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
      currentAction: action
        ? {
            id: action.id,
            kind: action.kind,
            status: action.status,
            displayOrder: action.displayOrder,
            activitySessionId: action.activitySessionId,
            documentId: action.documentId,
            knowledgeUnitId: action.knowledgeUnitId,
          }
        : null,
      progress: {
        answeredQuestionCount,
        totalQuestionCount: questionIds.length,
      },
      userMessage: 'Tu as une session en cours.',
    };
  }

  async findCompletedCourseSessionsForStudent(input: {
    studentId: string;
    courseId: string;
    limit: number;
  }): Promise<RevisionSessionHistoryResponseDto> {
    const sessions = (await this.prisma.revisionSession.findMany({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        mode: RevisionSessionMode.QUICK,
        status: RevisionSessionStatus.COMPLETED,
        completedAt: { not: null },
        course: {
          archivedAt: null,
          subject: {
            archivedAt: null,
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      take: input.limit,
      select: revisionSessionHistorySelect(),
    })) as unknown as RevisionSessionHistoryRecord[];

    return toRevisionSessionHistoryResponse(sessions);
  }

  async findCompletedCourseExamSessionsForStudent(input: {
    studentId: string;
    courseId: string;
    limit: number;
  }): Promise<RevisionSessionHistoryResponseDto> {
    const sessions = (await this.prisma.revisionSession.findMany({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        mode: RevisionSessionMode.EXAM,
        status: RevisionSessionStatus.COMPLETED,
        completedAt: { not: null },
        course: {
          archivedAt: null,
          subject: {
            archivedAt: null,
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      take: input.limit,
      select: revisionSessionHistorySelect(),
    })) as unknown as RevisionSessionHistoryRecord[];

    return toRevisionSessionHistoryResponse(sessions);
  }

  async findCompletedSessionsForStudent(input: {
    studentId: string;
    limit: number;
  }): Promise<RevisionSessionHistoryResponseDto> {
    const sessions = (await this.prisma.revisionSession.findMany({
      where: {
        studentId: input.studentId,
        mode: RevisionSessionMode.QUICK,
        status: RevisionSessionStatus.COMPLETED,
        completedAt: { not: null },
        course: {
          archivedAt: null,
          subject: {
            archivedAt: null,
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      take: input.limit,
      select: revisionSessionHistorySelect(),
    })) as unknown as RevisionSessionHistoryRecord[];

    return toRevisionSessionHistoryResponse(sessions);
  }

  async saveDraftAnswer(input: {
    studentId: string;
    sessionId: string;
    questionId: string;
    selectedChoiceIds: string[];
  }): Promise<RevisionSessionResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const target = await this.findDraftTarget(tx, input);
      validateDraftSelection(target.question, input.selectedChoiceIds);

      if (input.selectedChoiceIds.length === 0) {
        await tx.revisionQuestionDraftAnswer.deleteMany({
          where: {
            studentId: input.studentId,
            sessionId: input.sessionId,
            questionId: input.questionId,
          },
        });
        return;
      }

      await tx.revisionQuestionDraftAnswer.upsert({
        where: {
          studentId_sessionId_questionId: {
            studentId: input.studentId,
            sessionId: input.sessionId,
            questionId: input.questionId,
          },
        },
        create: {
          studentId: input.studentId,
          sessionId: input.sessionId,
          activitySessionId: target.activitySessionId,
          questionId: input.questionId,
          selectedChoiceIds: input.selectedChoiceIds,
        },
        update: {
          activitySessionId: target.activitySessionId,
          selectedChoiceIds: input.selectedChoiceIds,
        },
      });
    });

    return this.findByIdForStudent({
      studentId: input.studentId,
      sessionId: input.sessionId,
    });
  }

  async deleteDraftAnswer(input: {
    studentId: string;
    sessionId: string;
    questionId: string;
  }): Promise<RevisionSessionResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.findDraftTarget(tx, input);
      await tx.revisionQuestionDraftAnswer.deleteMany({
        where: {
          studentId: input.studentId,
          sessionId: input.sessionId,
          questionId: input.questionId,
        },
      });
    });

    return this.findByIdForStudent({
      studentId: input.studentId,
      sessionId: input.sessionId,
    });
  }

  async completeQuickSession(input: {
    studentId: string;
    sessionId: string;
    completedAt: Date;
  }): Promise<RevisionSessionResultDto> {
    return this.completeDiagnosticSession(input, RevisionSessionMode.QUICK);
  }

  async completeExamSession(input: {
    studentId: string;
    sessionId: string;
    completedAt: Date;
  }): Promise<RevisionSessionResultDto> {
    return this.completeDiagnosticSession(input, RevisionSessionMode.EXAM);
  }

  private async completeDiagnosticSession(
    input: {
      studentId: string;
      sessionId: string;
      completedAt: Date;
    },
    mode: RevisionSessionMode,
  ): Promise<RevisionSessionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = (await tx.revisionSession.findFirst({
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

      if (session.mode !== mode) {
        throw new Error('Revision session completion unsupported');
      }

      const action = selectCurrentAction(session.actions ?? []);

      if (
        !action ||
        action.kind !== RevisionSessionActionKind.DIAGNOSTIC_QUIZ ||
        !action.activitySessionId
      ) {
        throw new Error('Revision session not ready to complete');
      }

      const activity = (await tx.activitySession.findFirst({
        where: {
          id: action.activitySessionId,
          studentId: input.studentId,
          type: ActivityType.DIAGNOSTIC_QUIZ,
        },
        include: {
          result: true,
          answers: {
            include: {
              question: {
                select: {
                  prompt: true,
                  choices: true,
                  correctChoiceId: true,
                  correctChoiceIds: true,
                  explanation: true,
                  knowledgeUnitId: true,
                  knowledgeUnit: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
              selectedChoices: {
                select: {
                  choiceId: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })) as RevisionSessionActivityForResultRecord | null;

      if (!activity) {
        throw new Error('Revision session activity not found');
      }

      if (activity.status !== ActivityStatus.COMPLETED) {
        throw new Error('Revision session activity not submitted');
      }

      if (!activity.result) {
        throw new Error('Revision session result not found');
      }

      const completedAt = session.completedAt ?? input.completedAt;
      const activityWithResult: RevisionSessionActivityWithResultRecord = {
        ...activity,
        result: activity.result,
      };
      const completedSession: CompletedRevisionSessionRecord = {
        ...session,
        status: RevisionSessionStatus.COMPLETED,
        completedAt,
      };

      if (session.status !== RevisionSessionStatus.COMPLETED) {
        await tx.revisionSessionAction.update({
          where: { id: action.id },
          data: {
            status: RevisionSessionActionStatus.COMPLETED,
            completedAt,
          },
        });
        await tx.revisionSession.update({
          where: { id: session.id },
          data: {
            status: RevisionSessionStatus.COMPLETED,
            completedAt,
          },
        });
      }

      await tx.revisionQuestionDraftAnswer.deleteMany({
        where: {
          studentId: input.studentId,
          sessionId: session.id,
        },
      });

      return toRevisionSessionResult(completedSession, activityWithResult);
    });
  }

  async findResultByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResultDto> {
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

    if (
      session.status !== RevisionSessionStatus.COMPLETED ||
      !session.completedAt
    ) {
      throw new Error('Revision session not completed');
    }

    const action = selectCurrentAction(session.actions ?? []);

    if (
      !action ||
      action.kind !== RevisionSessionActionKind.DIAGNOSTIC_QUIZ ||
      !action.activitySessionId
    ) {
      throw new Error('Revision session result not found');
    }

    const activity = (await this.prisma.activitySession.findFirst({
      where: {
        id: action.activitySessionId,
        studentId: input.studentId,
        type: ActivityType.DIAGNOSTIC_QUIZ,
      },
      include: {
        result: true,
        answers: {
          include: {
            question: {
              select: {
                prompt: true,
                choices: true,
                correctChoiceId: true,
                correctChoiceIds: true,
                explanation: true,
                knowledgeUnitId: true,
                knowledgeUnit: {
                  select: {
                    title: true,
                  },
                },
              },
            },
            selectedChoices: {
              select: {
                choiceId: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })) as RevisionSessionActivityForResultRecord | null;

    if (!activity?.result) {
      throw new Error('Revision session result not found');
    }

    const completedSession: CompletedRevisionSessionRecord = {
      ...session,
      status: RevisionSessionStatus.COMPLETED,
      completedAt: session.completedAt,
    };
    const activityWithResult: RevisionSessionActivityWithResultRecord = {
      ...activity,
      result: activity.result,
    };

    return toRevisionSessionResult(completedSession, activityWithResult);
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
        ...(session.courseId
          ? {
              document: {
                studentId: input.studentId,
                courseId: session.courseId,
                kind: 'COURSE_PDF',
                status: 'READY',
              },
            }
          : {}),
      },
      orderBy: [
        { displayOrder: 'asc' as const },
        { createdAt: 'asc' as const },
      ],
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

      if (session.mode === 'QUICK' && session.courseId !== null) {
        throw new Error(
          'Quick course revision sessions do not support next actions',
        );
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
        [],
      );
    });
  }

  private async findDraftTarget(
    tx: Pick<PrismaService, 'revisionSession' | 'question'>,
    input: {
      studentId: string;
      sessionId: string;
      questionId: string;
    },
  ): Promise<{
    activitySessionId: string;
    question: RevisionSessionDraftTargetQuestionRecord;
  }> {
    const session = (await tx.revisionSession.findFirst({
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

    if (
      session.status !== RevisionSessionStatus.STARTED ||
      session.completedAt !== null
    ) {
      throw new Error('Revision session draft cannot be saved');
    }

    const action = selectCurrentAction(session.actions ?? []);

    if (
      !action ||
      action.status !== RevisionSessionActionStatus.READY ||
      action.kind !== RevisionSessionActionKind.DIAGNOSTIC_QUIZ ||
      !action.activitySessionId
    ) {
      throw new Error('Revision session draft cannot be saved');
    }

    const question = (await tx.question.findFirst({
      where: {
        id: input.questionId,
        sessionId: action.activitySessionId,
      },
      select: {
        id: true,
        choices: true,
        selectionMode: true,
        maxSelections: true,
      },
    })) as RevisionSessionDraftTargetQuestionRecord | null;

    if (!question) {
      throw new Error('Revision session question not found');
    }

    return {
      activitySessionId: action.activitySessionId,
      question,
    };
  }
}

function toRevisionSessionResponse(
  session: RevisionSessionRecord,
  actions: RevisionSessionActionRecord[],
  draftAnswers: RevisionSessionDraftAnswerRecord[],
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
        payload: toActionPayload(currentActionRecord),
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
    draftAnswers: draftAnswers.map(toDraftAnswerDto),
  };
}

function toDraftAnswerDto(
  draftAnswer: RevisionSessionDraftAnswerRecord,
): RevisionSessionDraftAnswerDto {
  return {
    questionId: draftAnswer.questionId,
    selectedChoiceIds: parseDraftChoiceIds(draftAnswer.selectedChoiceIds),
    updatedAt: draftAnswer.updatedAt,
  };
}

function toActionPayload(
  action: RevisionSessionActionRecord,
): RevisionSessionActionPayload {
  if (
    action.kind === 'DIAGNOSTIC_QUIZ' &&
    action.activitySession?.type === ActivityType.DIAGNOSTIC_QUIZ &&
    Array.isArray(action.activitySession.questions)
  ) {
    return toDiagnosticQuizPayload(action.activitySession);
  }

  return toMinimalActionPayload(action);
}

function toMinimalActionPayload(
  action: RevisionSessionActionRecord,
): RevisionSessionActionPayload {
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

function toDiagnosticQuizPayload(
  activity: NonNullable<RevisionSessionActionRecord['activitySession']>,
) {
  const payload = {
    sessionId: activity.id ?? '',
    type: 'diagnostic_quiz' as const,
    title: 'Quiz de diagnostic',
    questions: (activity.questions ?? []).map(toPublicDiagnosticQuestion),
  };

  if ((activity.version ?? 1) > 1) {
    return {
      ...payload,
      version: activity.version,
      documentId: activity.documentId ?? null,
      subjectId: activity.subjectId,
    };
  }

  return payload;
}

function toPublicDiagnosticQuestion(
  question: RevisionSessionActivityQuestionRecord,
) {
  const sources = (question.sources ?? [])
    .map((source) => ({
      chunkId: source.chunkId,
      pageNumber: source.chunk.pageNumber,
      index: source.chunk.index,
    }))
    .sort((left, right) => left.index - right.index);

  return {
    id: question.id,
    knowledgeUnitId: question.knowledgeUnitId,
    prompt: question.prompt,
    difficulty: question.difficulty,
    ...(question.selectionMode === 'MULTIPLE'
      ? { selectionMode: 'multiple' as const }
      : {}),
    ...(question.minSelections === null
      ? {}
      : { minSelections: question.minSelections }),
    ...(question.maxSelections === null
      ? {}
      : { maxSelections: question.maxSelections }),
    choices: parsePublicQuestionChoices(question.choices),
    ...(sources.length > 0 ? { sources } : {}),
    ...toPublicQuestionVisuals(question.visuals),
  };
}

function toPublicQuestionVisuals(
  visuals: RevisionSessionActivityQuestionRecord['visuals'],
) {
  const publicVisuals = (visuals ?? [])
    .map(toPublicQuestionVisual)
    .filter(
      (
        visual,
      ): visual is NonNullable<ReturnType<typeof toPublicQuestionVisual>> =>
        Boolean(visual),
    )
    .sort((left, right) => left.displayOrder - right.displayOrder);

  return publicVisuals.length > 0 ? { visuals: publicVisuals } : {};
}

function toPublicQuestionVisual(
  visual: NonNullable<RevisionSessionActivityQuestionRecord['visuals']>[number],
) {
  const sources = (visual.sources ?? [])
    .map((source) => ({
      chunkId: source.chunkId,
      pageNumber: source.chunk.pageNumber,
      index: source.chunk.index,
    }))
    .sort((left, right) => left.index - right.index);

  if (visual.type === 'IMAGE') {
    const payload = parseRecord(visual.payload);
    const imageUrl =
      typeof payload.imageUrl === 'string' ? payload.imageUrl : '';
    const altText = typeof payload.altText === 'string' ? payload.altText : '';

    if (!imageUrl || !altText) {
      return null;
    }

    return {
      id: visual.id,
      type: 'IMAGE' as const,
      displayOrder: visual.displayOrder,
      imageUrl,
      altText,
      caption:
        typeof payload.caption === 'string' || payload.caption === null
          ? payload.caption
          : undefined,
      sources,
    };
  }

  if (visual.type === 'CHART') {
    const payload = parseRecord(visual.payload);
    const chartType = parseChartType(payload.chartType);
    const title = typeof payload.title === 'string' ? payload.title : '';
    const data = parseChartData(payload.data);

    if (!chartType || !title || data.length === 0) {
      return null;
    }

    return {
      id: visual.id,
      type: 'CHART' as const,
      displayOrder: visual.displayOrder,
      chartType,
      title,
      description:
        typeof payload.description === 'string' || payload.description === null
          ? payload.description
          : undefined,
      data,
      xKey:
        typeof payload.xKey === 'string' || payload.xKey === null
          ? payload.xKey
          : undefined,
      yKeys: parseOptionalStringArray(payload.yKeys),
      sources,
    };
  }

  const payload = parseRecord(visual.payload);
  const title = typeof payload.title === 'string' ? payload.title : '';
  const nodes = parseDiagramNodes(payload.nodes);
  const edges = parseDiagramEdges(payload.edges);

  if (!title || nodes.length === 0) {
    return null;
  }

  return {
    id: visual.id,
    type: 'DIAGRAM' as const,
    displayOrder: visual.displayOrder,
    title,
    description:
      typeof payload.description === 'string' || payload.description === null
        ? payload.description
        : undefined,
    nodes,
    ...(edges === undefined ? {} : { edges }),
    sources,
  };
}

function parsePublicQuestionChoices(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((choice) => {
      if (typeof choice === 'object' && choice !== null) {
        const record = choice as { id?: unknown; label?: unknown };
        if (typeof record.id !== 'string' || typeof record.label !== 'string') {
          return null;
        }

        return {
          id: record.id,
          label: record.label,
        };
      }

      return null;
    })
    .filter((choice): choice is { id: string; label: string } =>
      Boolean(choice),
    );
}

function parseDraftChoiceIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((value): value is string => typeof value === 'string');
}

function validateDraftSelection(
  question: RevisionSessionDraftTargetQuestionRecord,
  selectedChoiceIds: string[],
): void {
  const choices = parsePublicQuestionChoices(question.choices);
  const knownChoiceIds = new Set(choices.map((choice) => choice.id));

  if (selectedChoiceIds.some((choiceId) => !knownChoiceIds.has(choiceId))) {
    throw new Error('Revision session draft answer choice invalid');
  }

  if (question.selectionMode === 'SINGLE' && selectedChoiceIds.length > 1) {
    throw new Error('Revision session draft answer selection invalid');
  }

  const maxSelections =
    question.selectionMode === 'MULTIPLE'
      ? (question.maxSelections ?? choices.length)
      : 1;

  if (selectedChoiceIds.length > maxSelections) {
    throw new Error('Revision session draft answer selection invalid');
  }
}

function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }

  return input as Record<string, unknown>;
}

function parseChartType(
  input: unknown,
): 'bar' | 'line' | 'pie' | 'scatter' | null {
  return input === 'bar' ||
    input === 'line' ||
    input === 'pie' ||
    input === 'scatter'
    ? input
    : null;
}

function parseChartData(
  input: unknown,
): Array<Record<string, string | number | null>> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(parseRecord)
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(
          (entry): entry is [string, string | number | null] =>
            typeof entry[1] === 'string' ||
            typeof entry[1] === 'number' ||
            entry[1] === null,
        ),
      ),
    )
    .filter((row) => Object.keys(row).length > 0);
}

function parseOptionalStringArray(input: unknown): string[] | null | undefined {
  if (input === null) {
    return null;
  }

  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    return undefined;
  }

  const values = input.filter(
    (value): value is string => typeof value === 'string',
  );

  return values.length === input.length ? values : undefined;
}

function parseDiagramNodes(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(parseRecord)
    .map((node) => ({
      id: typeof node.id === 'string' ? node.id : '',
      label: typeof node.label === 'string' ? node.label : '',
    }))
    .filter((node) => node.id.length > 0 && node.label.length > 0);
}

function parseDiagramEdges(input: unknown) {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    return undefined;
  }

  return input
    .map(parseRecord)
    .map((edge) => ({
      from: typeof edge.from === 'string' ? edge.from : '',
      to: typeof edge.to === 'string' ? edge.to : '',
      label:
        typeof edge.label === 'string' || edge.label === null
          ? edge.label
          : undefined,
    }))
    .filter((edge) => edge.from.length > 0 && edge.to.length > 0);
}

function selectCurrentAction(
  actions: RevisionSessionActionRecord[],
): RevisionSessionActionRecord | undefined {
  return actions.length ? actions[actions.length - 1] : undefined;
}

function toRevisionSessionResult(
  session: CompletedRevisionSessionRecord,
  activity: RevisionSessionActivityWithResultRecord,
): RevisionSessionResultDto {
  const score = normalizeScore(
    activity.result.score,
    activity.result.correctAnswers,
    activity.result.totalQuestions,
  );
  const durationSeconds = Math.max(
    0,
    Math.floor(
      (session.completedAt.getTime() - session.createdAt.getTime()) / 1000,
    ),
  );

  return {
    session: {
      id: session.id,
      subjectId: session.subjectId,
      courseId: session.courseId,
      mode: session.mode,
      status: 'COMPLETED',
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    },
    summary: {
      correctAnswers: activity.result.correctAnswers,
      totalQuestions: activity.result.totalQuestions,
      score,
      durationSeconds,
    },
    knowledgeUnits: aggregateKnowledgeUnitResults(activity.answers),
    corrections: buildQuestionCorrections(activity.answers),
  };
}

function revisionSessionHistorySelect(): Prisma.RevisionSessionSelect {
  const actionOrder: Prisma.RevisionSessionActionOrderByWithRelationInput[] = [
    { displayOrder: 'asc' },
    { createdAt: 'asc' },
  ];

  return {
    id: true,
    subjectId: true,
    courseId: true,
    mode: true,
    status: true,
    createdAt: true,
    completedAt: true,
    course: {
      select: {
        id: true,
        title: true,
      },
    },
    actions: {
      orderBy: actionOrder,
      select: {
        activitySession: {
          select: {
            result: true,
          },
        },
      },
    },
  };
}

function toRevisionSessionHistoryResponse(
  sessions: RevisionSessionHistoryRecord[],
): RevisionSessionHistoryResponseDto {
  return {
    items: sessions
      .map(toRevisionSessionHistoryItem)
      .filter((item): item is RevisionSessionHistoryItemDto => item !== null),
  };
}

function toRevisionSessionHistoryItem(
  session: RevisionSessionHistoryRecord,
): RevisionSessionHistoryItemDto | null {
  const result = session.actions
    .map((action) => action.activitySession?.result ?? null)
    .find((candidate): candidate is RevisionSessionActivityResultRecord =>
      Boolean(candidate),
    );

  if (!result || !session.course) {
    return null;
  }

  const score = normalizeScore(
    result.score,
    result.correctAnswers,
    result.totalQuestions,
  );
  const durationSeconds = Math.max(
    0,
    Math.floor(
      (session.completedAt.getTime() - session.createdAt.getTime()) / 1000,
    ),
  );

  return {
    session: {
      id: session.id,
      subjectId: session.subjectId,
      courseId: session.courseId,
      mode: session.mode,
      status: 'COMPLETED',
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    },
    summary: {
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      score,
      durationSeconds,
    },
    course: {
      id: session.course.id,
      title: session.course.title,
    },
  };
}

function aggregateKnowledgeUnitResults(
  answers: RevisionSessionAnswerRecord[],
): RevisionSessionResultDto['knowledgeUnits'] {
  const buckets = new Map<
    string,
    {
      title: string;
      correctAnswers: number;
      totalQuestions: number;
    }
  >();

  for (const answer of answers) {
    const knowledgeUnitId = answer.question.knowledgeUnitId;
    const current = buckets.get(knowledgeUnitId) ?? {
      title: answer.question.knowledgeUnit.title,
      correctAnswers: 0,
      totalQuestions: 0,
    };
    buckets.set(knowledgeUnitId, {
      title: current.title,
      correctAnswers: current.correctAnswers + (answer.isCorrect ? 1 : 0),
      totalQuestions: current.totalQuestions + 1,
    });
  }

  return [...buckets.entries()].map(([knowledgeUnitId, bucket]) => {
    const score = safeDivide(bucket.correctAnswers, bucket.totalQuestions);

    return {
      knowledgeUnitId,
      title: bucket.title,
      correctAnswers: bucket.correctAnswers,
      totalQuestions: bucket.totalQuestions,
      score,
      state: revisionSessionResultStateForScore(score),
    };
  });
}

function buildQuestionCorrections(
  answers: RevisionSessionAnswerRecord[],
): RevisionSessionQuestionCorrectionDto[] {
  return answers.map((answer) => {
    const choices = parsePublicQuestionChoices(answer.question.choices);
    const selectedChoiceIds = selectedChoiceIdsForAnswer(answer);
    const correctChoiceIds = correctChoiceIdsForQuestion(answer.question);

    return {
      prompt: answer.question.prompt ?? '',
      isCorrect: answer.isCorrect,
      selectedAnswers: labelsForChoiceIds(choices, selectedChoiceIds),
      correctAnswers: labelsForChoiceIds(choices, correctChoiceIds),
      explanation:
        typeof answer.question.explanation === 'string'
          ? answer.question.explanation
          : null,
    };
  });
}

function selectedChoiceIdsForAnswer(answer: RevisionSessionAnswerRecord) {
  if (answer.selectedChoices && answer.selectedChoices.length > 0) {
    return answer.selectedChoices.map((choice) => choice.choiceId);
  }

  return answer.selectedChoiceId ? [answer.selectedChoiceId] : [];
}

function correctChoiceIdsForQuestion(
  question: RevisionSessionAnswerRecord['question'],
) {
  const multipleCorrectChoiceIds = parseStringArray(question.correctChoiceIds);

  if (multipleCorrectChoiceIds.length > 0) {
    return multipleCorrectChoiceIds;
  }

  return question.correctChoiceId ? [question.correctChoiceId] : [];
}

function labelsForChoiceIds(
  choices: Array<{ id: string; label: string }>,
  choiceIds: string[],
) {
  const labelsById = new Map(
    choices.map((choice) => [choice.id, choice.label]),
  );

  return choiceIds
    .map((choiceId) => labelsById.get(choiceId))
    .filter((label): label is string => Boolean(label));
}

function parseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((value): value is string => typeof value === 'string');
}

function normalizeScore(
  score: number | null,
  correctAnswers: number,
  totalQuestions: number,
): number {
  if (typeof score === 'number' && Number.isFinite(score)) {
    return clampScore(score);
  }

  return safeDivide(correctAnswers, totalQuestions);
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return clampScore(numerator / denominator);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
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

function toPrismaSessionMode(mode: RevisionSessionModeValue) {
  if (mode === 'EXAM') {
    return RevisionSessionMode.EXAM;
  }

  if (mode === 'DEEP') {
    return RevisionSessionMode.DEEP;
  }

  return RevisionSessionMode.QUICK;
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
