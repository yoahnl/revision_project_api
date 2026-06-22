export const COURSE_QUESTION_BANK_PREPARATION_REPOSITORY = Symbol(
  'COURSE_QUESTION_BANK_PREPARATION_REPOSITORY',
);

export type CourseQuestionBankPreparationJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface CourseQuestionBankPreparationJobDto {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string;
  documentId: string;
  knowledgeUnitId: string;
  targetQuestionCount: number;
  status: CourseQuestionBankPreparationJobStatus;
  attempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseQuestionBankPreparationRepository {
  findLatestForCourse(input: {
    studentId: string;
    courseId: string;
    targetQuestionCount: number;
  }): Promise<CourseQuestionBankPreparationJobDto | null>;

  findLatestForCourseContext(input: {
    studentId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    targetQuestionCount: number;
  }): Promise<CourseQuestionBankPreparationJobDto | null>;

  ensurePendingForCourseContext(input: {
    studentId: string;
    subjectId: string;
    courseId: string;
    documentId: string;
    knowledgeUnitId: string;
    targetQuestionCount: number;
  }): Promise<CourseQuestionBankPreparationJobDto>;

  claimNextPending(input: {
    preparationJobId?: string;
    maxAttempts: number;
  }): Promise<CourseQuestionBankPreparationJobDto | null>;

  markCompleted(input: { preparationJobId: string }): Promise<void>;

  markFailed(input: {
    preparationJobId: string;
    error: unknown;
    maxAttempts: number;
  }): Promise<void>;
}
