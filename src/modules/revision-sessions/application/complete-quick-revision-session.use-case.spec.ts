import { CompleteQuickRevisionSessionUseCase } from './complete-quick-revision-session.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';

describe('CompleteQuickRevisionSessionUseCase', () => {
  it('delegates completion with a server-side completedAt date', async () => {
    const repository = createRepository();
    const result = revisionSessionResult();
    repository.completeQuickSession.mockResolvedValue(result);

    await expect(
      new CompleteQuickRevisionSessionUseCase(repository).execute({
        studentId: ' student-1 ',
        sessionId: ' revision-session-1 ',
      }),
    ).resolves.toBe(result);

    expect(repository.completeQuickSession.mock.calls).toHaveLength(1);
    expect(repository.completeQuickSession.mock.calls[0]?.[0]).toMatchObject({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(
      repository.completeQuickSession.mock.calls[0]?.[0].completedAt,
    ).toBeInstanceOf(Date);
  });

  it('rejects empty identifiers before repository access', async () => {
    const repository = createRepository();
    const useCase = new CompleteQuickRevisionSessionUseCase(repository);

    await expect(
      useCase.execute({ studentId: ' ', sessionId: 'revision-session-1' }),
    ).rejects.toThrow('Student id is required');
    await expect(
      useCase.execute({ studentId: 'student-1', sessionId: ' ' }),
    ).rejects.toThrow('Revision session id is required');
    expect(repository.completeQuickSession.mock.calls).toHaveLength(0);
  });
});

function createRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest.fn(),
    createWithInitialAction: jest.fn(),
    findByIdForStudent: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn(),
    appendAction: jest.fn(),
    completeQuickSession: jest.fn(),
    findResultByIdForStudent: jest.fn(),
  };
}

function revisionSessionResult() {
  return {
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
    knowledgeUnits: [],
  };
}
