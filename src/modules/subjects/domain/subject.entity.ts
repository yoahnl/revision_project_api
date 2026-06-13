import { StudentId } from '../../../shared/domain/student-id';

export type SubjectPriority = 1 | 2 | 3 | 4 | 5;

export class Subject {
  readonly id: string;
  readonly studentId: StudentId;
  readonly name: string;
  readonly priority: SubjectPriority;
  readonly createdAt: Date;

  constructor(input: {
    id: string;
    studentId: StudentId;
    name: string;
    priority: SubjectPriority;
    createdAt: Date;
  }) {
    if (input.name.trim().length < 2) {
      throw new Error('Subject name must contain at least 2 characters');
    }
    if (
      !Number.isInteger(input.priority) ||
      input.priority < 1 ||
      input.priority > 5
    ) {
      throw new Error('Subject priority must be between 1 and 5');
    }

    this.id = input.id;
    this.studentId = input.studentId;
    this.name = input.name.trim();
    this.priority = input.priority;
    this.createdAt = input.createdAt;
  }
}
