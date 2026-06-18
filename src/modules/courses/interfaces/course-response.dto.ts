import type {
  CourseDetailDto,
  CourseDocumentDto,
  CourseWithSourceStatsDto,
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
