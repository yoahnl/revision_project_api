import type {
  CourseDocumentAttachment,
  CourseEntity,
} from '../domain/course.entity';
import type { CourseLifecycleDecision } from '../domain/course-lifecycle.entity';

export const COURSES_REPOSITORY = Symbol('COURSES_REPOSITORY');

export type CourseDto = CourseEntity;

export type CourseDocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export type CourseDocumentKind = 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';

export type CourseProgressState =
  | 'NO_SOURCE'
  | 'PROCESSING'
  | 'FAILED_ONLY'
  | 'NO_KNOWLEDGE_UNITS'
  | 'READY_NOT_PRACTICED'
  | 'PRACTICED';

export interface CourseWithSourceStatsDto extends CourseDto {
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
}

export interface CourseDocumentDto {
  id: string;
  courseId: string;
  documentId: string;
  fileName: string;
  kind: CourseDocumentKind;
  status: CourseDocumentStatus;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDetailDto {
  course: CourseWithSourceStatsDto;
  subject: {
    id: string;
    name: string;
  };
  sources: CourseDocumentDto[];
}

export interface CourseProgressDto {
  courseId: string;
  subjectId: string;
  knowledgeUnitCount: number;
  practicedKnowledgeUnitCount: number;
  coverage: number;
  mastery: number | null;
  estimatedGlobalMastery: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
  lastPracticedAt: Date | null;
  state: CourseProgressState;
}

export interface SubjectCourseProgressDto {
  courseId: string;
  title: string;
  knowledgeUnitCount: number;
  practicedKnowledgeUnitCount: number;
  coverage: number;
  mastery: number | null;
  estimatedGlobalMastery: number;
  state: CourseProgressState;
}

export interface SubjectProgressDto {
  subjectId: string;
  knowledgeUnitCount: number;
  practicedKnowledgeUnitCount: number;
  coverage: number;
  mastery: number | null;
  estimatedGlobalMastery: number;
  courseCount: number;
  readyCourseCount: number;
  lastPracticedAt: Date | null;
  courses: SubjectCourseProgressDto[];
}

export type CourseLearningPathNodeState =
  | 'SOLID'
  | 'IN_PROGRESS'
  | 'TO_STRENGTHEN'
  | 'UNDISCOVERED';

export type CourseLearningPathPrimaryActionKind =
  | 'ADD_SOURCE'
  | 'WAIT_FOR_ANALYSIS'
  | 'REVIEW_ACTIVE_NODE'
  | 'CONTINUE_COURSE'
  | 'PREPARE_QUESTIONS'
  | 'UNAVAILABLE';

export interface CourseLearningPathDocumentDto {
  id: string;
  courseId: string | null;
  fileName: string;
  kind: CourseDocumentKind;
  status: CourseDocumentStatus;
  createdAt: Date;
}

export interface CourseLearningPathKnowledgeUnitDto {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  displayOrder: number | null;
  createdAt: Date;
  mastery: Array<{
    score: number;
    lastPracticedAt: Date | null;
  }>;
}

export interface CourseLearningPathDataDto {
  course: {
    id: string;
    subjectId: string;
    subjectName: string;
    title: string;
    estimatedMinutes: number | null;
  };
  documents: CourseLearningPathDocumentDto[];
  knowledgeUnits: CourseLearningPathKnowledgeUnitDto[];
}

export interface CourseLearningPathNodeDto {
  id: string;
  knowledgeUnitId: string;
  courseId: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  order: number;
  state: CourseLearningPathNodeState;
  masteryScore: number | null;
  lastPracticedAt: Date | null;
  source: {
    documentId: string;
    fileName: string;
  } | null;
  display: {
    title: string;
    statusLabel: string;
    metaLabel: string | null;
    actionLabel: string;
    unavailableReason: string | null;
  };
}

export interface CourseLearningPathDto {
  generatedAt: Date;
  course: {
    id: string;
    subjectId: string;
    subjectName: string;
    title: string;
  };
  summary: {
    knowledgeUnitCount: number;
    solidCount: number;
    inProgressCount: number;
    toStrengthenCount: number;
    undiscoveredCount: number;
    estimatedGlobalMastery: number;
    mastery: number | null;
    coverage: number;
    readySourceCount: number;
  };
  activeNodeId: string | null;
  primaryAction: {
    kind: CourseLearningPathPrimaryActionKind;
    label: string;
    description: string;
    estimatedMinutes: number | null;
    targetKnowledgeUnitId: string | null;
    targetNodeId: string | null;
    enabled: boolean;
    unavailableReason: string | null;
  };
  nodes: CourseLearningPathNodeDto[];
  emptyState: {
    title: string;
    message: string;
    actionLabel: string;
    actionKind: 'ADD_SOURCE' | 'WAIT_FOR_ANALYSIS' | 'RETRY_SOURCE' | 'NONE';
  } | null;
}

export interface CreateCourseRepositoryInput {
  studentId: string;
  subjectId: string;
  title: string;
  description?: string | null;
  chapterLabel?: string | null;
  estimatedMinutes?: number | null;
}

export interface UpdateCourseRepositoryInput {
  studentId: string;
  courseId: string;
  title?: string;
  description?: string | null;
  chapterLabel?: string | null;
  estimatedMinutes?: number | null;
}

export interface CourseOwnershipContext {
  courseId: string;
  studentId: string;
  subjectId: string;
}

export interface CourseQuickRevisionKnowledgeUnitDto {
  id: string;
  subjectId: string;
  documentId: string;
  title: string | null;
}

export interface CourseBackfillDryRunItem {
  documentId: string;
  studentId: string;
  subjectId: string;
  proposedTitle: string;
}

export interface CourseBackfillDryRunResult {
  documentsWithoutCourseCount: number;
  coursesToCreateCount: number;
  documentsToAttachCount: number;
  items: CourseBackfillDryRunItem[];
}

export interface CoursesRepository {
  create(input: CreateCourseRepositoryInput): Promise<CourseDto>;

  findByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDto | null>;

  listBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseDto[]>;

  listBySubjectForStudentWithStats(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]>;

  findDetailByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto | null>;

  findCourseProgressByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseProgressDto | null>;

  findSubjectProgressForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<SubjectProgressDto | null>;

  findCourseLearningPathByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseLearningPathDataDto | null>;

  getLifecycleDecisionForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseLifecycleDecision | null>;

  updateForStudent(
    input: UpdateCourseRepositoryInput,
  ): Promise<CourseWithSourceStatsDto | null>;

  archiveForStudent(input: {
    studentId: string;
    courseId: string;
    reason: string;
  }): Promise<CourseLifecycleDecision | null>;

  deleteIfEmpty(input: {
    studentId: string;
    courseId: string;
  }): Promise<boolean>;

  findCourseOwnershipContext(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseOwnershipContext | null>;

  findFirstReadyCoursePdfDocumentForCourse(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDocumentDto | null>;

  findFirstQuickRevisionKnowledgeUnitForCourseDocument(input: {
    studentId: string;
    courseId: string;
    subjectId: string;
    documentId: string;
  }): Promise<CourseQuickRevisionKnowledgeUnitDto | null>;

  findReadyQuickRevisionKnowledgeUnitsForCourse(input: {
    studentId: string;
    courseId: string;
    subjectId: string;
  }): Promise<CourseQuickRevisionKnowledgeUnitDto[]>;

  attachDocumentToCourse(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<CourseDocumentAttachment>;

  backfillFromExistingDocumentsDryRun(): Promise<CourseBackfillDryRunResult>;

  backfillFromExistingDocuments(): Promise<CourseBackfillDryRunResult>;
}
