import { Injectable } from '@nestjs/common';
import { QuestionBankItemStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

export interface FlagRevisionSessionQuestionResult {
  status: 'flagged';
}

@Injectable()
export class FlagRevisionSessionQuestionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
    questionId: string;
    reason?: string | null;
  }): Promise<FlagRevisionSessionQuestionResult> {
    const session = await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      select: {
        id: true,
        actions: {
          where: {
            activitySessionId: {
              not: null,
            },
          },
          select: {
            activitySessionId: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Revision session not found');
    }

    const activitySessionIds = session.actions
      .map((action) => action.activitySessionId)
      .filter((id): id is string => typeof id === 'string');

    if (activitySessionIds.length === 0) {
      throw new Error('Revision session question not found');
    }

    const question = await this.prisma.question.findFirst({
      where: {
        id: input.questionId,
        sessionId: {
          in: activitySessionIds,
        },
        session: {
          studentId: input.studentId,
        },
      },
      select: {
        bankQuestionId: true,
      },
    });

    if (!question) {
      throw new Error('Revision session question not found');
    }

    if (!question.bankQuestionId) {
      throw new Error('Revision session question cannot be flagged');
    }

    await this.prisma.questionBankItem.updateMany({
      where: {
        id: question.bankQuestionId,
        studentId: input.studentId,
      },
      data: {
        status: QuestionBankItemStatus.FLAGGED,
        flaggedAt: new Date(),
        flagReason: input.reason ?? null,
      },
    });

    return { status: 'flagged' };
  }
}
