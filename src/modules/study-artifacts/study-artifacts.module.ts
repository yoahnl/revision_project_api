import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { GenerateDocumentSummaryUseCase } from './application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from './application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from './application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from './application/get-revision-sheet.use-case';
import { SaveDocumentSummaryUseCase } from './application/save-document-summary.use-case';
import { SaveRevisionSheetUseCase } from './application/save-revision-sheet.use-case';
import { STUDY_ARTIFACTS_REPOSITORY } from './application/study-artifacts.repository';
import { PrismaStudyArtifactsRepository } from './infrastructure/prisma-study-artifacts.repository';
import { StudyArtifactsController } from './interfaces/study-artifacts.controller';

@Module({
  imports: [AiModule, AuthModule, DocumentsModule, PrismaModule],
  controllers: [StudyArtifactsController],
  providers: [
    GenerateDocumentSummaryUseCase,
    GenerateRevisionSheetUseCase,
    GetDocumentSummaryUseCase,
    SaveDocumentSummaryUseCase,
    GetRevisionSheetUseCase,
    SaveRevisionSheetUseCase,
    {
      provide: STUDY_ARTIFACTS_REPOSITORY,
      useClass: PrismaStudyArtifactsRepository,
    },
  ],
  exports: [
    GenerateDocumentSummaryUseCase,
    GenerateRevisionSheetUseCase,
    GetDocumentSummaryUseCase,
    SaveDocumentSummaryUseCase,
    GetRevisionSheetUseCase,
    SaveRevisionSheetUseCase,
  ],
})
export class StudyArtifactsModule {}
