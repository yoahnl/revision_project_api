import type {
  CourseDetailDto,
  CourseDocumentDto,
  CourseProgressDto,
  CourseWithSourceStatsDto,
  SubjectProgressDto,
} from '../application/courses.repository';

export type CourseListItemResponse = {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  chapterLabel: string | null;
  estimatedMinutes: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
};

export type CourseDocumentResponse = {
  id: string;
  courseId: string;
  documentId: string;
  fileName: string;
  kind: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseDetailResponse = {
  course: CourseListItemResponse;
  subject: {
    id: string;
    name: string;
  };
  sources: CourseDocumentResponse[];
};

export type CourseProgressResponse = {
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
  lastPracticedAt: string | null;
  state: string;
};

export type SubjectProgressResponse = {
  subjectId: string;
  knowledgeUnitCount: number;
  practicedKnowledgeUnitCount: number;
  coverage: number;
  mastery: number | null;
  estimatedGlobalMastery: number;
  courseCount: number;
  readyCourseCount: number;
  lastPracticedAt: string | null;
  courses: Array<{
    courseId: string;
    title: string;
    knowledgeUnitCount: number;
    practicedKnowledgeUnitCount: number;
    coverage: number;
    mastery: number | null;
    estimatedGlobalMastery: number;
    state: string;
  }>;
};

export function toCourseListItemResponse(
  course: CourseWithSourceStatsDto,
): CourseListItemResponse {
  return {
    id: course.id,
    subjectId: course.subjectId,
    title: course.title,
    description: course.description,
    chapterLabel: course.chapterLabel,
    estimatedMinutes: course.estimatedMinutes,
    displayOrder: course.displayOrder,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    sourceCount: course.sourceCount,
    readySourceCount: course.readySourceCount,
    processingSourceCount: course.processingSourceCount,
    failedSourceCount: course.failedSourceCount,
  };
}

export function toCourseDocumentResponse(
  source: CourseDocumentDto,
): CourseDocumentResponse {
  return {
    id: source.id,
    courseId: source.courseId,
    documentId: source.documentId,
    fileName: source.fileName,
    kind: source.kind,
    status: source.status,
    errorCode: source.errorCode,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export function toCourseDetailResponse(
  detail: CourseDetailDto,
): CourseDetailResponse {
  return {
    course: toCourseListItemResponse(detail.course),
    subject: detail.subject,
    sources: detail.sources.map(toCourseDocumentResponse),
  };
}

export function toCourseProgressResponse(
  progress: CourseProgressDto,
): CourseProgressResponse {
  return {
    courseId: progress.courseId,
    subjectId: progress.subjectId,
    knowledgeUnitCount: progress.knowledgeUnitCount,
    practicedKnowledgeUnitCount: progress.practicedKnowledgeUnitCount,
    coverage: progress.coverage,
    mastery: progress.mastery,
    estimatedGlobalMastery: progress.estimatedGlobalMastery,
    readySourceCount: progress.readySourceCount,
    processingSourceCount: progress.processingSourceCount,
    failedSourceCount: progress.failedSourceCount,
    lastPracticedAt: progress.lastPracticedAt?.toISOString() ?? null,
    state: progress.state,
  };
}

export function toSubjectProgressResponse(
  progress: SubjectProgressDto,
): SubjectProgressResponse {
  return {
    subjectId: progress.subjectId,
    knowledgeUnitCount: progress.knowledgeUnitCount,
    practicedKnowledgeUnitCount: progress.practicedKnowledgeUnitCount,
    coverage: progress.coverage,
    mastery: progress.mastery,
    estimatedGlobalMastery: progress.estimatedGlobalMastery,
    courseCount: progress.courseCount,
    readyCourseCount: progress.readyCourseCount,
    lastPracticedAt: progress.lastPracticedAt?.toISOString() ?? null,
    courses: progress.courses.map((course) => ({
      courseId: course.courseId,
      title: course.title,
      knowledgeUnitCount: course.knowledgeUnitCount,
      practicedKnowledgeUnitCount: course.practicedKnowledgeUnitCount,
      coverage: course.coverage,
      mastery: course.mastery,
      estimatedGlobalMastery: course.estimatedGlobalMastery,
      state: course.state,
    })),
  };
}
