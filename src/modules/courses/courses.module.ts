import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    GetCourseUseCase,
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
    GetCourseUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}
