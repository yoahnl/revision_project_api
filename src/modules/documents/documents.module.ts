import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { DOCUMENTS_REPOSITORY } from './application/documents.repository';
import { GetDocumentUseCase } from './application/get-document.use-case';
import { ListSubjectDocumentsUseCase } from './application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from './application/register-document.use-case';
import { PrismaDocumentsRepository } from './infrastructure/prisma-documents.repository';
import { DocumentsController } from './interfaces/documents.controller';

@Module({
  imports: [AuthModule, JobsModule, PrismaModule],
  controllers: [DocumentsController],
  providers: [
    GetDocumentUseCase,
    ListSubjectDocumentsUseCase,
    RegisterDocumentUseCase,
    {
      provide: DOCUMENTS_REPOSITORY,
      useClass: PrismaDocumentsRepository,
    },
  ],
})
export class DocumentsModule {}
