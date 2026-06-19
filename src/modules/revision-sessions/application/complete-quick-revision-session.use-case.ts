import { Inject, Injectable } from '@nestjs/common';
import type { RevisionSessionResultDto } from '../domain/revision-session-result.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class CompleteQuickRevisionSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResultDto> {
    const studentId = validateRequiredId(input.studentId, 'Student id');
    const sessionId = validateRequiredId(
      input.sessionId,
      'Revision session id',
    );

    return this.revisionSessionsRepository.completeQuickSession({
      studentId,
      sessionId,
      completedAt: new Date(),
    });
  }
}

function validateRequiredId(input: string, label: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  return trimmed;
}
