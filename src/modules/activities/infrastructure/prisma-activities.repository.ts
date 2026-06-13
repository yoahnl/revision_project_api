import { Injectable } from '@nestjs/common';
import { ActivityStatus, ActivityType } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { GeneratedDiagnosticQuiz } from '../application/diagnostic-quiz-generator';
import type {
  ActivitiesRepository,
  ActivityQuestion,
  ActivityQuestionChoice,
  DiagnosticQuizActivity,
} from '../application/activities.repository';

interface QuestionRecord {
  id: string;
  prompt: string;
  choices: unknown;
  correctChoiceId: string;
}

interface SessionWithQuestionsRecord {
  status: ActivityStatus;
  questions: QuestionRecord[];
  result: object | null;
}

@Injectable()
export class PrismaActivitiesRepository implements ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDiagnosticQuiz(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
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

      const session = await tx.activitySession.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          knowledgeUnitId: input.knowledgeUnitId,
          type: ActivityType.DIAGNOSTIC_QUIZ,
          status: ActivityStatus.STARTED,
        },
      });

      const questions: QuestionRecord[] = [];

      for (const generatedQuestion of input.quiz.questions) {
        questions.push(
          await tx.question.create({
            data: {
              sessionId: session.id,
              knowledgeUnitId: input.knowledgeUnitId,
              prompt: generatedQuestion.prompt,
              choices: toQuestionChoicesJson(generatedQuestion.choices),
              correctChoiceId: generatedQuestion.correctChoiceId,
              explanation: generatedQuestion.explanation,
            },
          }),
        );
      }

      return {
        sessionId: session.id,
        type: 'diagnostic_quiz',
        title: input.quiz.title,
        questions: questions.map(toActivityQuestion),
      };
    });
  }

  async submitResult(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{ questionId: string; choiceId: string }>;
  }): Promise<{
    correctAnswers: number;
    totalQuestions: number;
    knowledgeUnitId: string;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.activitySession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          questions: true,
          result: true,
        },
      });

      if (!session) {
        throw new Error('Activity session not found');
      }

      if (session.status === ActivityStatus.COMPLETED || session.result) {
        throw new Error('Activity session already completed');
      }

      const score = scoreAnswers(session, input.answers);

      await tx.activityResult.create({
        data: {
          sessionId: input.sessionId,
          correctAnswers: score.correctAnswers,
          totalQuestions: score.totalQuestions,
        },
      });

      await tx.activitySession.update({
        where: { id: input.sessionId },
        data: {
          status: ActivityStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return {
        ...score,
        knowledgeUnitId: session.knowledgeUnitId,
      };
    });
  }
}

function assertGeneratedQuizIsPersistable(quiz: GeneratedDiagnosticQuiz): void {
  if (quiz.title.trim().length < 2 || quiz.questions.length === 0) {
    throw new Error('Generated diagnostic quiz is invalid');
  }

  for (const question of quiz.questions) {
    const choiceIds = new Set(question.choices.map((choice) => choice.id));

    if (
      question.prompt.trim().length === 0 ||
      question.explanation.trim().length === 0 ||
      question.choices.length < 2 ||
      choiceIds.size !== question.choices.length ||
      !choiceIds.has(question.correctChoiceId)
    ) {
      throw new Error('Generated diagnostic quiz is invalid');
    }
  }
}

function toQuestionChoicesJson(
  choices: ActivityQuestionChoice[],
): Prisma.InputJsonValue {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
  }));
}

function scoreAnswers(
  session: SessionWithQuestionsRecord,
  answers: Array<{ questionId: string; choiceId: string }>,
): { correctAnswers: number; totalQuestions: number } {
  const questionsById = new Map(
    session.questions.map((question) => [question.id, question]),
  );
  const answeredQuestionIds = new Set<string>();
  let correctAnswers = 0;

  for (const answer of answers) {
    if (answeredQuestionIds.has(answer.questionId)) {
      throw new Error('Duplicate answers are not allowed');
    }
    answeredQuestionIds.add(answer.questionId);

    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new Error('Question does not belong to activity session');
    }

    const choices = parseActivityQuestionChoices(question.choices);
    if (!choices.some((choice) => choice.id === answer.choiceId)) {
      throw new Error('Choice does not belong to question');
    }

    if (question.correctChoiceId === answer.choiceId) {
      correctAnswers += 1;
    }
  }

  return {
    correctAnswers,
    totalQuestions: session.questions.length,
  };
}

function toActivityQuestion(question: QuestionRecord): ActivityQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    choices: parseActivityQuestionChoices(question.choices),
  };
}

function parseActivityQuestionChoices(
  input: unknown,
): ActivityQuestionChoice[] {
  if (!Array.isArray(input)) {
    throw new Error('Question choices are invalid');
  }

  return (input as unknown[]).map((choice) => {
    if (!isActivityQuestionChoice(choice)) {
      throw new Error('Question choices are invalid');
    }

    return choice;
  });
}

function isActivityQuestionChoice(
  input: unknown,
): input is ActivityQuestionChoice {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const choice = input as Record<string, unknown>;
  return typeof choice.id === 'string' && typeof choice.label === 'string';
}
