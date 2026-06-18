export class CreateCourseRequest {
  title!: string;
  description?: string | null;
  chapterLabel?: string | null;
  estimatedMinutes?: number | null;
}
