import type { SubmitActivityResultUseCase } from '../../activities/application/submit-activity-result.use-case';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';
import type { RevisionSessionResultDto } from '../domain/revision-session-result.entity';
import type { RevisionSessionsRepository } from './revision-sessions.repository';
import {
  GetExamPreparationSessionUseCase,
  SubmitExamPreparationSessionUseCase,
} from './exam-preparation-sessions.use-cases';

describe('Exam preparation session use cases', () => {
  it('loads only EXAM sessions', async () => {
    const repository = createRepository();
    repository.findByIdForStudent.mockResolvedValue(examSessionResponse());

    const useCase = new GetExamPreparationSessionUseCase(repository);

    await expect(
      useCase.execute({ studentId: 'student-1', sessionId: 'exam-session-1' }),
    ).resolves.toMatchObject({
      session: {
        id: 'exam-session-1',
        mode: 'EXAM',
      },
    });
  });

  it('submits answers through the activity scorer and completes the EXAM revision session', async () => {
    const repository = createRepository();
    const submitActivityResult = createSubmitActivityResult();
    repository.findByIdForStudent.mockResolvedValue(examSessionResponse());
    repository.completeExamSession.mockResolvedValue(examResult());

    const useCase = new SubmitExamPreparationSessionUseCase(
      repository,
      submitActivityResult,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      sessionId: 'exam-session-1',
      answers: [{ questionId: 'question-1', choiceId: 'choice-a' }],
    });

    expect(submitActivityResult.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'activity-exam-1',
          answers: [{ questionId: 'question-1', choiceId: 'choice-a' }],
        },
      ],
    ]);
    const completeInput = repository.completeExamSession.mock.calls[0]?.[0];
    expect(completeInput).toMatchObject({
      studentId: 'student-1',
      sessionId: 'exam-session-1',
    });
    expect(completeInput?.completedAt).toBeInstanceOf(Date);
    expect(result.session.mode).toBe('EXAM');
  });

  it('refuses to submit a quick revision session through the exam endpoint', async () => {
    const repository = createRepository();
    const submitActivityResult = createSubmitActivityResult();
    repository.findByIdForStudent.mockResolvedValue(
      examSessionResponse({ mode: 'QUICK' }),
    );

    const useCase = new SubmitExamPreparationSessionUseCase(
      repository,
      submitActivityResult,
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        sessionId: 'quick-session-1',
        answers: [{ questionId: 'question-1', choiceId: 'choice-a' }],
      }),
    ).rejects.toThrow('Exam preparation session not found');

    expect(submitActivityResult.execute.mock.calls).toHaveLength(0);
    expect(repository.completeExamSession.mock.calls).toHaveLength(0);
  });
});

function createRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest.fn(),
    createWithInitialAction: jest.fn(),
    findByIdForStudent: jest.fn(),
    findResumableCourseSessionForStudent: jest.fn(),
    findCompletedCourseSessionsForStudent: jest.fn(),
    findCompletedCourseExamSessionsForStudent: jest.fn(),
    findCompletedSessionsForStudent: jest.fn(),
    saveDraftAnswer: jest.fn(),
    deleteDraftAnswer: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn(),
    appendAction: jest.fn(),
    completeQuickSession: jest.fn(),
    completeExamSession: jest.fn(),
    findResultByIdForStudent: jest.fn(),
  };
}

function createSubmitActivityResult(): jest.Mocked<SubmitActivityResultUseCase> {
  return {
    execute: jest.fn().mockResolvedValue({
      correctAnswers: 1,
      totalQuestions: 1,
      score: 1,
      items: [],
    }),
  } as unknown as jest.Mocked<SubmitActivityResultUseCase>;
}

function examSessionResponse(
  overrides: { mode?: 'QUICK' | 'EXAM' } = {},
): RevisionSessionResponseDto {
  return {
    session: {
      id: 'exam-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: overrides.mode ?? 'EXAM',
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'activity-exam-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'diagnostic_quiz',
        sessionId: 'activity-exam-1',
      },
    },
    history: [],
    draftAnswers: [],
  };
}

function examResult(): RevisionSessionResultDto {
  return {
    session: {
      id: 'exam-session-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      mode: 'EXAM',
      status: 'COMPLETED',
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      completedAt: new Date('2026-06-20T10:05:00.000Z'),
    },
    summary: {
      correctAnswers: 1,
      totalQuestions: 1,
      score: 1,
      durationSeconds: 300,
    },
    knowledgeUnits: [],
    corrections: [],
  };
}
