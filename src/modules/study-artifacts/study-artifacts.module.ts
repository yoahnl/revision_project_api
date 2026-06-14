import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { GetDocumentSummaryUseCase } from './application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from './application/get-revision-sheet.use-case';
import { SaveDocumentSummaryUseCase } from './application/save-document-summary.use-case';
import { SaveRevisionSheetUseCase } from './application/save-revision-sheet.use-case';
import { STUDY_ARTIFACTS_REPOSITORY } from './application/study-artifacts.repository';
import { PrismaStudyArtifactsRepository } from './infrastructure/prisma-study-artifacts.repository';

@Module({
  imports: [PrismaModule],
  providers: [
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
    GetDocumentSummaryUseCase,
    SaveDocumentSummaryUseCase,
    GetRevisionSheetUseCase,
    SaveRevisionSheetUseCase,
  ],
})
export class StudyArtifactsModule {}
