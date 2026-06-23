import {
  ListCourseRevisionSessionHistoryUseCase,
  ListRevisionSessionHistoryUseCase,
} from './list-revision-session-history.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';

describe('ListCourseRevisionSessionHistoryUseCase', () => {
  it('loads completed course sessions for the current student', async () => {
    const repository = createRepository();
    const history = revisionSessionHistory();
    repository.findCompletedCourseSessionsForStudent.mockResolvedValue(history);

    await expect(
      new ListCourseRevisionSessionHistoryUseCase(repository).execute({
        studentId: ' student-1 ',
        courseId: ' course-1 ',
        limit: 5,
      }),
    ).resolves.toBe(history);

    expect(
      repository.findCompletedCourseSessionsForStudent.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      courseId: 'course-1',
      limit: 5,
    });
  });

  it('rejects invalid course history input before repository access', async () => {
    const repository = createRepository();
    const useCase = new ListCourseRevisionSessionHistoryUseCase(repository);

    await expect(
      useCase.execute({ studentId: ' ', courseId: 'course-1' }),
    ).rejects.toThrow('Student id is required');
    await expect(
      useCase.execute({ studentId: 'student-1', courseId: ' ' }),
    ).rejects.toThrow('Course id is required');
    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        limit: 0,
      }),
    ).rejects.toThrow('History limit invalid');
    expect(
      repository.findCompletedCourseSessionsForStudent.mock.calls,
    ).toHaveLength(0);
  });
});

describe('ListRevisionSessionHistoryUseCase', () => {
  it('loads global completed session history with a safe default limit', async () => {
    const repository = createRepository();
    const history = revisionSessionHistory();
    repository.findCompletedSessionsForStudent.mockResolvedValue(history);

    await expect(
      new ListRevisionSessionHistoryUseCase(repository).execute({
        studentId: ' student-1 ',
      }),
    ).resolves.toBe(history);

    expect(
      repository.findCompletedSessionsForStudent.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      limit: 10,
    });
  });

  it('rejects invalid global history input before repository access', async () => {
    const repository = createRepository();
    const useCase = new ListRevisionSessionHistoryUseCase(repository);

    await expect(useCase.execute({ studentId: ' ' })).rejects.toThrow(
      'Student id is required',
    );
    await expect(
      useCase.execute({ studentId: 'student-1', limit: 51 }),
    ).rejects.toThrow('History limit invalid');
    expect(repository.findCompletedSessionsForStudent.mock.calls).toHaveLength(
      0,
    );
  });
});

function createRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest.fn(),
    createWithInitialAction: jest.fn(),
    findByIdForStudent: jest.fn(),
    findResumableCourseSessionForStudent: jest.fn(),
    findCompletedCourseSessionsForStudent: jest.fn(),
    findCompletedSessionsForStudent: jest.fn(),
    saveDraftAnswer: jest.fn(),
    deleteDraftAnswer: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn(),
    appendAction: jest.fn(),
    completeQuickSession: jest.fn(),
    findResultByIdForStudent: jest.fn(),
  };
}

function revisionSessionHistory() {
  return {
    items: [
      {
        session: {
          id: 'revision-session-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          mode: 'QUICK' as const,
          status: 'COMPLETED' as const,
          createdAt: new Date('2026-06-15T12:00:00.000Z'),
          completedAt: new Date('2026-06-15T12:05:00.000Z'),
        },
        summary: {
          correctAnswers: 4,
          totalQuestions: 6,
          score: 4 / 6,
          durationSeconds: 300,
        },
        course: {
          id: 'course-1',
          title: 'Droit constitutionnel',
        },
      },
    ],
  };
}
