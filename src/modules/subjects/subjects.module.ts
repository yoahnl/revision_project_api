import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { ArchiveSubjectUseCase } from './application/archive-subject.use-case';
import { CreateSubjectUseCase } from './application/create-subject.use-case';
import { DeleteSubjectUseCase } from './application/delete-subject.use-case';
import { GetSubjectLifecycleUseCase } from './application/get-subject-lifecycle.use-case';
import { GetSubjectUseCase } from './application/get-subject.use-case';
import { ListSubjectsUseCase } from './application/list-subjects.use-case';
import { SUBJECTS_REPOSITORY } from './application/subjects.repository';
import { UpdateSubjectUseCase } from './application/update-subject.use-case';
import { PrismaSubjectsRepository } from './infrastructure/prisma-subjects.repository';
import { SubjectsController } from './interfaces/subjects.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SubjectsController],
  providers: [
    CreateSubjectUseCase,
    DeleteSubjectUseCase,
    GetSubjectUseCase,
    GetSubjectLifecycleUseCase,
    UpdateSubjectUseCase,
    ArchiveSubjectUseCase,
    ListSubjectsUseCase,
    {
      provide: SUBJECTS_REPOSITORY,
      useClass: PrismaSubjectsRepository,
    },
  ],
})
export class SubjectsModule {}
