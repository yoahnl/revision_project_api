import type { SubjectsRepository } from '../../subjects/application/subjects.repository';
import { Subject } from '../../subjects/domain/subject.entity';
import { AdaptivePlanService } from '../domain/adaptive-plan.service';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';
import type { RevisionRepository } from './revision.repository';
import { GetTodayPlanUseCase } from './get-today-plan.use-case';

describe('GetTodayPlanUseCase', () => {
  const now = new Date('2026-06-13T10:00:00.000Z');

  it('returns an empty plan when no active goal exists', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(null);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan).toEqual({ generatedAt: now, items: [] });
    expect(subjectsRepository.findByStudent.mock.calls).toHaveLength(0);
  });

  it('returns an adaptive today item with subject and mastery context', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(
      new RevisionGoal({
        id: 'goal-1',
        studentId: 'student-1',
        targetDate: new Date('2026-07-01T00:00:00.000Z'),
        weeklyMinutes: 180,
        createdAt: now,
      }),
    );
    subjectsRepository.findByStudent.mockResolvedValue([
      new Subject({
        id: 'subject-1',
        studentId: 'student-1',
        name: 'Anatomie',
        priority: 5,
        createdAt: now,
      }),
    ]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Cycle cardiaque',
        summary: 'Bases',
      }),
    ]);
    revisionRepository.findMasteryStates.mockResolvedValue([
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.2,
        lastPracticedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
    ]);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan.items).toEqual([
      expect.objectContaining({
        subjectId: 'subject-1',
        subjectName: 'Anatomie',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Cycle cardiaque',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
      }),
    ]);
  });
});

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}

function createSubjectsRepository(): jest.Mocked<SubjectsRepository> {
  return {
    create: jest.fn(),
    findByStudent: jest.fn(),
    findByIdForStudent: jest.fn(),
  };
}
