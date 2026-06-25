import type {
  ActivitiesRepository,
  OpenAnswerSubmissionResult,
} from '../../activities/application/activities.repository';
import { SubmitOpenAnswerUseCase } from '../../activities/application/submit-open-answer.use-case';
import type { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import type { RevisionSessionsRepository } from '../../revision-sessions/application/revision-sessions.repository';
import type { RevisionSessionResponseDto } from '../../revision-sessions/domain/revision-session.entity';
import {
  CourseDeepRevisionAnswerInvalidError,
  CourseDeepRevisionScopeNotReadyError,
  CourseDeepRevisionSessionNotReadyError,
  StartCourseDeepRevisionSessionUseCase,
  SubmitCourseDeepRevisionAnswerUseCase,
} from './course-deep-revision-session.use-case';
import type {
  CourseDetailDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('StartCourseDeepRevisionSessionUseCase', () => {
  it('starts a DEEP revision session through the existing open question engine', async () => {
    const { repository, startRevisionSession, useCase } = createStartHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'ku-1', documentId: 'document-1' }),
    ]);
    startRevisionSession.execute.mockResolvedValue(deepSessionResponse());

    const response = await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      scopeKind: 'knowledge_unit',
      scopeId: 'ku-1',
    });

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      preferredAction: 'open_question',
      mode: 'DEEP',
    });
    expect(response).toMatchObject({
      session: {
        id: 'deep-session-1',
        mode: 'DEEP',
        status: 'STARTED',
        courseId: 'course-1',
      },
      question: {
        id: 'open-question-1',
        prompt: 'Explique la souveraineté nationale.',
        maxAnswerLength: 4000,
      },
      scope: {
        kind: 'knowledge_unit',
        id: 'ku-1',
        label: 'La souveraineté',
        sourceLabel: 'CM.pdf',
      },
      answerGuidelines: {
        minLength: 12,
        maxLength: 4000,
      },
    });
    expect(JSON.stringify(response)).not.toMatch(/modelAnswer|evaluation/i);
  });

  it('refuses unsupported scope kinds before calling the open question engine', async () => {
    const { startRevisionSession, useCase } = createStartHarness();

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'course' as never,
        scopeId: 'course-1',
      }),
    ).rejects.toThrow(CourseDeepRevisionScopeNotReadyError);
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('refuses knowledge units outside the ready course scope', async () => {
    const { repository, startRevisionSession, useCase } = createStartHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'ku-1' }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'knowledge_unit',
        scopeId: 'other-ku',
      }),
    ).rejects.toThrow(CourseDeepRevisionScopeNotReadyError);
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('refuses knowledge units attached to a non-ready source', async () => {
    const { repository, startRevisionSession, useCase } = createStartHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'ku-processing', documentId: 'document-processing' }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-processing',
      }),
    ).rejects.toThrow(CourseDeepRevisionScopeNotReadyError);
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('refuses courses outside the current student ownership scope', async () => {
    const { repository, startRevisionSession, useCase } = createStartHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(null);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'missing-course',
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
      }),
    ).rejects.toThrow('Course not found');
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('refuses an ungrounded open question response from the existing engine', async () => {
    const { repository, startRevisionSession, useCase } = createStartHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'ku-1' }),
    ]);
    startRevisionSession.execute.mockResolvedValue(
      deepSessionResponse({
        currentAction: {
          ...deepSessionResponse().currentAction!,
          payload: {
            ...openQuestionPayload(),
            documentId: null,
            question: {
              ...openQuestionPayload().question,
              sources: [],
            },
          },
        },
      }),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
      }),
    ).rejects.toThrow(CourseDeepRevisionScopeNotReadyError);
  });
});

describe('SubmitCourseDeepRevisionAnswerUseCase', () => {
  it('submits a DEEP open answer through the existing evaluator after course ownership validation', async () => {
    const {
      repository,
      revisionSessionsRepository,
      activitiesRepository,
      submitOpenAnswer,
      useCase,
    } = createSubmitHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'ku-1' }),
    ]);
    revisionSessionsRepository.findByIdForStudent.mockResolvedValue(
      deepSessionResponse(),
    );
    activitiesRepository.findOpenAnswerEvaluationContext.mockResolvedValue({
      sessionId: 'open-session-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnit: {
        id: 'ku-1',
        subjectId: 'subject-1',
        title: 'La souveraineté',
        summary: 'Résumé',
        difficulty: 'MEDIUM',
        sourceChunkIds: ['chunk-1'],
      },
      question: {
        id: 'open-question-1',
        prompt: 'Explique la souveraineté nationale.',
        instructions: null,
        sourceChunkIds: ['chunk-1'],
      },
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'La souveraineté appartient à la nation.',
          pageNumber: 4,
        },
      ],
    });
    submitOpenAnswer.execute.mockResolvedValue(openAnswerResult());

    const response = await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      sessionId: 'deep-session-1',
      answer:
        'La souveraineté nationale signifie que le pouvoir vient de la nation.',
    });

    expect(revisionSessionsRepository.findByIdForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'deep-session-1',
    });
    expect(
      activitiesRepository.findOpenAnswerEvaluationContext,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'open-session-1',
    });
    expect(submitOpenAnswer.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'open-session-1',
      answerText:
        'La souveraineté nationale signifie que le pouvoir vient de la nation.',
    });
    expect(response).toEqual({
      session: {
        id: 'deep-session-1',
        mode: 'DEEP',
        status: 'SUBMITTED',
        courseId: 'course-1',
      },
      evaluation: openAnswerResult().evaluation,
    });
  });

  it('rejects too short answers before calling the evaluator', async () => {
    const { submitOpenAnswer, useCase } = createSubmitHarness();

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        sessionId: 'deep-session-1',
        answer: 'trop court',
      }),
    ).rejects.toThrow(CourseDeepRevisionAnswerInvalidError);
    expect(submitOpenAnswer.execute).not.toHaveBeenCalled();
  });

  it('rejects sessions outside the requested course', async () => {
    const {
      repository,
      revisionSessionsRepository,
      submitOpenAnswer,
      useCase,
    } = createSubmitHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    revisionSessionsRepository.findByIdForStudent.mockResolvedValue(
      deepSessionResponse({
        session: {
          ...deepSessionResponse().session,
          courseId: 'other-course',
        },
      }),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        sessionId: 'deep-session-1',
        answer: 'Une réponse suffisamment longue.',
      }),
    ).rejects.toThrow(CourseDeepRevisionSessionNotReadyError);
    expect(submitOpenAnswer.execute).not.toHaveBeenCalled();
  });
});

function createStartHarness() {
  const repository = createCoursesRepositoryMock();
  const startRevisionSession = {
    execute: jest.fn(),
  };

  return {
    repository,
    startRevisionSession,
    useCase: new StartCourseDeepRevisionSessionUseCase(
      repository as unknown as CoursesRepository,
      startRevisionSession as unknown as StartRevisionSessionUseCase,
    ),
  };
}

function createSubmitHarness() {
  const repository = createCoursesRepositoryMock();
  const revisionSessionsRepository = {
    findByIdForStudent: jest.fn(),
  };
  const activitiesRepository = {
    findOpenAnswerEvaluationContext: jest.fn(),
  };
  const submitOpenAnswer = {
    execute: jest.fn(),
  };

  return {
    repository,
    revisionSessionsRepository,
    activitiesRepository,
    submitOpenAnswer,
    useCase: new SubmitCourseDeepRevisionAnswerUseCase(
      repository as unknown as CoursesRepository,
      revisionSessionsRepository as unknown as RevisionSessionsRepository,
      activitiesRepository as unknown as ActivitiesRepository,
      submitOpenAnswer as unknown as SubmitOpenAnswerUseCase,
    ),
  };
}

function createCoursesRepositoryMock() {
  return {
    findDetailByIdForStudent: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
  };
}

function courseDetail(
  overrides: Partial<CourseDetailDto> = {},
): CourseDetailDto {
  return {
    course: {
      id: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Droit constitutionnel',
      description: null,
      chapterLabel: null,
      estimatedMinutes: 90,
      displayOrder: 0,
      createdAt: new Date('2026-06-25T10:00:00.000Z'),
      updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      sourceCount: 2,
      readySourceCount: 1,
      processingSourceCount: 1,
      failedSourceCount: 0,
    },
    subject: {
      id: 'subject-1',
      name: 'Droit',
    },
    sources: [
      {
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        fileName: 'CM.pdf',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-25T10:00:00.000Z'),
        updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      },
      {
        id: 'document-processing',
        courseId: 'course-1',
        documentId: 'document-processing',
        fileName: 'TD.pdf',
        kind: 'COURSE_PDF',
        status: 'PROCESSING',
        errorCode: null,
        createdAt: new Date('2026-06-25T10:00:00.000Z'),
        updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

function knowledgeUnit(
  overrides: Partial<CourseQuickRevisionKnowledgeUnitDto> = {},
): CourseQuickRevisionKnowledgeUnitDto {
  return {
    id: 'ku-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    title: 'La souveraineté',
    ...overrides,
  };
}

function deepSessionResponse(
  overrides: Partial<RevisionSessionResponseDto> = {},
): RevisionSessionResponseDto {
  return {
    session: {
      id: 'deep-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      mode: 'DEEP',
      createdAt: new Date('2026-06-25T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'OPEN_QUESTION',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'open-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      payload: openQuestionPayload(),
    },
    history: [],
    draftAnswers: [],
    ...overrides,
  };
}

function openQuestionPayload() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question' as const,
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'ku-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la souveraineté nationale.',
      instructions: 'Rédige une réponse structurée.',
      maxAnswerLength: 4000,
      sources: [
        {
          chunkId: 'chunk-1',
          pageNumber: 4,
          index: 0,
        },
      ],
    },
  };
}

function openAnswerResult(): OpenAnswerSubmissionResult {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'READY',
      score: 0.75,
      maxScore: 1,
      feedback: 'Réponse structurée.',
      presentPoints: ['La nation est identifiée.'],
      missingPoints: [
        'Il manque la distinction avec la souveraineté populaire.',
      ],
      errors: [],
      modelAnswer: 'La souveraineté nationale appartient à la nation.',
      advice: 'Ajoute une phrase de définition avant les exemples.',
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'La souveraineté appartient à la nation.',
          pageNumber: 4,
          index: 0,
        },
      ],
    },
  };
}
