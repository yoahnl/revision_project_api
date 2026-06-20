import { Injectable } from '@nestjs/common';
import {
  ActivityStatus,
  ActivityType,
  OpenAnswerEvaluationStatus,
  QuestionSelectionMode,
  QuestionVisualType,
} from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import type {
  ActivitiesRepository,
  ActivityQuestion,
  ActivityQuestionCorrectionItem,
  ActivityQuestionVisual,
  OpenAnswerEvaluationContext,
  OpenAnswerEvaluationDraft,
  DiagnosticQuizActivity,
  DiagnosticQuizGenerationContext,
  DiagnosticQuizSubmissionResult,
  OpenAnswerSubmissionResult,
  OpenQuestionActivity,
  OpenQuestionDraft,
  RichClosedExerciseInternalEnvelope,
} from '../application/activities.repository';
import type {
  GeneratedDiagnosticQuiz,
  GeneratedDiagnosticQuizChoice,
  GeneratedDiagnosticQuizQuestion,
  GeneratedDiagnosticQuizVisual,
} from '../application/diagnostic-quiz-generator';
import {
  RICH_CLOSED_GENERATION_SOURCE_INVALID,
  RICH_CLOSED_SESSION_ALREADY_COMPLETED,
  RICH_CLOSED_SESSION_NOT_COMPLETED,
  RICH_CLOSED_SESSION_NOT_FOUND,
  RICH_CLOSED_START_INVALID_INPUT,
} from '../application/rich-closed-questions/rich-closed-question-errors';
import type {
  GeneratedRichClosedExercise,
  RichClosedQuestionGenerationMetadata,
} from '../application/rich-closed-questions/rich-closed-question-generator';
import { toRichClosedPublicExerciseEnvelope } from '../application/rich-closed-questions/rich-closed-question-public.mapper';
import type {
  RichClosedAnswer,
  RichClosedExercise,
  RichClosedExerciseResult,
  RichClosedPublicExerciseEnvelope,
} from '../application/rich-closed-questions/rich-closed-question.types';
import { validateRichClosedExercise } from '../application/rich-closed-questions/rich-closed-question.validator';

type ActivityQuestionChoiceRecord = {
  id: string;
  label: string;
  feedback?: string | null;
};

type QuestionSourceRecord = {
  chunkId: string;
  chunk: {
    id: string;
    text: string;
    pageNumber: number | null;
    index: number;
  };
};

type QuestionRecord = {
  id: string;
  bankQuestionId?: string | null;
  knowledgeUnitId: string;
  prompt: string;
  choices: unknown;
  selectionMode?: 'SINGLE' | 'MULTIPLE';
  minSelections?: number | null;
  maxSelections?: number | null;
  correctChoiceId?: string | null;
  correctChoiceIds?: unknown;
  explanation: string;
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  displayOrder?: number;
  sources?: QuestionSourceRecord[];
  visuals?: QuestionVisualRecord[];
};

type QuestionVisualRecord = {
  id: string;
  type: 'IMAGE' | 'CHART' | 'DIAGRAM';
  displayOrder: number;
  payload: unknown;
  sources?: QuestionSourceRecord[];
};

type ActivitySessionRecord = {
  id: string;
  subjectId: string;
  knowledgeUnitId: string;
  type: ActivityType;
  status: ActivityStatus;
  version?: number;
  documentId?: string | null;
  questions: QuestionRecord[];
  result?: object | null;
};

type OpenQuestionSourceRecord = {
  chunkId: string;
  chunk: DocumentChunkRecord;
};

type OpenQuestionRecord = {
  id: string;
  sessionId: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  prompt: string;
  instructions: string | null;
  maxAnswerLength: number;
  version: number;
  sources?: OpenQuestionSourceRecord[];
};

type OpenAnswerEvaluationRecord = {
  id: string;
  sessionId: string;
  openQuestionId?: string;
  answerText?: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  presentPoints: unknown;
  missingPoints: unknown;
  errors: unknown;
  modelAnswer: string | null;
  advice: string | null;
  generationFlowName?: string | null;
  generationProvider?: string | null;
  generationModel?: string | null;
  generationPromptVersion?: string | null;
  generationSchemaVersion?: string | null;
  generationInputSize?: number | null;
  errorCode?: string | null;
};

type OpenQuestionSessionRecord = ActivitySessionRecord & {
  openQuestion?: OpenQuestionRecord | null;
  openAnswerEvaluation?: OpenAnswerEvaluationRecord | null;
};

type OpenAnswerEvaluationSessionRecord = OpenQuestionSessionRecord & {
  knowledgeUnit: KnowledgeUnitRecord;
  openQuestion: OpenQuestionRecord | null;
  openAnswerEvaluation: OpenAnswerEvaluationRecord | null;
};

type RichClosedExercisePayloadRecord = {
  id: string;
  activitySessionId: string;
  version: string;
  title: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  exercisePayload: unknown;
  generationMetadata?: unknown;
  qualityMetrics?: unknown;
};

type RichClosedExerciseResultRecord = {
  id: string;
  activitySessionId: string;
  answersPayload: unknown;
  correctionPayload: unknown;
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  createdAt: Date;
};

type RichClosedExerciseSessionRecord = ActivitySessionRecord & {
  richClosedExercisePayload?: RichClosedExercisePayloadRecord | null;
  richClosedExerciseResult?: RichClosedExerciseResultRecord | null;
};

type RichClosedPersistedSessionRecord = RichClosedExerciseSessionRecord & {
  richClosedExercisePayload: RichClosedExercisePayloadRecord;
};

type DocumentChunkRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  pageNumber: number | null;
};

type KnowledgeUnitSourceRecord = {
  chunk: DocumentChunkRecord;
};

type KnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  sources?: KnowledgeUnitSourceRecord[];
};

const OPEN_ANSWER_SOURCE_EXCERPT_MAX_LENGTH = 520;

@Injectable()
export class PrismaActivitiesRepository implements ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDiagnosticQuizGenerationContext(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<DiagnosticQuizGenerationContext | null> {
    const knowledgeUnit = await this.prisma.knowledgeUnit.findFirst({
      where: {
        id: input.knowledgeUnitId,
        subjectId: input.subjectId,
        subject: {
          studentId: input.studentId,
        },
      },
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });

    if (!knowledgeUnit) {
      return null;
    }

    return toDiagnosticQuizGenerationContext(knowledgeUnit);
  }

  async findOpenQuestionGenerationContext(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<DiagnosticQuizGenerationContext | null> {
    return this.findDiagnosticQuizGenerationContext(input);
  }

  async findRichClosedGenerationContext(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<DiagnosticQuizGenerationContext | null> {
    return this.findDiagnosticQuizGenerationContext(input);
  }

  async createDiagnosticQuiz(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
    documentId?: string | null;
    quiz: GeneratedDiagnosticQuiz;
  }): Promise<DiagnosticQuizActivity> {
    assertGeneratedQuizIsPersistable(input.quiz);

    return this.prisma.$transaction(async (tx) => {
      const knowledgeUnit = await tx.knowledgeUnit.findFirst({
        where: {
          id: input.knowledgeUnitId,
          subjectId: input.subjectId,
          subject: {
            studentId: input.studentId,
          },
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Knowledge unit does not belong to student subject');
      }

      const sourceChunkIds = collectQuizSourceChunkIds(input.quiz.questions);
      const sourceChunks =
        sourceChunkIds.length === 0
          ? []
          : await tx.documentChunk.findMany({
              where: {
                id: {
                  in: sourceChunkIds,
                },
                subjectId: input.subjectId,
                ...(input.documentId ? { documentId: input.documentId } : {}),
              },
              select: {
                id: true,
                documentId: true,
                subjectId: true,
                index: true,
                pageNumber: true,
                text: true,
              },
            });

      if (sourceChunks.length !== sourceChunkIds.length) {
        throw new Error('Question source chunk not found');
      }

      const sourceChunkById = new Map(
        sourceChunks.map((chunk) => [chunk.id, chunk]),
      );

      const session = await tx.activitySession.create({
        data: buildActivitySessionCreateData(input),
      });

      const questions: QuestionRecord[] = [];

      for (const [index, question] of input.quiz.questions.entries()) {
        const createdQuestion = await tx.question.create({
          data: buildQuestionCreateData({
            sessionId: session.id,
            subjectId: input.subjectId,
            documentId: input.documentId ?? null,
            knowledgeUnitId: input.knowledgeUnitId,
            question,
            index,
            isSourcedVersion: (input.quiz.version ?? 1) > 1,
          }),
        });
        const questionSourceChunkIds = dedupeStrings(
          question.sourceChunkIds ?? [],
        );

        if (questionSourceChunkIds.length > 0) {
          await tx.questionSource.createMany({
            data: questionSourceChunkIds.map((chunkId) => ({
              questionId: createdQuestion.id,
              subjectId: input.subjectId,
              chunkId,
            })),
          });
        }

        const visuals: QuestionVisualRecord[] = [];

        for (const [visualIndex, visual] of (
          question.visuals ?? []
        ).entries()) {
          const visualSourceChunkIds = dedupeStrings(visual.sourceChunkIds);
          const createdVisual = await tx.questionVisual.create({
            data: buildQuestionVisualCreateData({
              questionId: createdQuestion.id,
              visual,
              fallbackDisplayOrder: visualIndex,
            }),
          });

          await tx.questionVisualSource.createMany({
            data: visualSourceChunkIds.map((chunkId) => ({
              visualId: createdVisual.id,
              subjectId: input.subjectId,
              chunkId,
            })),
          });

          visuals.push({
            id: createdVisual.id,
            type: createdVisual.type,
            displayOrder: createdVisual.displayOrder,
            payload: createdVisual.payload,
            sources: visualSourceChunkIds
              .map((chunkId) => sourceChunkById.get(chunkId))
              .filter((chunk): chunk is DocumentChunkRecord => Boolean(chunk))
              .map((chunk) => ({
                chunkId: chunk.id,
                chunk: {
                  id: chunk.id,
                  text: chunk.text,
                  pageNumber: chunk.pageNumber,
                  index: chunk.index,
                },
              })),
          });
        }

        questions.push({
          id: createdQuestion.id,
          knowledgeUnitId: createdQuestion.knowledgeUnitId,
          prompt: createdQuestion.prompt,
          choices: createdQuestion.choices,
          selectionMode: createdQuestion.selectionMode,
          minSelections: createdQuestion.minSelections,
          maxSelections: createdQuestion.maxSelections,
          correctChoiceId: createdQuestion.correctChoiceId,
          correctChoiceIds: createdQuestion.correctChoiceIds,
          explanation: createdQuestion.explanation,
          difficulty: createdQuestion.difficulty,
          displayOrder: createdQuestion.displayOrder,
          sources: questionSourceChunkIds
            .map((chunkId) => sourceChunkById.get(chunkId))
            .filter((chunk): chunk is DocumentChunkRecord => Boolean(chunk))
            .map((chunk) => ({
              chunkId: chunk.id,
              chunk: {
                id: chunk.id,
                text: chunk.text,
                pageNumber: chunk.pageNumber,
                index: chunk.index,
              },
            })),
          visuals,
        });
      }

      return toDiagnosticQuizActivity(
        {
          id: session.id,
          subjectId: session.subjectId,
          knowledgeUnitId: session.knowledgeUnitId,
          type: session.type,
          status: session.status,
          version: session.version,
          documentId: session.documentId,
          questions,
        },
        input.quiz.title,
      );
    });
  }

  async createOpenQuestionActivity(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
    documentId?: string | null;
    question: OpenQuestionDraft;
  }): Promise<OpenQuestionActivity> {
    return this.prisma.$transaction(async (tx) => {
      const knowledgeUnit = await tx.knowledgeUnit.findFirst({
        where: {
          id: input.knowledgeUnitId,
          subjectId: input.subjectId,
          subject: {
            studentId: input.studentId,
          },
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Knowledge unit does not belong to student subject');
      }

      const sourceChunkIds = dedupeStrings(input.question.sourceChunkIds);
      const sourceChunks =
        sourceChunkIds.length === 0
          ? []
          : await tx.documentChunk.findMany({
              where: {
                id: {
                  in: sourceChunkIds,
                },
                subjectId: input.subjectId,
                ...(input.documentId ? { documentId: input.documentId } : {}),
              },
              select: {
                id: true,
                documentId: true,
                subjectId: true,
                pageNumber: true,
                index: true,
                text: true,
              },
            });

      if (sourceChunks.length !== sourceChunkIds.length) {
        throw new Error('Open question source chunk not found');
      }

      const sourceChunkById = new Map(
        sourceChunks.map((chunk) => [chunk.id, chunk]),
      );
      const session = await tx.activitySession.create({
        data: buildOpenQuestionSessionCreateData(input),
      });
      const question = await tx.openQuestion.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: input.subjectId,
          documentId: input.documentId ?? null,
          knowledgeUnitId: input.knowledgeUnitId,
          prompt: input.question.prompt,
          instructions: input.question.instructions,
          maxAnswerLength: input.question.maxAnswerLength,
          version: input.question.version,
        },
      });

      if (sourceChunkIds.length > 0) {
        await tx.openQuestionSource.createMany({
          data: sourceChunkIds.map((chunkId) => ({
            questionId: question.id,
            subjectId: input.subjectId,
            chunkId,
          })),
        });
      }

      return toOpenQuestionActivity({
        id: session.id,
        subjectId: session.subjectId,
        knowledgeUnitId: session.knowledgeUnitId,
        type: session.type,
        status: session.status,
        version: session.version,
        documentId: session.documentId,
        questions: [],
        openQuestion: {
          id: question.id,
          sessionId: question.sessionId,
          subjectId: question.subjectId,
          documentId: question.documentId,
          knowledgeUnitId: question.knowledgeUnitId,
          prompt: question.prompt,
          instructions: question.instructions,
          maxAnswerLength: question.maxAnswerLength,
          version: question.version,
          sources: sourceChunkIds
            .map((chunkId) => sourceChunkById.get(chunkId))
            .filter((chunk): chunk is DocumentChunkRecord => Boolean(chunk))
            .map((chunk) => ({
              chunkId: chunk.id,
              chunk: {
                id: chunk.id,
                documentId: chunk.documentId,
                subjectId: chunk.subjectId,
                pageNumber: chunk.pageNumber,
                index: chunk.index,
                text: chunk.text,
              },
            })),
        },
      });
    });
  }

  async createRichClosedExerciseSession(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
    documentId?: string | null;
    exercise: GeneratedRichClosedExercise;
    qualityMetrics?: unknown;
    generationMetadata?: RichClosedQuestionGenerationMetadata;
  }): Promise<RichClosedPublicExerciseEnvelope> {
    assertRichClosedExerciseIsPersistable(input.exercise);

    return this.prisma.$transaction(async (tx) => {
      const knowledgeUnit = await tx.knowledgeUnit.findFirst({
        where: {
          id: input.knowledgeUnitId,
          subjectId: input.subjectId,
          subject: {
            studentId: input.studentId,
          },
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Knowledge unit does not belong to student subject');
      }

      const sourceChunkIds = collectRichClosedSourceChunkIds(input.exercise);
      const sourceChunks =
        sourceChunkIds.length === 0
          ? []
          : await tx.documentChunk.findMany({
              where: {
                id: {
                  in: sourceChunkIds,
                },
                subjectId: input.subjectId,
                ...(input.documentId ? { documentId: input.documentId } : {}),
              },
              select: {
                id: true,
              },
            });

      if (sourceChunks.length !== sourceChunkIds.length) {
        throw new Error(RICH_CLOSED_GENERATION_SOURCE_INVALID);
      }

      const session = await tx.activitySession.create({
        data: buildRichClosedActivitySessionCreateData(input),
      });
      const exercise: RichClosedExercise = {
        id: input.exercise.id,
        version: input.exercise.version,
        title: input.exercise.title,
        subjectId: input.subjectId,
        documentId: input.documentId ?? null,
        knowledgeUnitId: input.knowledgeUnitId,
        questions: input.exercise.questions,
      };

      await tx.richClosedExercisePayload.create({
        data: {
          activitySessionId: session.id,
          version: exercise.version,
          title: exercise.title,
          subjectId: input.subjectId,
          documentId: input.documentId ?? null,
          knowledgeUnitId: input.knowledgeUnitId,
          exercisePayload: toJsonValue(exercise),
          generationMetadata: toNullableJsonValue(
            input.generationMetadata ?? input.exercise.metadata,
          ),
          qualityMetrics: toNullableJsonValue(input.qualityMetrics),
        },
      });

      return toRichClosedPublicExerciseEnvelope({
        sessionId: session.id,
        exercise,
      });
    });
  }

  async getRichClosedExerciseForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RichClosedPublicExerciseEnvelope> {
    const session = await this.findRichClosedExerciseSession(input);

    return toRichClosedPublicExerciseEnvelope({
      sessionId: session.id,
      exercise: toRichClosedExercise(session.richClosedExercisePayload),
    });
  }

  async getInternalRichClosedExerciseForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RichClosedExerciseInternalEnvelope> {
    const session = await this.findRichClosedExerciseSession(input);
    const result = session.richClosedExerciseResult
      ? toRichClosedExerciseResult(session.id, session.richClosedExerciseResult)
      : null;

    return {
      sessionId: session.id,
      status: session.status,
      exercise: toRichClosedExercise(session.richClosedExercisePayload),
      result,
    };
  }

  async saveRichClosedExerciseResult(input: {
    studentId: string;
    sessionId: string;
    answers: RichClosedAnswer[];
    result: RichClosedExerciseResult;
  }): Promise<RichClosedExerciseResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = (await tx.activitySession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          richClosedExercisePayload: true,
          richClosedExerciseResult: true,
        },
      })) as RichClosedExerciseSessionRecord | null;

      assertRichClosedSession(session);

      if (
        session.status !== ActivityStatus.STARTED ||
        session.richClosedExerciseResult
      ) {
        throw new Error(RICH_CLOSED_SESSION_ALREADY_COMPLETED);
      }

      await tx.richClosedExerciseResult.create({
        data: {
          activitySessionId: session.id,
          answersPayload: toJsonValue(input.answers),
          correctionPayload: toJsonValue(input.result.items),
          correctAnswers: input.result.correctAnswers,
          totalQuestions: input.result.totalQuestions,
          score: input.result.score,
        },
      });

      await tx.activitySession.update({
        where: {
          id: session.id,
        },
        data: {
          status: ActivityStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return input.result;
    });
  }

  async getRichClosedExerciseResultForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RichClosedExerciseResult> {
    const session = await this.findRichClosedExerciseSession(input);

    if (!session.richClosedExerciseResult) {
      throw new Error(RICH_CLOSED_SESSION_NOT_COMPLETED);
    }

    return toRichClosedExerciseResult(
      session.id,
      session.richClosedExerciseResult,
    );
  }

  async submitResult(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{
      questionId: string;
      choiceId?: string;
      choiceIds?: string[];
    }>;
  }): Promise<DiagnosticQuizSubmissionResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.activitySession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          questions: {
            include: {
              sources: {
                include: {
                  chunk: true,
                },
              },
            },
            orderBy: {
              displayOrder: 'asc',
            },
          },
          result: true,
        },
      });

      if (!session) {
        throw new Error('Activity session not found');
      }

      if (session.status === ActivityStatus.COMPLETED || session.result) {
        throw new Error('Activity session already completed');
      }

      const result = scoreDiagnosticQuizSubmission(session, input.answers);

      if (result.items.every((item) => item.selectedChoiceId)) {
        await tx.questionAnswer.createMany({
          data: result.items.map((item) => ({
            sessionId: session.id,
            questionId: item.questionId,
            selectedChoiceId: item.selectedChoiceId,
            isCorrect: item.isCorrect,
          })),
        });
      } else {
        for (const item of result.items) {
          const answer = await tx.questionAnswer.create({
            data: {
              sessionId: session.id,
              questionId: item.questionId,
              selectedChoiceId: item.selectedChoiceId ?? null,
              isCorrect: item.isCorrect,
            },
          });

          if ((item.selectedChoiceIds ?? []).length > 0) {
            await tx.questionAnswerChoice.createMany({
              data: (item.selectedChoiceIds ?? []).map((choiceId) => ({
                answerId: answer.id,
                choiceId,
              })),
            });
          }
        }
      }

      await tx.activityResult.create({
        data: {
          sessionId: session.id,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          score: result.score,
        },
      });

      await tx.activitySession.update({
        where: {
          id: session.id,
        },
        data: {
          status: ActivityStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return {
        ...result,
        knowledgeUnitId: session.knowledgeUnitId,
      };
    });
  }

  private async findRichClosedExerciseSession(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RichClosedPersistedSessionRecord> {
    const session = (await this.prisma.activitySession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        richClosedExercisePayload: true,
        richClosedExerciseResult: true,
      },
    })) as RichClosedExerciseSessionRecord | null;

    assertRichClosedSession(session);

    return session;
  }

  async findOpenAnswerEvaluationContext(input: {
    studentId: string;
    sessionId: string;
  }): Promise<OpenAnswerEvaluationContext> {
    const session = (await this.prisma.activitySession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        knowledgeUnit: {
          include: {
            sources: {
              include: {
                chunk: true,
              },
            },
          },
        },
        openQuestion: {
          include: {
            sources: {
              include: {
                chunk: true,
              },
            },
          },
        },
        openAnswerEvaluation: true,
      },
    })) as OpenAnswerEvaluationSessionRecord | null;

    assertOpenQuestionSessionCanBeEvaluated(session);

    return toOpenAnswerEvaluationContext(session);
  }

  async saveOpenAnswerEvaluation(input: {
    studentId: string;
    sessionId: string;
    answerText: string;
    evaluation: OpenAnswerEvaluationDraft;
  }): Promise<OpenAnswerSubmissionResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = (await tx.activitySession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          knowledgeUnit: {
            include: {
              sources: {
                include: {
                  chunk: true,
                },
              },
            },
          },
          openQuestion: {
            include: {
              sources: {
                include: {
                  chunk: true,
                },
              },
            },
          },
          openAnswerEvaluation: true,
        },
      })) as OpenAnswerEvaluationSessionRecord | null;

      assertOpenQuestionSessionCanBeEvaluated(session);

      const sourceChunks = collectOpenQuestionSourceChunks(session);
      assertOpenAnswerEvaluationSources(input.evaluation, sourceChunks);
      const resultSourceChunks = selectOpenAnswerEvaluationSourceChunks(
        input.evaluation,
        sourceChunks,
      );

      const evaluation = await tx.openAnswerEvaluation.create({
        data: buildOpenAnswerEvaluationCreateData({
          session,
          studentId: input.studentId,
          answerText: input.answerText,
          evaluation: input.evaluation,
        }),
      });

      await tx.activitySession.update({
        where: {
          id: session.id,
        },
        data: {
          status: ActivityStatus.SUBMITTED,
          completedAt: new Date(),
        },
      });

      return toOpenAnswerSubmissionResult(evaluation, resultSourceChunks);
    });
  }
}

function buildActivitySessionCreateData(input: {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId?: string | null;
  quiz: GeneratedDiagnosticQuiz;
}) {
  const data: Prisma.ActivitySessionUncheckedCreateInput = {
    studentId: input.studentId,
    subjectId: input.subjectId,
    knowledgeUnitId: input.knowledgeUnitId,
    type: ActivityType.DIAGNOSTIC_QUIZ,
    status: ActivityStatus.STARTED,
  };

  if ((input.quiz.version ?? 1) > 1) {
    data.version = input.quiz.version;
    data.documentId = input.documentId ?? null;
  }

  if (input.quiz.metadata) {
    data.generationFlowName = input.quiz.metadata.flowName;
    data.generationProvider = input.quiz.metadata.provider;
    data.generationModel = input.quiz.metadata.model;
    data.generationPromptVersion = input.quiz.metadata.promptVersion;
    data.generationSchemaVersion = input.quiz.metadata.schemaVersion;
    data.generationInputSize = input.quiz.metadata.inputSize;
  }

  return data;
}

function buildOpenQuestionSessionCreateData(input: {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId?: string | null;
  question: OpenQuestionDraft;
}): Prisma.ActivitySessionUncheckedCreateInput {
  const data: Prisma.ActivitySessionUncheckedCreateInput = {
    studentId: input.studentId,
    subjectId: input.subjectId,
    knowledgeUnitId: input.knowledgeUnitId,
    documentId: input.documentId ?? null,
    type: ActivityType.OPEN_QUESTION,
    status: ActivityStatus.STARTED,
    version: input.question.version,
  };

  if (input.question.metadata) {
    data.generationFlowName = input.question.metadata.flowName;
    data.generationProvider = input.question.metadata.provider;
    data.generationModel = input.question.metadata.model;
    data.generationPromptVersion = input.question.metadata.promptVersion;
    data.generationSchemaVersion = input.question.metadata.schemaVersion;
    data.generationInputSize = input.question.metadata.inputSize;
  }

  return data;
}

function buildRichClosedActivitySessionCreateData(input: {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId?: string | null;
  exercise: GeneratedRichClosedExercise;
}): Prisma.ActivitySessionUncheckedCreateInput {
  const metadata = input.exercise.metadata;
  const data: Prisma.ActivitySessionUncheckedCreateInput = {
    studentId: input.studentId,
    subjectId: input.subjectId,
    knowledgeUnitId: input.knowledgeUnitId,
    documentId: input.documentId ?? null,
    type: ActivityType.RICH_CLOSED_EXERCISE,
    status: ActivityStatus.STARTED,
    version: 1,
  };

  if (metadata) {
    data.generationFlowName = metadata.flowName;
    data.generationProvider = metadata.provider;
    data.generationModel = metadata.model;
    data.generationPromptVersion = metadata.promptVersion;
    data.generationSchemaVersion = metadata.schemaVersion;
    data.generationInputSize = metadata.inputSize;
  }

  return data;
}

function assertRichClosedExerciseIsPersistable(
  exercise: RichClosedExercise,
): void {
  const validation = validateRichClosedExercise(exercise);

  if (!validation.accepted) {
    throw new Error(RICH_CLOSED_START_INVALID_INPUT);
  }
}

function assertRichClosedSession(
  session: RichClosedExerciseSessionRecord | null,
): asserts session is RichClosedExerciseSessionRecord & {
  richClosedExercisePayload: RichClosedExercisePayloadRecord;
} {
  if (!session) {
    throw new Error(RICH_CLOSED_SESSION_NOT_FOUND);
  }

  if (
    session.type !== ActivityType.RICH_CLOSED_EXERCISE ||
    !session.richClosedExercisePayload
  ) {
    throw new Error(RICH_CLOSED_SESSION_NOT_FOUND);
  }
}

function toRichClosedExercise(
  payload: RichClosedExercisePayloadRecord,
): RichClosedExercise {
  const exercise = payload.exercisePayload;
  const validation = validateRichClosedExercise(exercise);

  if (!validation.accepted || !isRichClosedExercise(exercise)) {
    throw new Error(RICH_CLOSED_START_INVALID_INPUT);
  }

  return exercise;
}

function toRichClosedExerciseResult(
  sessionId: string,
  result: RichClosedExerciseResultRecord,
): RichClosedExerciseResult {
  if (!Array.isArray(result.correctionPayload)) {
    throw new Error(RICH_CLOSED_START_INVALID_INPUT);
  }

  return {
    sessionId,
    type: 'rich_closed_exercise',
    status: 'completed',
    correctAnswers: result.correctAnswers,
    totalQuestions: result.totalQuestions,
    score: result.score,
    items: result.correctionPayload as RichClosedExerciseResult['items'],
  };
}

function collectRichClosedSourceChunkIds(
  exercise: RichClosedExercise,
): string[] {
  return dedupeStrings(
    exercise.questions.flatMap((question) => question.sourceChunkIds),
  );
}

function isRichClosedExercise(value: unknown): value is RichClosedExercise {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { questions?: unknown }).questions)
  );
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJsonValue(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return toJsonValue(value);
}

function buildQuestionCreateData(input: {
  sessionId: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  question: GeneratedDiagnosticQuizQuestion;
  index: number;
  isSourcedVersion: boolean;
}) {
  const selectionMode =
    input.question.selectionMode === 'multiple'
      ? QuestionSelectionMode.MULTIPLE
      : QuestionSelectionMode.SINGLE;
  const data: Prisma.QuestionUncheckedCreateInput = {
    sessionId: input.sessionId,
    bankQuestionId: input.question.bankQuestionId,
    knowledgeUnitId: input.knowledgeUnitId,
    prompt: input.question.prompt,
    choices: toQuestionChoicesJson(input.question.choices),
    correctChoiceId:
      selectionMode === QuestionSelectionMode.SINGLE
        ? (input.question.correctChoiceId ?? null)
        : null,
    explanation: input.question.explanation,
  };

  if (selectionMode === QuestionSelectionMode.MULTIPLE) {
    data.selectionMode = QuestionSelectionMode.MULTIPLE;
    data.minSelections = input.question.minSelections ?? null;
    data.maxSelections = input.question.maxSelections ?? null;
    data.correctChoiceIds = toCorrectChoiceIdsJson(
      input.question.correctChoiceIds ?? [],
    );
  }

  if (input.isSourcedVersion) {
    data.subjectId = input.subjectId;
    data.documentId = input.documentId;
    data.difficulty = input.question.difficulty ?? null;
    data.displayOrder = input.index;
  }

  return data;
}

function buildQuestionVisualCreateData(input: {
  questionId: string;
  visual: GeneratedDiagnosticQuizVisual;
  fallbackDisplayOrder: number;
}): Prisma.QuestionVisualUncheckedCreateInput {
  return {
    questionId: input.questionId,
    type: toPrismaQuestionVisualType(input.visual.type),
    displayOrder: input.visual.displayOrder ?? input.fallbackDisplayOrder,
    payload: toQuestionVisualPayload(input.visual),
  };
}

function toPrismaQuestionVisualType(
  type: GeneratedDiagnosticQuizVisual['type'],
) {
  if (type === 'IMAGE') {
    return QuestionVisualType.IMAGE;
  }

  if (type === 'CHART') {
    return QuestionVisualType.CHART;
  }

  return QuestionVisualType.DIAGRAM;
}

function toQuestionVisualPayload(
  visual: GeneratedDiagnosticQuizVisual,
): Prisma.InputJsonValue {
  if (visual.type === 'IMAGE') {
    return {
      imageUrl: visual.imageUrl,
      altText: visual.altText,
      ...(visual.caption === undefined ? {} : { caption: visual.caption }),
    };
  }

  if (visual.type === 'CHART') {
    return {
      chartType: visual.chartType,
      title: visual.title,
      ...(visual.description === undefined
        ? {}
        : { description: visual.description }),
      data: visual.data,
      ...(visual.xKey === undefined ? {} : { xKey: visual.xKey }),
      ...(visual.yKeys === undefined ? {} : { yKeys: visual.yKeys }),
    };
  }

  return {
    title: visual.title,
    ...(visual.description === undefined
      ? {}
      : { description: visual.description }),
    nodes: visual.nodes,
    ...(visual.edges === undefined ? {} : { edges: visual.edges }),
  };
}

function assertGeneratedQuizIsPersistable(quiz: GeneratedDiagnosticQuiz): void {
  if (quiz.title.trim().length === 0 || quiz.questions.length === 0) {
    throw new Error('Generated diagnostic quiz is invalid');
  }

  for (const question of quiz.questions) {
    if (
      question.prompt.trim().length === 0 ||
      question.explanation.trim().length === 0 ||
      question.choices.length < 2
    ) {
      throw new Error('Generated diagnostic quiz is invalid');
    }

    const choiceIds = question.choices.map((choice) => choice.id);
    const selectionMode = question.selectionMode ?? 'single';

    if (new Set(choiceIds).size !== choiceIds.length) {
      throw new Error('Generated diagnostic quiz is invalid');
    }

    if (selectionMode === 'multiple') {
      const correctChoiceIds = question.correctChoiceIds ?? [];
      const minSelections = question.minSelections ?? 1;
      const maxSelections = question.maxSelections ?? correctChoiceIds.length;

      if (
        correctChoiceIds.length === 0 ||
        new Set(correctChoiceIds).size !== correctChoiceIds.length ||
        correctChoiceIds.some((choiceId) => !choiceIds.includes(choiceId)) ||
        minSelections < 1 ||
        maxSelections < minSelections ||
        maxSelections > choiceIds.length
      ) {
        throw new Error('Generated diagnostic quiz is invalid');
      }
    } else if (!choiceIds.includes(question.correctChoiceId ?? '')) {
      throw new Error('Generated diagnostic quiz is invalid');
    }

    if (
      (quiz.version ?? 1) > 1 &&
      (question.sourceChunkIds ?? []).length === 0
    ) {
      throw new Error('Generated diagnostic quiz is invalid');
    }

    for (const visual of question.visuals ?? []) {
      if ((visual.sourceChunkIds ?? []).length === 0) {
        throw new Error('Generated diagnostic quiz is invalid');
      }
    }
  }
}

function scoreDiagnosticQuizSubmission(
  session: ActivitySessionRecord,
  answers: Array<{
    questionId: string;
    choiceId?: string;
    choiceIds?: string[];
  }>,
): DiagnosticQuizSubmissionResult {
  if (session.questions.length === 0) {
    throw new Error('Activity session has no questions');
  }

  const answersByQuestionId = new Map<
    string,
    { choiceId?: string; choiceIds?: string[] }
  >();

  for (const answer of answers) {
    if (answersByQuestionId.has(answer.questionId)) {
      throw new Error('Duplicate answers are not allowed');
    }

    answersByQuestionId.set(answer.questionId, {
      ...(answer.choiceId === undefined ? {} : { choiceId: answer.choiceId }),
      ...(answer.choiceIds === undefined
        ? {}
        : { choiceIds: answer.choiceIds }),
    });
  }

  const items: ActivityQuestionCorrectionItem[] = [];
  let correctAnswers = 0;
  const questionIds = new Set(session.questions.map((question) => question.id));

  for (const answer of answers) {
    if (!questionIds.has(answer.questionId)) {
      throw new Error('Question does not belong to activity session');
    }
  }

  for (const question of session.questions) {
    const answer = answersByQuestionId.get(question.id);

    if (!answer) {
      throw new Error('Missing answers are not allowed');
    }

    const choices = parseInternalQuestionChoices(question.choices);
    const selectionMode =
      question.selectionMode === 'MULTIPLE' ? 'multiple' : 'single';
    const item =
      selectionMode === 'multiple'
        ? scoreMultipleAnswerQuestion(question, answer, choices)
        : scoreSingleAnswerQuestion(question, answer, choices);

    if (item.isCorrect) {
      correctAnswers += 1;
    }

    items.push(item);
  }

  const totalQuestions = session.questions.length;
  const score =
    totalQuestions === 0
      ? 0
      : Number((correctAnswers / totalQuestions).toFixed(3));

  return {
    correctAnswers,
    totalQuestions,
    score,
    knowledgeUnitId: session.knowledgeUnitId,
    items,
  };
}

function scoreSingleAnswerQuestion(
  question: QuestionRecord,
  answer: { choiceId?: string; choiceIds?: string[] },
  choices: ActivityQuestionChoiceRecord[],
): ActivityQuestionCorrectionItem {
  if (answer.choiceId === undefined || answer.choiceIds !== undefined) {
    throw new Error('Answer shape does not match question selection mode');
  }

  if (!choices.some((choice) => choice.id === answer.choiceId)) {
    throw new Error('Choice does not belong to question');
  }

  if (!question.correctChoiceId) {
    throw new Error('Generated diagnostic quiz is invalid');
  }

  const isCorrect = answer.choiceId === question.correctChoiceId;

  return {
    ...buildCorrectionItemBase(question, choices),
    selectedChoiceId: answer.choiceId,
    correctChoiceId: question.correctChoiceId,
    isCorrect,
  };
}

function scoreMultipleAnswerQuestion(
  question: QuestionRecord,
  answer: { choiceId?: string; choiceIds?: string[] },
  choices: ActivityQuestionChoiceRecord[],
): ActivityQuestionCorrectionItem {
  if (answer.choiceIds === undefined || answer.choiceId !== undefined) {
    throw new Error('Answer shape does not match question selection mode');
  }

  const selectedChoiceIds = dedupeStrings(answer.choiceIds);

  if (selectedChoiceIds.length !== answer.choiceIds.length) {
    throw new Error('Duplicate choices are not allowed');
  }

  const minSelections = question.minSelections ?? 1;
  const maxSelections = question.maxSelections ?? choices.length;

  if (
    selectedChoiceIds.length < minSelections ||
    selectedChoiceIds.length > maxSelections
  ) {
    throw new Error('Selection count is invalid for question');
  }

  const knownChoiceIds = new Set(choices.map((choice) => choice.id));

  if (selectedChoiceIds.some((choiceId) => !knownChoiceIds.has(choiceId))) {
    throw new Error('Choice does not belong to question');
  }

  const correctChoiceIds = parseStringArray(question.correctChoiceIds);

  if (correctChoiceIds.length === 0) {
    throw new Error('Generated diagnostic quiz is invalid');
  }

  const isCorrect = areStringSetsEqual(selectedChoiceIds, correctChoiceIds);

  return {
    ...buildCorrectionItemBase(question, choices),
    selectedChoiceIds,
    correctChoiceIds,
    isCorrect,
    partialScore: isCorrect ? 1 : 0,
  };
}

function buildCorrectionItemBase(
  question: QuestionRecord,
  choices: ActivityQuestionChoiceRecord[],
) {
  return {
    questionId: question.id,
    knowledgeUnitId: question.knowledgeUnitId,
    prompt: question.prompt,
    explanation: question.explanation,
    choiceFeedback: choices
      .filter((choice) => typeof choice.feedback === 'string')
      .map((choice) => ({
        choiceId: choice.id,
        feedback: choice.feedback as string,
      })),
    sources: (question.sources ?? [])
      .map((source) => ({
        chunkId: source.chunkId,
        text: source.chunk.text,
        pageNumber: source.chunk.pageNumber,
        index: source.chunk.index,
      }))
      .sort((left, right) => left.index - right.index),
  };
}

function parseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((value): value is string => typeof value === 'string');
}

function areStringSetsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => rightValues.has(value));
}

function toDiagnosticQuizGenerationContext(
  knowledgeUnit: KnowledgeUnitRecord,
): DiagnosticQuizGenerationContext {
  const chunkById = new Map<string, DocumentChunkRecord>();

  for (const source of knowledgeUnit.sources ?? []) {
    chunkById.set(source.chunk.id, source.chunk);
  }

  const chunks = Array.from(chunkById.values())
    .sort((left, right) => left.index - right.index)
    .map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
    }));

  const baseKnowledgeUnit = new KnowledgeUnit({
    id: knowledgeUnit.id,
    subjectId: knowledgeUnit.subjectId,
    title: knowledgeUnit.title,
    summary: knowledgeUnit.summary,
  });

  return {
    documentId: knowledgeUnit.documentId,
    knowledgeUnit: Object.assign(baseKnowledgeUnit, {
      difficulty: knowledgeUnit.difficulty,
      sourceChunkIds: chunks.map((chunk) => chunk.id),
    }),
    chunks,
  };
}

function toDiagnosticQuizActivity(
  session: ActivitySessionRecord,
  title = 'Quiz de diagnostic',
): DiagnosticQuizActivity {
  const activity: DiagnosticQuizActivity = {
    sessionId: session.id,
    type: 'diagnostic_quiz',
    title,
    questions: session.questions.map(toActivityQuestion),
  };

  if ((session.version ?? 1) > 1) {
    activity.version = session.version;
    activity.documentId = session.documentId ?? null;
    activity.subjectId = session.subjectId;
  }

  return activity;
}

function toOpenQuestionActivity(
  session: OpenQuestionSessionRecord,
): OpenQuestionActivity {
  if (!session.openQuestion) {
    throw new Error('Open question not found');
  }

  return {
    sessionId: session.id,
    type: 'open_question',
    version: session.openQuestion.version,
    subjectId: session.subjectId,
    documentId: session.openQuestion.documentId,
    knowledgeUnitId: session.knowledgeUnitId,
    question: {
      id: session.openQuestion.id,
      prompt: session.openQuestion.prompt,
      instructions: session.openQuestion.instructions,
      maxAnswerLength: session.openQuestion.maxAnswerLength,
      sources: (session.openQuestion.sources ?? [])
        .map((source) => ({
          chunkId: source.chunkId,
          pageNumber: source.chunk.pageNumber,
          index: source.chunk.index,
        }))
        .sort((left, right) => left.index - right.index),
    },
  };
}

function assertOpenQuestionSessionCanBeEvaluated(
  session: OpenAnswerEvaluationSessionRecord | null,
): asserts session is OpenAnswerEvaluationSessionRecord & {
  openQuestion: OpenQuestionRecord;
} {
  if (!session) {
    throw new Error('Activity session not found');
  }

  if (session.type !== ActivityType.OPEN_QUESTION) {
    throw new Error('Activity session is not an open question');
  }

  if (
    session.status !== ActivityStatus.STARTED ||
    session.openAnswerEvaluation
  ) {
    throw new Error('Activity session already submitted');
  }

  if (!session.openQuestion) {
    throw new Error('Open question not found');
  }
}

function toOpenAnswerEvaluationContext(
  session: OpenAnswerEvaluationSessionRecord & {
    openQuestion: OpenQuestionRecord;
  },
): OpenAnswerEvaluationContext {
  const chunks = collectOpenQuestionSourceChunks(session);

  return {
    sessionId: session.id,
    subjectId: session.subjectId,
    documentId: session.openQuestion.documentId,
    knowledgeUnit: Object.assign(
      new KnowledgeUnit({
        id: session.knowledgeUnit.id,
        subjectId: session.knowledgeUnit.subjectId,
        title: session.knowledgeUnit.title,
        summary: session.knowledgeUnit.summary,
      }),
      {
        difficulty: session.knowledgeUnit.difficulty,
        sourceChunkIds: chunks.map((chunk) => chunk.id),
      },
    ),
    question: {
      id: session.openQuestion.id,
      prompt: session.openQuestion.prompt,
      instructions: session.openQuestion.instructions,
      sourceChunkIds: chunks.map((chunk) => chunk.id),
    },
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
    })),
  };
}

function collectOpenQuestionSourceChunks(
  session: OpenAnswerEvaluationSessionRecord & {
    openQuestion: OpenQuestionRecord;
  },
): DocumentChunkRecord[] {
  const chunksById = new Map<string, DocumentChunkRecord>();

  for (const source of session.openQuestion.sources ?? []) {
    chunksById.set(source.chunk.id, source.chunk);
  }

  if (chunksById.size === 0) {
    for (const source of session.knowledgeUnit.sources ?? []) {
      chunksById.set(source.chunk.id, source.chunk);
    }
  }

  return [...chunksById.values()].sort(
    (left, right) => left.index - right.index,
  );
}

function assertOpenAnswerEvaluationSources(
  evaluation: OpenAnswerEvaluationDraft,
  sourceChunks: DocumentChunkRecord[],
): void {
  if (evaluation.status === 'FAILED') {
    return;
  }

  const knownChunkIds = new Set(sourceChunks.map((chunk) => chunk.id));
  const sourceChunkIds = dedupeStrings(evaluation.sourceChunkIds);

  if (sourceChunks.length === 0 && sourceChunkIds.length > 0) {
    throw new Error('OPEN_ANSWER_EVALUATION_SOURCE_INVALID');
  }

  if (
    sourceChunks.length > 0 &&
    (sourceChunkIds.length === 0 ||
      sourceChunkIds.some((chunkId) => !knownChunkIds.has(chunkId)))
  ) {
    throw new Error('OPEN_ANSWER_EVALUATION_SOURCE_INVALID');
  }
}

function selectOpenAnswerEvaluationSourceChunks(
  evaluation: OpenAnswerEvaluationDraft,
  sourceChunks: DocumentChunkRecord[],
): DocumentChunkRecord[] {
  if (evaluation.status === 'FAILED') {
    return [];
  }

  const requestedIds = new Set(evaluation.sourceChunkIds);

  return sourceChunks.filter((chunk) => requestedIds.has(chunk.id));
}

function buildOpenAnswerEvaluationCreateData(input: {
  session: OpenAnswerEvaluationSessionRecord & {
    openQuestion: OpenQuestionRecord;
  };
  studentId: string;
  answerText: string;
  evaluation: OpenAnswerEvaluationDraft;
}): Prisma.OpenAnswerEvaluationUncheckedCreateInput {
  const base: Prisma.OpenAnswerEvaluationUncheckedCreateInput = {
    sessionId: input.session.id,
    openQuestionId: input.session.openQuestion.id,
    studentId: input.studentId,
    subjectId: input.session.subjectId,
    answerText: input.answerText,
    status:
      input.evaluation.status === 'READY'
        ? OpenAnswerEvaluationStatus.READY
        : OpenAnswerEvaluationStatus.FAILED,
    score: null,
    maxScore: null,
    feedback: null,
    presentPoints: [],
    missingPoints: [],
    errors: [],
    modelAnswer: null,
    advice: null,
  };

  if (input.evaluation.metadata) {
    base.generationFlowName = input.evaluation.metadata.flowName;
    base.generationProvider = input.evaluation.metadata.provider;
    base.generationModel = input.evaluation.metadata.model;
    base.generationPromptVersion = input.evaluation.metadata.promptVersion;
    base.generationSchemaVersion = input.evaluation.metadata.schemaVersion;
    base.generationInputSize = input.evaluation.metadata.inputSize;
  }

  if (input.evaluation.status === 'FAILED') {
    base.errorCode = input.evaluation.errorCode;
    base.errors = [input.evaluation.errorCode];
    return base;
  }

  base.score = input.evaluation.score;
  base.maxScore = input.evaluation.maxScore;
  base.feedback = input.evaluation.feedback;
  base.presentPoints = input.evaluation.presentPoints;
  base.missingPoints = input.evaluation.missingPoints;
  base.errors = input.evaluation.errors;
  base.modelAnswer = input.evaluation.modelAnswer;
  base.advice = input.evaluation.advice;

  return base;
}

function toOpenAnswerSubmissionResult(
  evaluation: OpenAnswerEvaluationRecord,
  sourceChunks: DocumentChunkRecord[] = [],
): OpenAnswerSubmissionResult {
  return {
    sessionId: evaluation.sessionId,
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: evaluation.id,
      status: evaluation.status,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      feedback: evaluation.feedback,
      presentPoints: parseJsonArray(evaluation.presentPoints),
      missingPoints: parseJsonArray(evaluation.missingPoints),
      errors: parseJsonArray(evaluation.errors),
      modelAnswer: evaluation.modelAnswer,
      advice: evaluation.advice,
      sources:
        evaluation.status === 'READY'
          ? sourceChunks.map((chunk) => ({
              chunkId: chunk.id,
              text: truncateText(
                chunk.text,
                OPEN_ANSWER_SOURCE_EXCERPT_MAX_LENGTH,
              ),
              pageNumber: chunk.pageNumber,
              index: chunk.index,
            }))
          : [],
    },
  };
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).trimEnd();
}

function parseJsonArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function toActivityQuestion(question: QuestionRecord): ActivityQuestion {
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
    difficulty: question.difficulty ?? null,
    ...(question.selectionMode === 'MULTIPLE'
      ? { selectionMode: toPublicSelectionMode(question.selectionMode) }
      : {}),
    ...(question.minSelections === undefined
      ? {}
      : { minSelections: question.minSelections }),
    ...(question.maxSelections === undefined
      ? {}
      : { maxSelections: question.maxSelections }),
    choices: parsePublicQuestionChoices(question.choices),
    ...(sources.length > 0 ? { sources } : {}),
    ...toPublicQuestionVisuals(question.visuals),
  };
}

function toPublicSelectionMode(
  selectionMode: QuestionRecord['selectionMode'],
): 'single' | 'multiple' {
  return selectionMode === 'MULTIPLE' ? 'multiple' : 'single';
}

function toPublicQuestionVisuals(visuals: QuestionVisualRecord[] | undefined) {
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
  visual: QuestionVisualRecord,
): ActivityQuestionVisual | null {
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

function toQuestionChoicesJson(
  choices: GeneratedDiagnosticQuizChoice[],
): Prisma.InputJsonValue {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    ...(choice.feedback !== undefined ? { feedback: choice.feedback } : {}),
  }));
}

function toCorrectChoiceIdsJson(choiceIds: string[]): Prisma.InputJsonValue {
  return choiceIds;
}

function parsePublicQuestionChoices(input: unknown) {
  return parseInternalQuestionChoices(input).map((choice) => ({
    id: choice.id,
    label: choice.label,
  }));
}

function parseInternalQuestionChoices(
  input: unknown,
): ActivityQuestionChoiceRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (choice): choice is Record<string, unknown> =>
        typeof choice === 'object' && choice !== null,
    )
    .map((choice) => ({
      id: typeof choice.id === 'string' ? choice.id : '',
      label: typeof choice.label === 'string' ? choice.label : '',
      feedback:
        typeof choice.feedback === 'string'
          ? choice.feedback
          : choice.feedback === null
            ? null
            : undefined,
    }))
    .filter((choice) => choice.id.length > 0 && choice.label.length > 0);
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

function collectQuizSourceChunkIds(
  questions: GeneratedDiagnosticQuizQuestion[],
): string[] {
  return dedupeStrings(
    questions.flatMap((question) => [
      ...(question.sourceChunkIds ?? []),
      ...(question.visuals ?? []).flatMap((visual) => visual.sourceChunkIds),
    ]),
  );
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
