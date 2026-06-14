import { Inject, Injectable } from '@nestjs/common';
import { STUDY_ARTIFACTS_REPOSITORY } from './study-artifacts.repository';
import type {
  DocumentArtifactLookupInput,
  StudyArtifactsRepository,
} from './study-artifacts.repository';

@Injectable()
export class GetDocumentSummaryUseCase {
  constructor(
    @Inject(STUDY_ARTIFACTS_REPOSITORY)
    private readonly repository: StudyArtifactsRepository,
  ) {}

  execute(input: DocumentArtifactLookupInput) {
    return this.repository.findSummaryByDocumentForStudent(input);
  }
}
