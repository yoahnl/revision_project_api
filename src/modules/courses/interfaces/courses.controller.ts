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
  Patch,
  Post,
  Query,
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
import { GetCourseLearningPathUseCase } from '../application/get-course-learning-path.use-case';
import {
  GetCourseQuestionBankReadinessUseCase,
  PrepareCourseQuestionBankUseCase,
} from '../application/course-question-bank-readiness.use-case';
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
import { GetResumableCourseRevisionSessionUseCase } from '../../revision-sessions/application/get-resumable-course-revision-session.use-case';
import { ListCourseExamPreparationSessionHistoryUseCase } from '../../revision-sessions/application/exam-preparation-sessions.use-cases';
import { ListCourseRevisionSessionHistoryUseCase } from '../../revision-sessions/application/list-revision-session-history.use-case';
import { ListCourseRichClosedExerciseHistoryUseCase } from '../../activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case';
import { toPublicRevisionSheet } from '../../study-artifacts/interfaces/study-artifact-response.mapper';
import {
  MAX_DOCUMENT_BYTES,
  type UploadedCoursePdfFile,
  validateCoursePdfFile,
} from '../../documents/interfaces/course-pdf-upload.validator';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { ArchiveCourseUseCase } from '../application/archive-course.use-case';
import { DeleteCourseDocumentUseCase } from '../application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { GetCourseDeepRevisionOptionsUseCase } from '../application/get-course-deep-revision-options.use-case';
import { GetCourseExamPreparationOptionsUseCase } from '../application/get-course-exam-preparation-options.use-case';
import { GetCourseRichRevisionOptionsUseCase } from '../application/get-course-rich-revision-options.use-case';
import { GetCourseLifecycleUseCase } from '../application/get-course-lifecycle.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import {
  CourseExamPreparationInsufficientQuestionsError,
  CourseExamPreparationQuestionCountInvalidError,
  CourseExamPreparationScopeNotReadyError,
  StartCourseExamPreparationSessionUseCase,
  type CourseExamPreparationSessionScopeKind,
} from '../application/start-course-exam-preparation-session.use-case';
import {
  CourseRichRevisionQuestionCountInvalidError,
  CourseRichRevisionScopeNotReadyError,
  StartCourseRichRevisionSessionUseCase,
  type StartCourseRichRevisionSessionInput,
} from '../application/start-course-rich-revision-session.use-case';
import {
  CourseDeepRevisionAnswerInvalidError,
  CourseDeepRevisionScopeNotReadyError,
  CourseDeepRevisionSessionNotReadyError,
  GetCourseDeepRevisionResultUseCase,
  ListCourseDeepRevisionHistoryUseCase,
  StartCourseDeepRevisionSessionUseCase,
  SubmitCourseDeepRevisionAnswerUseCase,
} from '../application/course-deep-revision-session.use-case';
import { UpdateCourseUseCase } from '../application/update-course.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  CourseArchiveBlockedError,
  CourseDeleteBlockedError,
} from '../domain/course-lifecycle.entity';
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
import { toCourseLearningPathResponse } from './course-learning-path-response.dto';

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
    private readonly getCourseLifecycleUseCase: GetCourseLifecycleUseCase,
    private readonly updateCourseUseCase: UpdateCourseUseCase,
    private readonly archiveCourseUseCase: ArchiveCourseUseCase,
    private readonly deleteCourseUseCase: DeleteCourseUseCase,
    private readonly deleteCourseDocumentUseCase: DeleteCourseDocumentUseCase,
    private readonly uploadCoursePdfForCourseUseCase: UploadCoursePdfForCourseUseCase,
    private readonly getCourseRevisionSheetUseCase: GetCourseRevisionSheetUseCase,
    private readonly generateCourseRevisionSheetUseCase: GenerateCourseRevisionSheetUseCase,
    private readonly getCourseQuestionBankReadinessUseCase: GetCourseQuestionBankReadinessUseCase,
    private readonly prepareCourseQuestionBankUseCase: PrepareCourseQuestionBankUseCase,
    private readonly getCourseExamPreparationOptionsUseCase: GetCourseExamPreparationOptionsUseCase,
    private readonly startCourseExamPreparationSessionUseCase: StartCourseExamPreparationSessionUseCase,
    private readonly getCourseRichRevisionOptionsUseCase: GetCourseRichRevisionOptionsUseCase,
    private readonly startCourseRichRevisionSessionUseCase: StartCourseRichRevisionSessionUseCase,
    private readonly getCourseDeepRevisionOptionsUseCase: GetCourseDeepRevisionOptionsUseCase,
    private readonly startCourseDeepRevisionSessionUseCase: StartCourseDeepRevisionSessionUseCase,
    private readonly submitCourseDeepRevisionAnswerUseCase: SubmitCourseDeepRevisionAnswerUseCase,
    private readonly getCourseDeepRevisionResultUseCase: GetCourseDeepRevisionResultUseCase,
    private readonly listCourseDeepRevisionHistoryUseCase: ListCourseDeepRevisionHistoryUseCase,
    private readonly startCourseQuickRevisionSessionUseCase: StartCourseQuickRevisionSessionUseCase,
    private readonly getResumableCourseRevisionSessionUseCase: GetResumableCourseRevisionSessionUseCase,
    private readonly listCourseRevisionSessionHistoryUseCase: ListCourseRevisionSessionHistoryUseCase,
    private readonly listCourseExamPreparationSessionHistoryUseCase: ListCourseExamPreparationSessionHistoryUseCase,
    private readonly listCourseRichClosedExerciseHistoryUseCase: ListCourseRichClosedExerciseHistoryUseCase,
    private readonly getCourseProgressUseCase: GetCourseProgressUseCase,
    private readonly getSubjectProgressUseCase: GetSubjectProgressUseCase,
    private readonly getCourseLearningPathUseCase: GetCourseLearningPathUseCase,
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

  @Get('courses/:courseId/lifecycle')
  getCourseLifecycle(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseLifecycleUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Patch('courses/:courseId')
  updateCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateUpdateCourseBody(body);

    return this.updateCourseUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        ...validatedBody,
      })
      .then(toCourseListItemResponse)
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/archive')
  archiveCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.archiveCourseUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
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

  @Get('courses/:courseId/learning-path')
  getCourseLearningPath(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseLearningPathUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toCourseLearningPathResponse)
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/exam-preparation/options')
  getExamPreparationOptions(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseExamPreparationOptionsUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/exam-preparation/sessions')
  startExamPreparationSession(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateExamPreparationSessionBody(body);

    return this.startCourseExamPreparationSessionUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        scopeKind: validatedBody.scopeKind,
        scopeId: validatedBody.scopeId,
        questionCount: validatedBody.questionCount,
        complexityProfile: validatedBody.complexityProfile,
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/rich-revision/options')
  getRichRevisionOptions(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseRichRevisionOptionsUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/rich-revision/sessions')
  startRichRevisionSession(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateRichRevisionSessionBody(body);

    return this.startCourseRichRevisionSessionUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        scopeKind: validatedBody.scopeKind,
        scopeId: validatedBody.scopeId,
        questionCount: validatedBody.questionCount,
        complexityProfile: validatedBody.complexityProfile,
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/deep-revision/options')
  getDeepRevisionOptions(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseDeepRevisionOptionsUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/deep-revision/sessions')
  startDeepRevisionSession(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateDeepRevisionSessionBody(body);

    return this.startCourseDeepRevisionSessionUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        scopeKind: validatedBody.scopeKind,
        scopeId: validatedBody.scopeId,
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/deep-revision/sessions/:sessionId/submit')
  submitDeepRevisionAnswer(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateDeepRevisionAnswerBody(body);

    return this.submitCourseDeepRevisionAnswerUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        sessionId: trimRequiredString(sessionId, 'Session id is required'),
        answer: validatedBody.answer,
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/deep-revision/sessions/:sessionId/result')
  getDeepRevisionResult(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.getCourseDeepRevisionResultUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        sessionId: trimRequiredString(sessionId, 'Session id is required'),
      })
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

  @Get('courses/:courseId/question-bank/readiness')
  getQuestionBankReadiness(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Query('questionCount') questionCount?: string,
  ) {
    return this.getCourseQuestionBankReadinessUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        questionCount: normalizeOptionalQuestionCountQuery(questionCount),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/question-bank/prepare')
  @HttpCode(202)
  prepareQuestionBank(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateQuestionBankPreparationBody(body);

    return this.prepareCourseQuestionBankUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        questionCount: validatedBody.questionCount,
      })
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

  @Get('courses/:courseId/revision-sessions/resumable')
  getResumableRevisionSession(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getResumableCourseRevisionSessionUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/revision-sessions/history')
  getCourseRevisionSessionHistory(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Query('limit') limit?: string,
  ) {
    return this.listCourseRevisionSessionHistoryUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        limit: normalizeOptionalHistoryLimitQuery(limit),
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/exam-preparation/history')
  getCourseExamPreparationSessionHistory(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Query('limit') limit?: string,
  ) {
    return this.listCourseExamPreparationSessionHistoryUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        limit: normalizeOptionalHistoryLimitQuery(limit),
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/deep-revision/history')
  getCourseDeepRevisionHistory(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Query('limit') limit?: string,
  ) {
    return this.listCourseDeepRevisionHistoryUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        limit: normalizeOptionalHistoryLimitQuery(limit),
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/rich-closed/history')
  getCourseRichClosedHistory(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Query('limit') limit?: string,
  ) {
    return this.listCourseRichClosedExerciseHistoryUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        limit: normalizeOptionalHistoryLimitQuery(limit) ?? 5,
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

function validateUpdateCourseBody(body: Record<string, unknown>) {
  const allowedFields = new Set([
    'title',
    'description',
    'chapterLabel',
    'estimatedMinutes',
  ]);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException('Course update contains unsupported fields');
  }

  const update: {
    title?: string;
    description?: string | null;
    chapterLabel?: string | null;
    estimatedMinutes?: number | null;
  } = {};

  if ('title' in body) {
    const title = trimRequiredString(
      body.title,
      'Course title must contain at least 2 characters',
      MAX_COURSE_TITLE_LENGTH,
    );

    if (title.length < 2) {
      throw new BadRequestException(
        'Course title must contain at least 2 characters',
      );
    }

    update.title = title;
  }

  if ('description' in body) {
    update.description = trimOptionalString(
      body.description,
      'Course description is too long',
      MAX_COURSE_DESCRIPTION_LENGTH,
    );
  }

  if ('chapterLabel' in body) {
    update.chapterLabel = trimOptionalString(
      body.chapterLabel,
      'Course chapterLabel is too long',
      MAX_COURSE_CHAPTER_LABEL_LENGTH,
    );
  }

  if ('estimatedMinutes' in body) {
    update.estimatedMinutes = normalizeEstimatedMinutes(body.estimatedMinutes);
  }

  if (Object.keys(update).length === 0) {
    throw new BadRequestException('Course update requires at least one field');
  }

  return update;
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

function validateExamPreparationSessionBody(
  body: Record<string, unknown> = {},
): {
  scopeKind: CourseExamPreparationSessionScopeKind;
  scopeId: string;
  questionCount: number;
  complexityProfile: 'exam';
} {
  const allowedFields = new Set([
    'scopeKind',
    'scopeId',
    'questionCount',
    'complexityProfile',
  ]);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException(
      'Course exam preparation only accepts scopeKind, scopeId, questionCount and complexityProfile',
    );
  }

  const scopeKind = body.scopeKind;
  if (scopeKind !== 'course' && scopeKind !== 'source') {
    throw new BadRequestException(
      'Course exam preparation scopeKind must be course or source',
    );
  }

  const scopeId = trimRequiredString(
    body.scopeId,
    'Course exam preparation scopeId is required',
  );
  const questionCount = body.questionCount;
  if (
    typeof questionCount !== 'number' ||
    !Number.isInteger(questionCount) ||
    ![10, 20, 30].includes(questionCount)
  ) {
    throw new BadRequestException(
      'Course exam preparation questionCount must be 10, 20 or 30',
    );
  }

  if (body.complexityProfile !== 'exam') {
    throw new BadRequestException(
      'Course exam preparation complexityProfile must be exam',
    );
  }

  return {
    scopeKind,
    scopeId,
    questionCount,
    complexityProfile: 'exam',
  };
}

function validateRichRevisionSessionBody(
  body: Record<string, unknown> = {},
): Pick<
  StartCourseRichRevisionSessionInput,
  'scopeKind' | 'scopeId' | 'questionCount' | 'complexityProfile'
> {
  const forbiddenFields = new Set([
    'studentId',
    'subjectId',
    'courseId',
    'documentId',
    'knowledgeUnitId',
    'questionTypeMix',
  ]);
  const forbiddenField = Object.keys(body).find((field) =>
    forbiddenFields.has(field),
  );

  if (forbiddenField) {
    throw new BadRequestException(
      'Course rich revision only accepts its configuration fields',
    );
  }

  const allowedFields = new Set([
    'scopeKind',
    'scopeId',
    'questionCount',
    'complexityProfile',
  ]);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException(
      'Course rich revision only accepts scopeKind, scopeId, questionCount and complexityProfile',
    );
  }

  if (body.scopeKind !== 'knowledge_unit') {
    throw new BadRequestException(
      'Course rich revision scopeKind must be knowledge_unit',
    );
  }

  const scopeId = trimRequiredString(
    body.scopeId,
    'Course rich revision scopeId is required',
  );
  const questionCount = body.questionCount;
  if (
    typeof questionCount !== 'number' ||
    !Number.isInteger(questionCount) ||
    ![6, 10, 13].includes(questionCount)
  ) {
    throw new BadRequestException(
      'Course rich revision questionCount must be 6, 10 or 13',
    );
  }

  if (
    body.complexityProfile !== 'standard' &&
    body.complexityProfile !== 'advanced'
  ) {
    throw new BadRequestException(
      'Course rich revision complexityProfile must be standard or advanced',
    );
  }

  return {
    scopeKind: 'knowledge_unit',
    scopeId,
    questionCount,
    complexityProfile: body.complexityProfile,
  };
}

function validateDeepRevisionSessionBody(body: Record<string, unknown> = {}): {
  scopeKind: 'knowledge_unit';
  scopeId: string;
} {
  const forbiddenFields = new Set([
    'studentId',
    'subjectId',
    'courseId',
    'documentId',
    'knowledgeUnitId',
    'questionTypeMix',
    'questionCount',
    'complexityProfile',
  ]);
  const forbiddenField = Object.keys(body).find((field) =>
    forbiddenFields.has(field),
  );

  if (forbiddenField) {
    throw new BadRequestException(
      'Course deep revision only accepts scopeKind and scopeId',
    );
  }

  const allowedFields = new Set(['scopeKind', 'scopeId']);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException(
      'Course deep revision only accepts scopeKind and scopeId',
    );
  }

  if (body.scopeKind !== 'knowledge_unit') {
    throw new BadRequestException(
      'Course deep revision scopeKind must be knowledge_unit',
    );
  }

  return {
    scopeKind: 'knowledge_unit',
    scopeId: trimRequiredString(
      body.scopeId,
      'Course deep revision scopeId is required',
    ),
  };
}

function validateDeepRevisionAnswerBody(body: Record<string, unknown> = {}): {
  answer: string;
} {
  const allowedFields = new Set(['answer']);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException('Course deep revision only accepts answer');
  }

  return {
    answer: trimRequiredString(
      body.answer,
      'Course deep revision answer is required',
      4000,
    ),
  };
}

function validateQuestionBankPreparationBody(
  body: Record<string, unknown> = {},
): {
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
      'Question bank preparation only accepts courseId from the URL',
    );
  }

  const allowedFields = new Set(['questionCount']);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException(
      'Question bank preparation only accepts questionCount in the body',
    );
  }

  if (!('questionCount' in body)) {
    return {};
  }

  return {
    questionCount: normalizeQuestionCount(body.questionCount),
  };
}

function normalizeOptionalQuestionCountQuery(
  questionCount: string | undefined,
): number | undefined {
  if (questionCount == null) {
    return undefined;
  }

  if (!/^\d+$/.test(questionCount)) {
    throw new BadRequestException(
      'Course quick revision questionCount must be an integer between 5 and 30',
    );
  }

  return normalizeQuestionCount(Number(questionCount));
}

function normalizeOptionalHistoryLimitQuery(
  limit: string | undefined,
): number | undefined {
  if (limit == null) {
    return undefined;
  }

  if (!/^\d+$/.test(limit.trim())) {
    throw new BadRequestException('History limit invalid');
  }

  const parsed = Number(limit.trim());

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new BadRequestException('History limit invalid');
  }

  return parsed;
}

function normalizeQuestionCount(questionCount: unknown): number {
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

  return questionCount;
}

function normalizeCourseError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof CourseContainsDocumentsError) {
    throw new ConflictException('Course contains documents');
  }

  if (
    error instanceof CourseDeleteBlockedError ||
    error instanceof CourseArchiveBlockedError
  ) {
    throw new ConflictException({
      code: error.code,
      message: error.message,
      decision: error.decision,
    });
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
    error instanceof CourseQuickRevisionGenerationFailedError
  ) {
    throw new ConflictException(error.message);
  }

  if (error instanceof CourseQuickRevisionQuestionsPreparingError) {
    throw new ConflictException({
      code: error.code,
      message:
        error.readiness?.userMessage ??
        'Les questions sont en préparation. Réessaie dans un instant.',
      readiness: error.readiness,
    });
  }

  if (error instanceof CourseQuickRevisionQuestionCountInvalidError) {
    throw new BadRequestException(error.message);
  }

  if (error instanceof CourseExamPreparationQuestionCountInvalidError) {
    throw new BadRequestException(error.message);
  }

  if (error instanceof CourseExamPreparationScopeNotReadyError) {
    throw new ConflictException(error.message);
  }

  if (error instanceof CourseExamPreparationInsufficientQuestionsError) {
    throw new ConflictException(error.message);
  }

  if (error instanceof CourseRichRevisionQuestionCountInvalidError) {
    throw new BadRequestException(error.message);
  }

  if (error instanceof CourseRichRevisionScopeNotReadyError) {
    throw new ConflictException(error.message);
  }

  if (error instanceof CourseDeepRevisionAnswerInvalidError) {
    throw new BadRequestException(error.message);
  }

  if (
    error instanceof CourseDeepRevisionScopeNotReadyError ||
    error instanceof CourseDeepRevisionSessionNotReadyError
  ) {
    throw new ConflictException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'RICH_CLOSED_SOURCE_CONTEXT_EMPTY' ||
      error.message === 'RICH_CLOSED_START_INVALID_INPUT')
  ) {
    throw new ConflictException('QCM complet indisponible pour cette notion');
  }

  if (
    error instanceof Error &&
    (error.message === 'Course not found' ||
      error.message === 'Course subject not found' ||
      error.message === 'Deep revision session not found' ||
      error.message === 'Deep revision result not found')
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
