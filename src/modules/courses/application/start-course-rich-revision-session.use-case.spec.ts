import { richClosedExerciseFixture } from '../../activities/application/rich-closed-questions/rich-closed-question.fixtures';
import { toRichClosedPublicExerciseEnvelope } from '../../activities/application/rich-closed-questions/rich-closed-question-public.mapper';
import type { StartRichClosedExerciseUseCase } from '../../activities/application/rich-closed-questions/start-rich-closed-exercise.use-case';
import {
  CourseRichRevisionQuestionCountInvalidError,
  CourseRichRevisionScopeNotReadyError,
  StartCourseRichRevisionSessionUseCase,
} from './start-course-rich-revision-session.use-case';
import type {
  CourseDetailDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('StartCourseRichRevisionSessionUseCase', () => {
  it('starts a QCM complet exercise through the existing rich closed engine', async () => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({
        id: 'ku-1',
        documentId: 'document-1',
        title: 'Responsabilité politique',
      }),
    ]);
    startRichClosedExercise.execute.mockResolvedValue(
      richClosedPublicExercise(),
    );

    const response = await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      scopeKind: 'knowledge_unit',
      scopeId: 'ku-1',
      questionCount: 10,
      complexityProfile: 'advanced',
    });

    expect(startRichClosedExercise.execute).toHaveBeenCalledTimes(1);
    expect(startRichClosedExercise.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 10,
      complexityProfile: 'advanced',
    });
    expect(response.sessionId).toBe('rich-session-1');
    expect(JSON.stringify(response)).not.toMatch(/correct|correction|answer/i);
  });

  it.each([6, 10, 13])('accepts the %s-question preset', async (count) => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit(),
    ]);
    startRichClosedExercise.execute.mockResolvedValue(
      richClosedPublicExercise(),
    );

    await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      scopeKind: 'knowledge_unit',
      scopeId: 'ku-1',
      questionCount: count,
      complexityProfile: 'standard',
    });

    expect(startRichClosedExercise.execute).toHaveBeenCalledWith(
      expect.objectContaining({ questionCount: count }),
    );
  });

  it('refuses unsupported scope kinds before calling the rich closed engine', async () => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'course' as never,
        scopeId: 'course-1',
        questionCount: 6,
        complexityProfile: 'standard',
      }),
    ).rejects.toThrow(CourseRichRevisionScopeNotReadyError);
    expect(startRichClosedExercise.execute).not.toHaveBeenCalled();
  });

  it('refuses knowledge units outside the ready course scope', async () => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
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
        questionCount: 6,
        complexityProfile: 'standard',
      }),
    ).rejects.toThrow(CourseRichRevisionScopeNotReadyError);
    expect(startRichClosedExercise.execute).not.toHaveBeenCalled();
  });

  it('refuses unsupported question counts including 14', async () => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
        questionCount: 14,
        complexityProfile: 'standard',
      }),
    ).rejects.toThrow(CourseRichRevisionQuestionCountInvalidError);
    expect(startRichClosedExercise.execute).not.toHaveBeenCalled();
  });

  it('refuses the exam profile for QCM complet', async () => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
        questionCount: 6,
        complexityProfile: 'exam' as never,
      }),
    ).rejects.toThrow(CourseRichRevisionScopeNotReadyError);
    expect(startRichClosedExercise.execute).not.toHaveBeenCalled();
  });

  it('refuses courses outside the current student ownership scope', async () => {
    const { repository, startRichClosedExercise, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(null);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'missing-course',
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
        questionCount: 6,
        complexityProfile: 'standard',
      }),
    ).rejects.toThrow('Course not found');
    expect(startRichClosedExercise.execute).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const repository = {
    findDetailByIdForStudent: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
  };
  const startRichClosedExercise = {
    execute: jest.fn(),
  };

  return {
    repository,
    startRichClosedExercise,
    useCase: new StartCourseRichRevisionSessionUseCase(
      repository as unknown as CoursesRepository,
      startRichClosedExercise as unknown as StartRichClosedExerciseUseCase,
    ),
  };
}

function courseDetail(): CourseDetailDto {
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
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      updatedAt: new Date('2026-06-20T10:00:00.000Z'),
      sourceCount: 1,
      readySourceCount: 1,
      processingSourceCount: 0,
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
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
        updatedAt: new Date('2026-06-20T10:00:00.000Z'),
      },
    ],
  };
}

function knowledgeUnit(
  overrides: Partial<CourseQuickRevisionKnowledgeUnitDto> = {},
): CourseQuickRevisionKnowledgeUnitDto {
  return {
    id: 'ku-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    title: 'Responsabilité politique',
    ...overrides,
  };
}

function richClosedPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
  });
}
