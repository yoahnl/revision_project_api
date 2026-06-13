import { StudentId } from '../../../shared/domain/student-id';

export type ActivitySessionType = 'diagnostic_quiz';
export type ActivitySessionStatus = 'started' | 'completed';

export class ActivitySession {
  readonly id: string;
  readonly studentId: StudentId;
  readonly subjectId: string;
  readonly knowledgeUnitId: string;
  readonly type: ActivitySessionType;
  readonly status: ActivitySessionStatus;
  readonly createdAt: Date;
  readonly completedAt: Date | null;

  constructor(input: {
    id: string;
    studentId: StudentId;
    subjectId: string;
    knowledgeUnitId: string;
    type: ActivitySessionType;
    status: ActivitySessionStatus;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    this.id = input.id;
    this.studentId = input.studentId;
    this.subjectId = input.subjectId;
    this.knowledgeUnitId = input.knowledgeUnitId;
    this.type = input.type;
    this.status = input.status;
    this.createdAt = input.createdAt;
    this.completedAt = input.completedAt;
  }
}
