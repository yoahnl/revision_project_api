import { Injectable } from '@nestjs/common';
import { ActivityStatus, ActivityType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  ActivitiesRepository,
  ActivityQuestion,
  ActivityQuestionChoice,
  DiagnosticQuizActivity,
} from '../application/activities.repository';

const DIAGNOSTIC_QUIZ = {
  title: 'Diagnostic rapide',
  question: {
    prompt:
      'Quelle structure est principalement responsable de la contraction cardiaque ?',
    choices: [
      { id: 'a', label: 'Myocarde' },
      { id: 'b', label: 'Pericarde' },
    ],
    correctChoiceId: 'a',
    explanation: 'Le myocarde est le muscle cardiaque.',
  },
};

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
  }): Promise<DiagnosticQuizActivity> {
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

      const question = await tx.question.create({
        data: {
          sessionId: session.id,
          knowledgeUnitId: input.knowledgeUnitId,
          prompt: DIAGNOSTIC_QUIZ.question.prompt,
          choices: DIAGNOSTIC_QUIZ.question.choices,
          correctChoiceId: DIAGNOSTIC_QUIZ.question.correctChoiceId,
          explanation: DIAGNOSTIC_QUIZ.question.explanation,
        },
      });

      return {
        sessionId: session.id,
        type: 'diagnostic_quiz',
        title: DIAGNOSTIC_QUIZ.title,
        questions: [toActivityQuestion(question)],
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
