import { StudentId } from '../../../shared/domain/student-id';

export class RevisionGoal {
  readonly id: string;
  readonly studentId: StudentId;
  readonly targetDate: Date;
  readonly weeklyMinutes: number;
  readonly createdAt: Date;

  constructor(input: {
    id: string;
    studentId: StudentId;
    targetDate: Date;
    weeklyMinutes: number;
    createdAt: Date;
  }) {
    if (
      !(input.targetDate instanceof Date) ||
      Number.isNaN(input.targetDate.getTime())
    ) {
      throw new Error('Revision goal target date must be valid');
    }

    if (!Number.isInteger(input.weeklyMinutes) || input.weeklyMinutes < 30) {
      throw new Error('Weekly revision time must be at least 30 minutes');
    }

    this.id = input.id;
    this.studentId = input.studentId;
    this.targetDate = input.targetDate;
    this.weeklyMinutes = input.weeklyMinutes;
    this.createdAt = input.createdAt;
  }
}
