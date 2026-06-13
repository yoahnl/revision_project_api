import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { BootstrapStudentUseCase } from './application/bootstrap-student.use-case';
import { STUDENTS_REPOSITORY } from './application/students.repository';
import { PrismaStudentsRepository } from './infrastructure/prisma-students.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    BootstrapStudentUseCase,
    {
      provide: STUDENTS_REPOSITORY,
      useClass: PrismaStudentsRepository,
    },
  ],
  exports: [BootstrapStudentUseCase],
})
export class StudentsModule {}
