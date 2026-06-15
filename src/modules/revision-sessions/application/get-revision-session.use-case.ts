import { Inject, Injectable } from '@nestjs/common';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class GetRevisionSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    return this.revisionSessionsRepository.findByIdForStudent(input);
  }
}
