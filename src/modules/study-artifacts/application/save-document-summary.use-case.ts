import { Inject, Injectable } from '@nestjs/common';
import { STUDY_ARTIFACTS_REPOSITORY } from './study-artifacts.repository';
import type {
  FailedSummaryInput,
  ReadySummaryInput,
  StudyArtifactsRepository,
} from './study-artifacts.repository';

@Injectable()
export class SaveDocumentSummaryUseCase {
  constructor(
    @Inject(STUDY_ARTIFACTS_REPOSITORY)
    private readonly repository: StudyArtifactsRepository,
  ) {}

  saveReady(input: ReadySummaryInput) {
    return this.repository.saveReadySummary(input);
  }

  saveFailed(input: FailedSummaryInput) {
    return this.repository.saveFailedSummary(input);
  }
}
