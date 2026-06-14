import { StudentId } from '../../../shared/domain/student-id';
import { Subject } from '../domain/subject.entity';

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

  deleteForStudent(input: {
    subjectId: string;
    studentId: StudentId;
  }): Promise<boolean>;
}
