import type { RevisionRepository } from '../../../revision/application/revision.repository';
import { KnowledgeUnit } from '../../../revision/domain/knowledge-unit.entity';
import type { ActivitiesRepository } from '../activities.repository';
import {
  RICH_CLOSED_SOURCE_CONTEXT_EMPTY,
  RICH_CLOSED_START_INVALID_INPUT,
} from './rich-closed-question-errors';
import { richClosedExerciseFixture } from './rich-closed-question.fixtures';
import type { RichClosedQuestionGenerator } from './rich-closed-question-generator';
import { StartRichClosedExerciseUseCase } from './start-rich-closed-exercise.use-case';

describe('StartRichClosedExerciseUseCase', () => {
  it('starts a rich closed exercise with the default V1-A mix', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();

    const result = await new StartRichClosedExerciseUseCase(
      activitiesRepository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    const [generationInput] = generator.generate.mock.calls[0] ?? [];
    expect(generationInput).toMatchObject({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnit: {
        id: 'unit-1',
        sourceChunkIds: ['chunk-1'],
      },
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'La séparation des pouvoirs structure les régimes.',
          pageNumber: 1,
        },
      ],
      questionCount: 6,
      complexityProfile: 'exam',
      questionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
    });
    expect(
      activitiesRepository.createRichClosedExerciseSession.mock.calls[0]?.[0],
    ).toMatchObject({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: 'document-1',
      exercise: richClosedExerciseFixture(),
    });
    expect(result.type).toBe('rich_closed_exercise');
  });

  it('accepts an explicit question type mix', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();

    await new StartRichClosedExerciseUseCase(
      activitiesRepository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      questionCount: 6,
      complexityProfile: 'advanced',
      questionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
    });

    expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
      questionCount: 6,
      complexityProfile: 'advanced',
      questionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
    });
  });

  it('treats a null document id as absent and uses the source context document', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();

    await new StartRichClosedExerciseUseCase(
      activitiesRepository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: null,
    });

    expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
      documentId: 'document-1',
    });
    expect(
      activitiesRepository.createRichClosedExerciseSession.mock.calls[0]?.[0],
    ).toMatchObject({
      documentId: 'document-1',
    });
  });

  it('accepts an explicit document id matching the source context', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();

    await new StartRichClosedExerciseUseCase(
      activitiesRepository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: 'document-1',
    });

    expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
      documentId: 'document-1',
    });
  });

  it('rejects an incoherent explicit question type mix before calling the generator', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();

    await expect(
      new StartRichClosedExerciseUseCase(
        activitiesRepository,
        revisionRepository,
        generator,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: 6,
        questionTypeMix: {
          single_choice: 6,
          multiple_choice: 1,
        },
      }),
    ).rejects.toThrow(RICH_CLOSED_START_INVALID_INPUT);
    expect(generator.generate.mock.calls).toHaveLength(0);
  });

  it('rejects unavailable knowledge units', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([]);

    await expect(
      new StartRichClosedExerciseUseCase(
        activitiesRepository,
        revisionRepository,
        generator,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).rejects.toThrow(RICH_CLOSED_START_INVALID_INPUT);
    expect(generator.generate.mock.calls).toHaveLength(0);
  });

  it('rejects source-empty contexts before calling the generator', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();
    activitiesRepository.findRichClosedGenerationContext.mockResolvedValue({
      documentId: 'document-1',
      knowledgeUnit: Object.assign(knowledgeUnit(), {
        difficulty: 'MEDIUM' as const,
        sourceChunkIds: [],
      }),
      chunks: [],
    });

    await expect(
      new StartRichClosedExerciseUseCase(
        activitiesRepository,
        revisionRepository,
        generator,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).rejects.toThrow(RICH_CLOSED_SOURCE_CONTEXT_EMPTY);
    expect(generator.generate.mock.calls).toHaveLength(0);
  });

  it('rejects an explicit document outside the source context', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const generator = createGenerator();

    await expect(
      new StartRichClosedExerciseUseCase(
        activitiesRepository,
        revisionRepository,
        generator,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        documentId: 'other-document',
      }),
    ).rejects.toThrow(RICH_CLOSED_START_INVALID_INPUT);
    expect(generator.generate.mock.calls).toHaveLength(0);
  });
});

function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
  return {
    findDiagnosticQuizGenerationContext: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    submitResult: jest.fn(),
    findOpenAnswerEvaluationContext: jest.fn(),
    saveOpenAnswerEvaluation: jest.fn(),
    findRichClosedGenerationContext: jest.fn().mockResolvedValue({
      documentId: 'document-1',
      knowledgeUnit: Object.assign(knowledgeUnit(), {
        difficulty: 'MEDIUM' as const,
        sourceChunkIds: ['chunk-1'],
      }),
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'La séparation des pouvoirs structure les régimes.',
          pageNumber: 1,
        },
      ],
    }),
    createRichClosedExerciseSession: jest.fn().mockResolvedValue({
      sessionId: 'rich-session-1',
      type: 'rich_closed_exercise',
      ...richClosedExerciseFixture(),
    }),
    getRichClosedExerciseForStudent: jest.fn(),
    getInternalRichClosedExerciseForStudent: jest.fn(),
    saveRichClosedExerciseResult: jest.fn(),
    getRichClosedExerciseResultForStudent: jest.fn(),
    listCourseRichClosedExerciseHistoryForStudent: jest.fn(),
  };
}

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn().mockResolvedValue([knowledgeUnit()]),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}

function createGenerator(): jest.Mocked<RichClosedQuestionGenerator> {
  return {
    generate: jest.fn().mockResolvedValue(richClosedExerciseFixture()),
  };
}

function knowledgeUnit() {
  return new KnowledgeUnit({
    id: 'unit-1',
    subjectId: 'subject-1',
    title: 'Séparation des pouvoirs',
    summary: 'La séparation des pouvoirs structure les régimes politiques.',
  });
}
