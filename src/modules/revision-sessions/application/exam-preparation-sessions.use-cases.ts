import { Inject, Injectable } from '@nestjs/common';
import { SubmitActivityResultUseCase } from '../../activities/application/submit-activity-result.use-case';
import type { RevisionSessionHistoryResponseDto } from '../domain/revision-session-result.entity';
import type {
  RevisionSessionResponseDto,
  RevisionSessionActionDto,
} from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

export interface ExamPreparationAnswerInput {
  questionId: string;
  choiceId?: string;
  choiceIds?: string[];
}

const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 50;

@Injectable()
export class GetExamPreparationSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const session = await this.revisionSessionsRepository.findByIdForStudent({
      studentId: validateRequiredId(input.studentId, 'Student id'),
      sessionId: validateRequiredId(input.sessionId, 'Revision session id'),
    });

    assertExamSession(session);
    return session;
  }
}

@Injectable()
export class SubmitExamPreparationSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    private readonly submitActivityResult: SubmitActivityResultUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
    answers: ExamPreparationAnswerInput[];
  }) {
    const studentId = validateRequiredId(input.studentId, 'Student id');
    const sessionId = validateRequiredId(
      input.sessionId,
      'Revision session id',
    );
    const session = await this.revisionSessionsRepository.findByIdForStudent({
      studentId,
      sessionId,
    });

    assertExamSession(session);
    if (session.session.status !== 'STARTED') {
      throw new Error('Exam preparation session already completed');
    }

    const activitySessionId = resolveExamActivitySessionId(
      session.currentAction,
    );

    await this.submitActivityResult.execute({
      studentId,
      sessionId: activitySessionId,
      answers: input.answers,
    });

    return this.revisionSessionsRepository.completeExamSession({
      studentId,
      sessionId,
      completedAt: new Date(),
    });
  }
}

@Injectable()
export class GetExamPreparationSessionResultUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  async execute(input: { studentId: string; sessionId: string }) {
    const result =
      await this.revisionSessionsRepository.findResultByIdForStudent({
        studentId: validateRequiredId(input.studentId, 'Student id'),
        sessionId: validateRequiredId(input.sessionId, 'Revision session id'),
      });

    if (result.session.mode !== 'EXAM') {
      throw new Error('Exam preparation session not found');
    }

    return result;
  }
}

@Injectable()
export class ListCourseExamPreparationSessionHistoryUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  execute(input: {
    studentId: string;
    courseId: string;
    limit?: number;
  }): Promise<RevisionSessionHistoryResponseDto> {
    return this.revisionSessionsRepository.findCompletedCourseExamSessionsForStudent(
      {
        studentId: validateRequiredId(input.studentId, 'Student id'),
        courseId: validateRequiredId(input.courseId, 'Course id'),
        limit: normalizeLimit(input.limit),
      },
    );
  }
}

function assertExamSession(session: RevisionSessionResponseDto): void {
  if (session.session.mode !== 'EXAM') {
    throw new Error('Exam preparation session not found');
  }
}

function resolveExamActivitySessionId(
  action: RevisionSessionActionDto | null,
): string {
  if (
    !action ||
    action.kind !== 'DIAGNOSTIC_QUIZ' ||
    !action.activitySessionId
  ) {
    throw new Error('Exam preparation session not ready');
  }

  return action.activitySessionId;
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
