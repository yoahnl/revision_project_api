import { Injectable } from '@nestjs/common';
import { ActivityStatus, ActivityType } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import type {
  ActivitiesRepository,
  ActivityQuestion,
  ActivityQuestionCorrectionItem,
  DiagnosticQuizActivity,
  DiagnosticQuizGenerationContext,
  DiagnosticQuizSubmissionResult,
} from '../application/activities.repository';
import type {
  GeneratedDiagnosticQuiz,
  GeneratedDiagnosticQuizChoice,
  GeneratedDiagnosticQuizQuestion,
} from '../application/diagnostic-quiz-generator';

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
  knowledgeUnitId: string;
  prompt: string;
  choices: unknown;
  correctChoiceId: string;
  explanation: string;
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  displayOrder?: number;
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
            isV2: input.quiz.version === 2,
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

        questions.push({
          id: createdQuestion.id,
          knowledgeUnitId: createdQuestion.knowledgeUnitId,
          prompt: createdQuestion.prompt,
          choices: createdQuestion.choices,
          correctChoiceId: createdQuestion.correctChoiceId,
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

  async submitResult(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{ questionId: string; choiceId: string }>;
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

      await tx.questionAnswer.createMany({
        data: result.items.map((item) => ({
          sessionId: session.id,
          questionId: item.questionId,
          selectedChoiceId: item.selectedChoiceId,
          isCorrect: item.isCorrect,
        })),
      });

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

  if (input.quiz.version === 2) {
    data.version = 2;
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

function buildQuestionCreateData(input: {
  sessionId: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  question: GeneratedDiagnosticQuizQuestion;
  index: number;
  isV2: boolean;
}) {
  const data: Prisma.QuestionUncheckedCreateInput = {
    sessionId: input.sessionId,
    knowledgeUnitId: input.knowledgeUnitId,
    prompt: input.question.prompt,
    choices: toQuestionChoicesJson(input.question.choices),
    correctChoiceId: input.question.correctChoiceId,
    explanation: input.question.explanation,
  };

  if (input.isV2) {
    data.subjectId = input.subjectId;
    data.documentId = input.documentId;
    data.difficulty = input.question.difficulty ?? null;
    data.displayOrder = input.index;
  }

  return data;
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

    if (
      new Set(choiceIds).size !== choiceIds.length ||
      !choiceIds.includes(question.correctChoiceId)
    ) {
      throw new Error('Generated diagnostic quiz is invalid');
    }

    if (quiz.version === 2 && (question.sourceChunkIds ?? []).length === 0) {
      throw new Error('Generated diagnostic quiz is invalid');
    }
  }
}

function scoreDiagnosticQuizSubmission(
  session: ActivitySessionRecord,
  answers: Array<{ questionId: string; choiceId: string }>,
): DiagnosticQuizSubmissionResult {
  if (session.questions.length === 0) {
    throw new Error('Activity session has no questions');
  }

  const answersByQuestionId = new Map<string, string>();

  for (const answer of answers) {
    if (answersByQuestionId.has(answer.questionId)) {
      throw new Error('Duplicate answers are not allowed');
    }

    answersByQuestionId.set(answer.questionId, answer.choiceId);
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
    const selectedChoiceId = answersByQuestionId.get(question.id);

    if (!selectedChoiceId) {
      throw new Error('Missing answers are not allowed');
    }

    const choices = parseInternalQuestionChoices(question.choices);

    if (!choices.some((choice) => choice.id === selectedChoiceId)) {
      throw new Error('Choice does not belong to question');
    }

    const isCorrect = selectedChoiceId === question.correctChoiceId;

    if (isCorrect) {
      correctAnswers += 1;
    }

    items.push({
      questionId: question.id,
      knowledgeUnitId: question.knowledgeUnitId,
      prompt: question.prompt,
      selectedChoiceId,
      correctChoiceId: question.correctChoiceId,
      isCorrect,
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
    });
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
    choices: parsePublicQuestionChoices(question.choices),
    ...(sources.length > 0 ? { sources } : {}),
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

function collectQuizSourceChunkIds(
  questions: GeneratedDiagnosticQuizQuestion[],
): string[] {
  return dedupeStrings(
    questions.flatMap((question) => question.sourceChunkIds ?? []),
  );
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
