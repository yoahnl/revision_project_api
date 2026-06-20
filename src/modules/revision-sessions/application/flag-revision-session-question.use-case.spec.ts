import { QuestionBankItemStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { FlagRevisionSessionQuestionUseCase } from './flag-revision-session-question.use-case';

describe('FlagRevisionSessionQuestionUseCase', () => {
  it('flags the bank item linked to a question owned by the current session', async () => {
    const { mocks, useCase } = createHarness();
    mocks.revisionSessionFindFirst.mockResolvedValueOnce({
      id: 'session-1',
      actions: [{ activitySessionId: 'activity-1' }],
    });
    mocks.questionFindFirst.mockResolvedValueOnce({
      bankQuestionId: 'bank-question-1',
    });
    mocks.questionBankItemUpdateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      useCase.execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        questionId: 'question-1',
        reason: 'ambiguë',
      }),
    ).resolves.toEqual({ status: 'flagged' });

    expect(mocks.questionFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'question-1',
        sessionId: { in: ['activity-1'] },
        session: { studentId: 'student-1' },
      },
      select: { bankQuestionId: true },
    });
    const updateCall = mocks.questionBankItemUpdateMany.mock.calls.at(
      0,
    )?.[0] as QuestionBankItemUpdateManyInput | undefined;

    expect(updateCall).toMatchObject({
      where: {
        id: 'bank-question-1',
        studentId: 'student-1',
      },
      data: {
        status: QuestionBankItemStatus.FLAGGED,
        flagReason: 'ambiguë',
      },
    });
    expect(updateCall?.data.flaggedAt).toBeInstanceOf(Date);
  });

  it('refuses an unknown or cross-student session before reading the question', async () => {
    const { mocks, useCase } = createHarness();
    mocks.revisionSessionFindFirst.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        studentId: 'student-2',
        sessionId: 'session-1',
        questionId: 'question-1',
      }),
    ).rejects.toThrow('Revision session not found');

    expect(mocks.questionFindFirst).not.toHaveBeenCalled();
    expect(mocks.questionBankItemUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses a question that is not part of the session activity', async () => {
    const { mocks, useCase } = createHarness();
    mocks.revisionSessionFindFirst.mockResolvedValueOnce({
      id: 'session-1',
      actions: [{ activitySessionId: 'activity-1' }],
    });
    mocks.questionFindFirst.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        questionId: 'question-other',
      }),
    ).rejects.toThrow('Revision session question not found');

    expect(mocks.questionBankItemUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses a legacy question without a bank link', async () => {
    const { mocks, useCase } = createHarness();
    mocks.revisionSessionFindFirst.mockResolvedValueOnce({
      id: 'session-1',
      actions: [{ activitySessionId: 'activity-1' }],
    });
    mocks.questionFindFirst.mockResolvedValueOnce({
      bankQuestionId: null,
    });

    await expect(
      useCase.execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        questionId: 'question-legacy',
      }),
    ).rejects.toThrow('Revision session question cannot be flagged');

    expect(mocks.questionBankItemUpdateMany).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const mocks = {
    revisionSessionFindFirst: jest.fn<
      Promise<RevisionSessionLookup | null>,
      [unknown]
    >(),
    questionFindFirst: jest.fn<Promise<QuestionLookup | null>, [unknown]>(),
    questionBankItemUpdateMany: jest.fn<
      Promise<QuestionBankItemUpdateManyResult>,
      [unknown]
    >(),
  };
  const prisma = {
    revisionSession: {
      findFirst: mocks.revisionSessionFindFirst,
    },
    question: {
      findFirst: mocks.questionFindFirst,
    },
    questionBankItem: {
      updateMany: mocks.questionBankItemUpdateMany,
    },
  } as unknown as PrismaService;

  return {
    mocks,
    useCase: new FlagRevisionSessionQuestionUseCase(prisma),
  };
}

interface RevisionSessionLookup {
  id: string;
  actions: Array<{ activitySessionId: string | null }>;
}

interface QuestionLookup {
  bankQuestionId: string | null;
}

interface QuestionBankItemUpdateManyResult {
  count: number;
}

interface QuestionBankItemUpdateManyInput {
  where: {
    id: string;
    studentId: string;
  };
  data: {
    status: QuestionBankItemStatus;
    flaggedAt: Date;
    flagReason: string | null;
  };
}
