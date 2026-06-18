export interface CourseEntity {
  id: string;
  studentId: string;
  subjectId: string;
  title: string;
  description: string | null;
  chapterLabel: string | null;
  estimatedMinutes: number | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDocumentAttachment {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  fileName: string;
}

export class CourseContainsDocumentsError extends Error {
  readonly statusCode = 409;

  constructor() {
    super('Course contains documents');
  }
}
