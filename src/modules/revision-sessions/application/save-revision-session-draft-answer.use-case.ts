import { Inject, Injectable } from '@nestjs/common';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class SaveRevisionSessionDraftAnswerUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  execute(input: {
    studentId: string;
    sessionId: string;
    questionId: string;
    selectedChoiceIds: string[];
  }): Promise<RevisionSessionResponseDto> {
    return this.revisionSessionsRepository.saveDraftAnswer({
      studentId: validateRequiredId(input.studentId, 'Student id'),
      sessionId: validateRequiredId(input.sessionId, 'Revision session id'),
      questionId: validateRequiredId(input.questionId, 'Question id'),
      selectedChoiceIds: normalizeChoiceIds(input.selectedChoiceIds),
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

function normalizeChoiceIds(input: string[]): string[] {
  const seen = new Set<string>();
  const values = input.map((choiceId) =>
    validateRequiredId(choiceId, 'Choice id'),
  );

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error('Revision session draft answer has duplicate choices');
    }
    seen.add(value);
  }

  return values;
}
