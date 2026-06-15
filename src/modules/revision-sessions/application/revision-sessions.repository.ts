import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionResponseDto,
} from '../domain/revision-session.entity';

export const REVISION_SESSIONS_REPOSITORY = Symbol(
  'REVISION_SESSIONS_REPOSITORY',
);

export interface RevisionSessionStartContext {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
}

export interface RevisionSessionsRepository {
  ensureStartContext(input: {
    studentId: string;
    subjectId: string;
    documentId?: string;
    knowledgeUnitId?: string;
  }): Promise<RevisionSessionStartContext>;

  createWithInitialAction(input: {
    studentId: string;
    subjectId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      displayOrder: number;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto>;

  findByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto>;
}
