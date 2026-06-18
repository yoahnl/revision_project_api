import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import type { CreateCourseRequest } from './create-course.request';
import {
  toCourseDetailResponse,
  toCourseListItemResponse,
} from './course-response.dto';

const MAX_COURSE_TITLE_LENGTH = 140;
const MAX_COURSE_DESCRIPTION_LENGTH = 1000;
const MAX_COURSE_CHAPTER_LABEL_LENGTH = 120;
const MAX_COURSE_ESTIMATED_MINUTES = 1440;

@Controller()
@UseGuards(FirebaseAuthGuard)
export class CoursesController {
  constructor(
    private readonly createCourse: CreateCourseUseCase,
    private readonly listCourses: ListSubjectCoursesWithStatsUseCase,
    private readonly getCourseDetail: GetCourseDetailUseCase,
    private readonly deleteCourseUseCase: DeleteCourseUseCase,
  ) {}

  @Get('subjects/:subjectId/courses')
  listForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.listCourses
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
      })
      .then((courses) => courses.map(toCourseListItemResponse))
      .catch(normalizeCourseError);
  }

  @Post('subjects/:subjectId/courses')
  createForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
    @Body() body: CreateCourseRequest,
  ) {
    const validatedBody = validateCreateCourseBody(body);

    return this.createCourse
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
        title: validatedBody.title,
        description: validatedBody.description,
        chapterLabel: validatedBody.chapterLabel,
        estimatedMinutes: validatedBody.estimatedMinutes,
      })
      .then((course) =>
        toCourseListItemResponse({
          ...course,
          sourceCount: 0,
          readySourceCount: 0,
          processingSourceCount: 0,
          failedSourceCount: 0,
        }),
      )
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId')
  getCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseDetail
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toCourseDetailResponse)
      .catch(normalizeCourseError);
  }

  @Delete('courses/:courseId')
  @HttpCode(204)
  async deleteCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    await this.deleteCourseUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }
}

function validateCreateCourseBody(body: CreateCourseRequest) {
  const title = trimRequiredString(
    body?.title,
    'Course title must contain at least 2 characters',
    MAX_COURSE_TITLE_LENGTH,
  );

  if (title.length < 2) {
    throw new BadRequestException(
      'Course title must contain at least 2 characters',
    );
  }

  return {
    title,
    description: trimOptionalString(
      body.description,
      'Course description is too long',
      MAX_COURSE_DESCRIPTION_LENGTH,
    ),
    chapterLabel: trimOptionalString(
      body.chapterLabel,
      'Course chapterLabel is too long',
      MAX_COURSE_CHAPTER_LABEL_LENGTH,
    ),
    estimatedMinutes: normalizeEstimatedMinutes(body.estimatedMinutes),
  };
}

function trimRequiredString(value: unknown, message: string, maxLength = 255) {
  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function trimOptionalString(
  value: unknown,
  message: string,
  maxLength: number,
) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function normalizeEstimatedMinutes(value: unknown) {
  if (value == null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_COURSE_ESTIMATED_MINUTES
  ) {
    throw new BadRequestException(
      'Course estimatedMinutes must be an integer between 1 and 1440',
    );
  }

  return value;
}

function normalizeCourseError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof CourseContainsDocumentsError) {
    throw new ConflictException('Course contains documents');
  }

  if (
    error instanceof Error &&
    (error.message === 'Course not found' ||
      error.message === 'Course subject not found')
  ) {
    throw new NotFoundException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'Course title must contain at least 2 characters' ||
      error.message ===
        'Course estimatedMinutes must be an integer between 1 and 1440' ||
      error.message === 'subjectId is required' ||
      error.message === 'courseId is required')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
