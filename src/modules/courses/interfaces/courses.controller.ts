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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from '../application/course-progress.use-case';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from '../application/course-source-lifecycle.use-case';
import {
  QUICK_QUESTION_BANK_MAX_QUESTION_COUNT,
  QUICK_QUESTION_BANK_MIN_QUESTION_COUNT,
} from '../../activities/application/question-bank.service';
import {
  CourseQuickRevisionGenerationFailedError,
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionQuestionCountInvalidError,
  CourseQuickRevisionQuestionsPreparingError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from '../application/start-course-quick-revision-session.use-case';
import { toPublicRevisionSheet } from '../../study-artifacts/interfaces/study-artifact-response.mapper';
import {
  MAX_DOCUMENT_BYTES,
  type UploadedCoursePdfFile,
  validateCoursePdfFile,
} from '../../documents/interfaces/course-pdf-upload.validator';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseDocumentUseCase } from '../application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  SourceArchiveBlockedError,
  SourceDeleteBlockedError,
} from '../../documents/domain/source-lifecycle.entity';
import type { CreateCourseRequest } from './create-course.request';
import {
  toCourseDocumentResponse,
  toCourseDetailResponse,
  toCourseListItemResponse,
  toCourseProgressResponse,
  toSubjectProgressResponse,
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
    private readonly deleteCourseDocumentUseCase: DeleteCourseDocumentUseCase,
    private readonly uploadCoursePdfForCourseUseCase: UploadCoursePdfForCourseUseCase,
    private readonly getCourseRevisionSheetUseCase: GetCourseRevisionSheetUseCase,
    private readonly generateCourseRevisionSheetUseCase: GenerateCourseRevisionSheetUseCase,
    private readonly startCourseQuickRevisionSessionUseCase: StartCourseQuickRevisionSessionUseCase,
    private readonly getCourseProgressUseCase: GetCourseProgressUseCase,
    private readonly getSubjectProgressUseCase: GetSubjectProgressUseCase,
    private readonly getCourseSourceLifecycleUseCase: GetCourseSourceLifecycleUseCase,
    private readonly archiveCourseSourceUseCase: ArchiveCourseSourceUseCase,
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

  @Get('courses/:courseId/progress')
  getCourseProgress(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseProgressUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toCourseProgressResponse)
      .catch(normalizeCourseError);
  }

  @Get('subjects/:subjectId/progress')
  getSubjectProgress(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.getSubjectProgressUseCase
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
      })
      .then(toSubjectProgressResponse)
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

  @Delete('courses/:courseId/sources/:documentId')
  @HttpCode(204)
  async deleteCourseDocument(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.deleteCourseDocumentUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        documentId: trimRequiredString(documentId, 'Document id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/sources/:documentId/lifecycle')
  getCourseSourceLifecycle(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.getCourseSourceLifecycleUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        documentId: trimRequiredString(documentId, 'Document id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/sources/:documentId/archive')
  archiveCourseSource(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.archiveCourseSourceUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        documentId: trimRequiredString(documentId, 'Document id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/source/course-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  uploadCoursePdfForCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @UploadedFile() file: UploadedCoursePdfFile | undefined,
    @Body() body: Record<string, unknown> = {},
  ) {
    rejectClientOwnedUploadFields(body);

    const validatedFile = validateCoursePdfFile(file);

    return this.uploadCoursePdfForCourseUseCase
      .execute({
        studentId: student.id,
        firebaseUid: student.firebaseUid,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        originalFileName: validatedFile.originalFileName,
        content: validatedFile.content,
        mimeType: validatedFile.mimeType,
      })
      .then(toCourseDocumentResponse)
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/revision-sheet')
  getCourseRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseRevisionSheetUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then((revisionSheet) => {
        if (!revisionSheet) {
          throw new NotFoundException('Revision sheet not found');
        }

        return toPublicRevisionSheet(revisionSheet);
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/revision-sheet')
  generateCourseRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.generateCourseRevisionSheetUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toPublicRevisionSheet)
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/revision-sessions/quick')
  startQuickRevisionSession(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateQuickRevisionBody(body);

    return this.startCourseQuickRevisionSessionUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        questionCount: validatedBody.questionCount,
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

function rejectClientOwnedUploadFields(body: Record<string, unknown> = {}) {
  if ('studentId' in body || 'subjectId' in body || 'courseId' in body) {
    throw new BadRequestException(
      'Course upload only accepts the multipart file field',
    );
  }
}

function validateQuickRevisionBody(body: Record<string, unknown> = {}): {
  questionCount?: number;
} {
  if (
    'studentId' in body ||
    'subjectId' in body ||
    'documentId' in body ||
    'knowledgeUnitId' in body ||
    'courseId' in body
  ) {
    throw new BadRequestException(
      'Course quick revision only accepts courseId from the URL',
    );
  }

  const allowedFields = new Set(['questionCount']);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException(
      'Course quick revision only accepts questionCount in the body',
    );
  }

  if (!('questionCount' in body)) {
    return {};
  }

  const questionCount = body.questionCount;

  if (
    typeof questionCount !== 'number' ||
    !Number.isInteger(questionCount) ||
    questionCount < QUICK_QUESTION_BANK_MIN_QUESTION_COUNT ||
    questionCount > QUICK_QUESTION_BANK_MAX_QUESTION_COUNT
  ) {
    throw new BadRequestException(
      'Course quick revision questionCount must be an integer between 5 and 30',
    );
  }

  return { questionCount };
}

function normalizeCourseError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof CourseContainsDocumentsError) {
    throw new ConflictException('Course contains documents');
  }

  if (
    error instanceof SourceDeleteBlockedError ||
    error instanceof SourceArchiveBlockedError
  ) {
    throw new ConflictException({
      code: error.code,
      message: error.message,
      decision: error.decision,
    });
  }

  if (error instanceof CourseRevisionSheetSourceNotReadyError) {
    throw new ConflictException(error.message);
  }

  if (
    error instanceof CourseQuickRevisionSourceNotReadyError ||
    error instanceof CourseQuickRevisionKnowledgeUnitNotReadyError ||
    error instanceof CourseQuickRevisionGenerationFailedError ||
    error instanceof CourseQuickRevisionQuestionsPreparingError
  ) {
    throw new ConflictException(error.message);
  }

  if (error instanceof CourseQuickRevisionQuestionCountInvalidError) {
    throw new BadRequestException(error.message);
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
