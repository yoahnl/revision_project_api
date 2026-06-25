import {
  KnowledgeUnitDifficulty,
  QuestionBankItemStatus,
  QuestionSelectionMode,
  QuestionVisualType,
} from '../../../generated/prisma/enums';
import type { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { PrismaQuestionBankRepository } from './prisma-question-bank.repository';

describe('PrismaQuestionBankRepository', () => {
  it('counts active course quick questions across knowledge units', async () => {
    const { mocks, repository } = createHarness();
    mocks.questionBankItemCount.mockResolvedValue(12);

    await expect(
      repository.countActiveCourseQuickQuestions({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        knowledgeUnitIds: ['ku-1', 'ku-2'],
      }),
    ).resolves.toBe(12);

    expect(mocks.questionBankItemCount).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        knowledgeUnitId: { in: ['ku-1', 'ku-2'] },
        status: QuestionBankItemStatus.ACTIVE,
      },
    });
  });

  it('counts active course quick questions grouped by knowledge unit', async () => {
    const { mocks, repository } = createHarness();
    mocks.questionBankItemGroupBy.mockResolvedValue([
      { knowledgeUnitId: 'ku-1', _count: { _all: 3 } },
      { knowledgeUnitId: 'ku-3', _count: { _all: 1 } },
    ]);

    await expect(
      repository.countActiveCourseQuickQuestionsByKnowledgeUnit({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        knowledgeUnitIds: ['ku-1', 'ku-2', 'ku-3'],
      }),
    ).resolves.toEqual(
      new Map([
        ['ku-1', 3],
        ['ku-2', 0],
        ['ku-3', 1],
      ]),
    );

    expect(mocks.questionBankItemGroupBy).toHaveBeenCalledWith({
      by: ['knowledgeUnitId'],
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        knowledgeUnitId: { in: ['ku-1', 'ku-2', 'ku-3'] },
        status: QuestionBankItemStatus.ACTIVE,
      },
      _count: { _all: true },
    });
  });

  it('persists generated questions with sources and visuals', async () => {
    const { mocks, repository } = createHarness();
    mocks.questionBankItemFindUnique.mockResolvedValue(null);
    mocks.questionBankItemCreate.mockResolvedValue({ id: 'bank-1' });

    await expect(
      repository.persistGeneratedQuestions({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        quiz: {
          title: 'Révision rapide',
          version: 3,
          questions: [
            {
              prompt: 'Quelle règle encadre la révision constitutionnelle ?',
              difficulty: 'MEDIUM',
              selectionMode: 'single',
              choices: [
                { id: 'a', label: 'Article 89' },
                { id: 'b', label: 'Article 1' },
              ],
              correctChoiceId: 'a',
              explanation: 'Article 89 organise la révision.',
              sourceChunkIds: ['chunk-1'],
              visuals: [
                {
                  type: 'DIAGRAM',
                  displayOrder: 0,
                  title: 'Processus',
                  description: null,
                  nodes: [{ id: 'n1', label: 'Initiative' }],
                  edges: [],
                  sourceChunkIds: ['chunk-1'],
                },
              ],
            },
          ],
        },
      }),
    ).resolves.toEqual({
      persistedCount: 1,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
    });

    const createInput = mocks.questionBankItemCreate.mock.calls[0]?.[0] as
      | { data: { prompt: string; selectionMode: QuestionSelectionMode } }
      | undefined;
    expect(createInput?.data.prompt).toBe(
      'Quelle règle encadre la révision constitutionnelle ?',
    );
    expect(createInput?.data.selectionMode).toBe(QuestionSelectionMode.SINGLE);
    expect(mocks.questionBankItemSourceCreateMany).toHaveBeenCalledWith({
      data: [
        {
          questionBankItemId: 'bank-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
        },
      ],
    });
    expect(mocks.questionBankItemVisualCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          questionBankItemId: 'bank-1',
          type: QuestionVisualType.DIAGRAM,
        }),
      ],
    });
  });

  it('skips duplicate and PDF-structure questions during persistence', async () => {
    const { mocks, repository } = createHarness();
    mocks.questionBankItemFindUnique.mockResolvedValue({ id: 'existing-1' });

    await expect(
      repository.persistGeneratedQuestions({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'ku-1',
        quiz: {
          title: 'Révision rapide',
          version: 3,
          questions: [
            generatedQuestion('duplicate prompt'),
            generatedQuestion('Selon la table des matières, quelle page ?'),
          ],
        },
      }),
    ).resolves.toEqual({
      persistedCount: 0,
      duplicateSkippedCount: 1,
      structureSkippedCount: 1,
    });

    expect(mocks.questionBankItemCreate).not.toHaveBeenCalled();
  });

  it('reserves balanced questions and retries after a reservation conflict', async () => {
    const { mocks, repository } = createHarness();
    mocks.questionBankItemFindMany
      .mockResolvedValueOnce([
        bankItem({ id: 'bank-1', knowledgeUnitId: 'ku-1' }),
        bankItem({ id: 'bank-2', knowledgeUnitId: 'ku-2' }),
      ])
      .mockResolvedValueOnce([
        bankItem({ id: 'retry-1', knowledgeUnitId: 'ku-1' }),
        bankItem({ id: 'retry-2', knowledgeUnitId: 'ku-2' }),
      ]);
    mocks.questionBankItemUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      repository.reserveCourseQuickQuestions({
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        knowledgeUnits: [
          { id: 'ku-1', documentId: 'document-1' },
          { id: 'ku-2', documentId: 'document-1' },
        ],
        questionCount: 2,
        maxAttempts: 2,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'retry-1', knowledgeUnitId: 'ku-1' }),
      expect.objectContaining({ id: 'retry-2', knowledgeUnitId: 'ku-2' }),
    ]);

    expect(mocks.questionBankItemFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.questionBankItemUpdateMany).toHaveBeenCalledTimes(4);
  });
});

function createHarness() {
  const mocks = {
    questionBankItemCount: jest.fn(),
    questionBankItemGroupBy: jest.fn(),
    questionBankItemFindUnique: jest.fn(),
    questionBankItemCreate: jest.fn<
      Promise<QuestionBankItemIdOnly>,
      [unknown]
    >(),
    questionBankItemFindMany: jest.fn(),
    questionBankItemUpdateMany: jest.fn(),
    questionBankItemSourceCreateMany: jest.fn(),
    questionBankItemVisualCreateMany: jest.fn(),
  };
  const transaction = jest.fn(
    async <T>(callback: (tx: QuestionBankTransaction) => Promise<T>) =>
      callback(createTransaction(mocks)),
  );
  const prisma = {
    questionBankItem: {
      count: mocks.questionBankItemCount,
      groupBy: mocks.questionBankItemGroupBy,
      findUnique: mocks.questionBankItemFindUnique,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  return {
    mocks,
    repository: new PrismaQuestionBankRepository(prisma),
  };
}

function createTransaction(
  mocks: ReturnType<typeof createHarness>['mocks'],
): QuestionBankTransaction {
  return {
    questionBankItem: {
      create: mocks.questionBankItemCreate,
      findMany: mocks.questionBankItemFindMany,
      updateMany: mocks.questionBankItemUpdateMany,
    },
    questionBankItemSource: {
      createMany: mocks.questionBankItemSourceCreateMany,
    },
    questionBankItemVisual: {
      createMany: mocks.questionBankItemVisualCreateMany,
    },
  };
}

function generatedQuestion(prompt: string) {
  return {
    prompt,
    difficulty: 'MEDIUM' as const,
    selectionMode: 'single' as const,
    choices: [
      { id: 'a', label: 'Réponse A' },
      { id: 'b', label: 'Réponse B' },
    ],
    correctChoiceId: 'a',
    explanation: 'Explication.',
    sourceChunkIds: ['chunk-1'],
    visuals: [],
  };
}

function bankItem(overrides: Partial<QuestionBankItemRow> = {}) {
  const id = overrides.id ?? 'bank-1';

  return {
    id,
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: 'course-1',
    documentId: 'document-1',
    knowledgeUnitId: 'ku-1',
    prompt: `Question ${id}`,
    difficulty: KnowledgeUnitDifficulty.MEDIUM,
    choices: [
      { id: 'a', label: 'Réponse A' },
      { id: 'b', label: 'Réponse B' },
    ],
    selectionMode: QuestionSelectionMode.SINGLE,
    minSelections: null,
    maxSelections: null,
    correctChoiceId: 'a',
    correctChoiceIds: null,
    explanation: 'Explication.',
    fingerprint: `fingerprint-${id}`,
    status: QuestionBankItemStatus.ACTIVE,
    askedCount: 0,
    lastAskedAt: null,
    flaggedAt: null,
    flagReason: null,
    archivedAt: null,
    createdAt: new Date('2026-06-20T09:00:00Z'),
    updatedAt: new Date('2026-06-20T09:00:00Z'),
    sources: [
      {
        id: `source-${id}`,
        questionBankItemId: id,
        subjectId: 'subject-1',
        chunkId: 'chunk-1',
      },
    ],
    visuals: [],
    ...overrides,
  };
}

interface QuestionBankTransaction {
  questionBankItem: {
    create: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  questionBankItemSource: {
    createMany: jest.Mock;
  };
  questionBankItemVisual: {
    createMany: jest.Mock;
  };
}

interface QuestionBankItemIdOnly {
  id: string;
}

interface QuestionBankItemRow {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string;
  documentId: string;
  knowledgeUnitId: string;
  prompt: string;
  difficulty: KnowledgeUnitDifficulty;
  choices: unknown;
  selectionMode: QuestionSelectionMode;
  minSelections: number | null;
  maxSelections: number | null;
  correctChoiceId: string | null;
  correctChoiceIds: unknown;
  explanation: string;
  fingerprint: string;
  status: QuestionBankItemStatus;
  askedCount: number;
  lastAskedAt: Date | null;
  flaggedAt: Date | null;
  flagReason: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sources: Array<{
    id: string;
    questionBankItemId: string;
    subjectId: string;
    chunkId: string;
  }>;
  visuals: Array<{
    id: string;
    questionBankItemId: string;
    type: QuestionVisualType;
    displayOrder: number;
    payload: unknown;
    createdAt: Date;
  }>;
}
