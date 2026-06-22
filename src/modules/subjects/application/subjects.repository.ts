import { StudentId } from '../../../shared/domain/student-id';
import { Subject } from '../domain/subject.entity';
import type { SubjectLifecycleDecision } from '../domain/subject-lifecycle.entity';

export const SUBJECTS_REPOSITORY = Symbol('SUBJECTS_REPOSITORY');

export interface SubjectsRepository {
  create(input: {
    studentId: StudentId;
    name: string;
    priority: 1 | 2 | 3 | 4 | 5;
  }): Promise<Subject>;

  findByStudent(studentId: StudentId): Promise<Subject[]>;

  findByIdForStudent(input: {
    subjectId: string;
    studentId: StudentId;
  }): Promise<Subject | null>;

  getLifecycleDecisionForStudent(input: {
    subjectId: string;
    studentId: StudentId;
  }): Promise<SubjectLifecycleDecision | null>;

  updateForStudent(input: {
    subjectId: string;
    studentId: StudentId;
    name?: string;
    priority?: 1 | 2 | 3 | 4 | 5;
  }): Promise<Subject | null>;

  archiveForStudent(input: {
    subjectId: string;
    studentId: StudentId;
    reason: string;
  }): Promise<SubjectLifecycleDecision | null>;

  deleteForStudent(input: {
    subjectId: string;
    studentId: StudentId;
  }): Promise<boolean>;
}
