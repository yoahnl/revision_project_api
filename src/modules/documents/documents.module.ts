import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { DOCUMENT_FILE_STORAGE } from './application/document-file-storage';
import { DOCUMENTS_REPOSITORY } from './application/documents.repository';
import { GetDocumentUseCase } from './application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from './application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from './application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from './application/register-document.use-case';
import { UploadCoursePdfUseCase } from './application/upload-course-pdf.use-case';
import { LocalDocumentFileStorage } from './infrastructure/local-document-file-storage';
import { PrismaDocumentsRepository } from './infrastructure/prisma-documents.repository';
import { DocumentsController } from './interfaces/documents.controller';

@Module({
  imports: [AuthModule, JobsModule, PrismaModule],
  controllers: [DocumentsController],
  providers: [
    GetDocumentUseCase,
    ListDocumentKnowledgeUnitsUseCase,
    ListSubjectDocumentsUseCase,
    RegisterDocumentUseCase,
    UploadCoursePdfUseCase,
    {
      provide: DOCUMENTS_REPOSITORY,
      useClass: PrismaDocumentsRepository,
    },
    {
      provide: DOCUMENT_FILE_STORAGE,
      useClass: LocalDocumentFileStorage,
    },
  ],
})
export class DocumentsModule {}
