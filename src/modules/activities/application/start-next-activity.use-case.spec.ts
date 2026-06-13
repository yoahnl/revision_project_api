import type { RevisionRepository } from '../../revision/application/revision.repository';
import { AdaptivePlanService } from '../../revision/domain/adaptive-plan.service';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { MasteryState } from '../../revision/domain/mastery-state.entity';
import { StartNextActivityUseCase } from './start-next-activity.use-case';

describe('StartNextActivityUseCase', () => {
  it('returns a diagnostic quiz activity contract for an explicit knowledge unit', async () => {
    const repository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();

    const activity = await new StartNextActivityUseCase(
      new AdaptivePlanService(),
      repository,
      revisionRepository,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    expect(activity.sessionId).toBe('session-1');
    expect(activity.questions).toHaveLength(1);
    expect(repository.createDiagnosticQuiz).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });
    expect(revisionRepository.findKnowledgeUnits.mock.calls).toHaveLength(0);
  });

  it('chooses the lowest mastery knowledge unit when none is provided', async () => {
    const repository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Cellules',
        summary: 'Bases',
      }),
      new KnowledgeUnit({
        id: 'unit-2',
        subjectId: 'subject-1',
        title: 'Tissus',
        summary: 'Bases',
      }),
    ]);
    revisionRepository.findMasteryStates.mockResolvedValue([
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.8,
        lastPracticedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-2',
        score: 0.2,
        lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
      }),
    ]);

    await new StartNextActivityUseCase(
      new AdaptivePlanService(),
      repository,
      revisionRepository,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.createDiagnosticQuiz).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-2',
    });
  });

  it('rejects subjects without available knowledge units', async () => {
    const repository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([]);

    await expect(
      new StartNextActivityUseCase(
        new AdaptivePlanService(),
        repository,
        revisionRepository,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('No knowledge unit available for subject');

    expect(repository.createDiagnosticQuiz).not.toHaveBeenCalled();
  });
});

function createActivitiesRepository() {
  return {
    createDiagnosticQuiz: jest.fn().mockResolvedValue({
      sessionId: 'session-1',
      type: 'diagnostic_quiz',
      title: 'Diagnostic rapide',
      questions: [
        {
          id: 'question-1',
          prompt:
            'Quelle structure est principalement responsable de la contraction cardiaque ?',
          choices: [
            { id: 'a', label: 'Myocarde' },
            { id: 'b', label: 'Pericarde' },
          ],
        },
      ],
    }),
    submitResult: jest.fn(),
  };
}

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn().mockResolvedValue([]),
    findMasteryStates: jest.fn().mockResolvedValue([]),
    upsertMastery: jest.fn(),
  };
}
