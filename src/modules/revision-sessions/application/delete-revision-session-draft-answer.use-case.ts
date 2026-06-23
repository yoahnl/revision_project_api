import { Inject, Injectable } from '@nestjs/common';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class DeleteRevisionSessionDraftAnswerUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  execute(input: {
    studentId: string;
    sessionId: string;
    questionId: string;
  }): Promise<RevisionSessionResponseDto> {
    return this.revisionSessionsRepository.deleteDraftAnswer({
      studentId: validateRequiredId(input.studentId, 'Student id'),
      sessionId: validateRequiredId(input.sessionId, 'Revision session id'),
      questionId: validateRequiredId(input.questionId, 'Question id'),
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
