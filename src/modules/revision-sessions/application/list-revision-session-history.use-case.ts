import { Inject, Injectable } from '@nestjs/common';
import type { RevisionSessionHistoryResponseDto } from '../domain/revision-session-result.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 50;

@Injectable()
export class ListCourseRevisionSessionHistoryUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    limit?: number;
  }): Promise<RevisionSessionHistoryResponseDto> {
    return this.revisionSessionsRepository.findCompletedCourseSessionsForStudent(
      {
        studentId: validateRequiredId(input.studentId, 'Student id'),
        courseId: validateRequiredId(input.courseId, 'Course id'),
        limit: normalizeLimit(input.limit),
      },
    );
  }
}

@Injectable()
export class ListRevisionSessionHistoryUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    limit?: number;
  }): Promise<RevisionSessionHistoryResponseDto> {
    return this.revisionSessionsRepository.findCompletedSessionsForStudent({
      studentId: validateRequiredId(input.studentId, 'Student id'),
      limit: normalizeLimit(input.limit),
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

function normalizeLimit(input: number | undefined): number {
  if (input === undefined) {
    return DEFAULT_HISTORY_LIMIT;
  }

  if (!Number.isInteger(input) || input < 1 || input > MAX_HISTORY_LIMIT) {
    throw new Error('History limit invalid');
  }

  return input;
}
