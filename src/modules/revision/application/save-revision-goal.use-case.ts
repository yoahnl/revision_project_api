import { Inject, Injectable } from '@nestjs/common';
import { REVISION_REPOSITORY } from './revision.repository';
import type { RevisionRepository } from './revision.repository';

@Injectable()
export class SaveRevisionGoalUseCase {
  constructor(
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
  ) {}

  execute(input: {
    studentId: string;
    targetDate: Date;
    weeklyMinutes: number;
  }) {
    return this.revisionRepository.saveGoal(input);
  }
}
