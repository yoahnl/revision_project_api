import { Inject, Injectable } from '@nestjs/common';
import { STUDY_ARTIFACTS_REPOSITORY } from './study-artifacts.repository';
import type {
  FailedRevisionSheetInput,
  ReadyRevisionSheetInput,
  StudyArtifactsRepository,
} from './study-artifacts.repository';

@Injectable()
export class SaveRevisionSheetUseCase {
  constructor(
    @Inject(STUDY_ARTIFACTS_REPOSITORY)
    private readonly repository: StudyArtifactsRepository,
  ) {}

  saveReady(input: ReadyRevisionSheetInput) {
    return this.repository.saveReadyRevisionSheet(input);
  }

  saveFailed(input: FailedRevisionSheetInput) {
    return this.repository.saveFailedRevisionSheet(input);
  }
}
