import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CreateSubjectUseCase } from './application/create-subject.use-case';
import { DeleteSubjectUseCase } from './application/delete-subject.use-case';
import { GetSubjectUseCase } from './application/get-subject.use-case';
import { ListSubjectsUseCase } from './application/list-subjects.use-case';
import { SUBJECTS_REPOSITORY } from './application/subjects.repository';
import { PrismaSubjectsRepository } from './infrastructure/prisma-subjects.repository';
import { SubjectsController } from './interfaces/subjects.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SubjectsController],
  providers: [
    CreateSubjectUseCase,
    DeleteSubjectUseCase,
    GetSubjectUseCase,
    ListSubjectsUseCase,
    {
      provide: SUBJECTS_REPOSITORY,
      useClass: PrismaSubjectsRepository,
    },
  ],
})
export class SubjectsModule {}
