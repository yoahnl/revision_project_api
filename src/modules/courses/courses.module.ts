import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { JobsModule } from '../jobs/jobs.module';
import { RevisionSessionsModule } from '../revision-sessions/revision-sessions.module';
import { StudyArtifactsModule } from '../study-artifacts/study-artifacts.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import { ArchiveCourseUseCase } from './application/archive-course.use-case';
import {
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from './application/course-revision-sheet.use-case';
import { COURSE_QUESTION_BANK_PREPARATION_REPOSITORY } from './application/course-question-bank-preparation.repository';
import {
  GetCourseQuestionBankReadinessUseCase,
  PrepareCourseQuestionBankUseCase,
} from './application/course-question-bank-readiness.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from './application/course-progress.use-case';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from './application/course-source-lifecycle.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseDocumentUseCase } from './application/delete-course-document.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
import { GetCourseLifecycleUseCase } from './application/get-course-lifecycle.use-case';
import { GetCourseExamPreparationOptionsUseCase } from './application/get-course-exam-preparation-options.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './application/list-subject-courses-with-stats.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { StartCourseExamPreparationSessionUseCase } from './application/start-course-exam-preparation-session.use-case';
import { StartCourseQuickRevisionSessionUseCase } from './application/start-course-quick-revision-session.use-case';
import { UpdateCourseUseCase } from './application/update-course.use-case';
import { UploadCoursePdfForCourseUseCase } from './application/upload-course-pdf-for-course.use-case';
import { PrismaCourseQuestionBankPreparationRepository } from './infrastructure/prisma-course-question-bank-preparation.repository';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';
import { CoursesController } from './interfaces/courses.controller';

@Module({
  imports: [
    ActivitiesModule,
    AuthModule,
    DocumentsModule,
    JobsModule,
    PrismaModule,
    RevisionSessionsModule,
    StudyArtifactsModule,
  ],
  controllers: [CoursesController],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    GetCourseLifecycleUseCase,
    GetCourseExamPreparationOptionsUseCase,
    UpdateCourseUseCase,
    ArchiveCourseUseCase,
    DeleteCourseUseCase,
    DeleteCourseDocumentUseCase,
    GetCourseSourceLifecycleUseCase,
    ArchiveCourseSourceUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    UploadCoursePdfForCourseUseCase,
    GetCourseRevisionSheetUseCase,
    GenerateCourseRevisionSheetUseCase,
    GetCourseQuestionBankReadinessUseCase,
    PrepareCourseQuestionBankUseCase,
    StartCourseExamPreparationSessionUseCase,
    StartCourseQuickRevisionSessionUseCase,
    GetCourseProgressUseCase,
    GetSubjectProgressUseCase,
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
    {
      provide: COURSE_QUESTION_BANK_PREPARATION_REPOSITORY,
      useClass: PrismaCourseQuestionBankPreparationRepository,
    },
  ],
  exports: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    GetCourseLifecycleUseCase,
    GetCourseExamPreparationOptionsUseCase,
    UpdateCourseUseCase,
    ArchiveCourseUseCase,
    DeleteCourseUseCase,
    DeleteCourseDocumentUseCase,
    GetCourseSourceLifecycleUseCase,
    ArchiveCourseSourceUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    UploadCoursePdfForCourseUseCase,
    GetCourseRevisionSheetUseCase,
    GenerateCourseRevisionSheetUseCase,
    GetCourseQuestionBankReadinessUseCase,
    PrepareCourseQuestionBankUseCase,
    StartCourseExamPreparationSessionUseCase,
    StartCourseQuickRevisionSessionUseCase,
    GetCourseProgressUseCase,
    GetSubjectProgressUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}
