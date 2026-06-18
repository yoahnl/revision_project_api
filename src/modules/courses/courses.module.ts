import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './application/list-subject-courses-with-stats.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';
import { CoursesController } from './interfaces/courses.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CoursesController],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}
