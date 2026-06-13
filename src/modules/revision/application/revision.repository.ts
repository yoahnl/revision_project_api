import { StudentId } from '../../../shared/domain/student-id';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';

export const REVISION_REPOSITORY = Symbol('REVISION_REPOSITORY');

export interface RevisionRepository {
  getActiveGoal(studentId: StudentId): Promise<RevisionGoal | null>;
  saveGoal(input: {
    studentId: StudentId;
    targetDate: Date;
    weeklyMinutes: number;
  }): Promise<RevisionGoal>;
  findKnowledgeUnits(studentId: StudentId): Promise<KnowledgeUnit[]>;
  findMasteryStates(studentId: StudentId): Promise<MasteryState[]>;
  upsertMastery(input: {
    studentId: StudentId;
    knowledgeUnitId: string;
    score: number;
    lastPracticedAt: Date;
  }): Promise<MasteryState>;
}
