import { Inject, Injectable } from '@nestjs/common';
import type { ResumableCourseRevisionSessionDto } from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class GetResumableCourseRevisionSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
  ) {}

  execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<ResumableCourseRevisionSessionDto | null> {
    return this.revisionSessionsRepository.findResumableCourseSessionForStudent(
      {
        studentId: validateRequiredId(input.studentId, 'Student id'),
        courseId: validateRequiredId(input.courseId, 'Course id'),
      },
    );
  }
}

function validateRequiredId(input: string, label: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  return trimmed;
}
