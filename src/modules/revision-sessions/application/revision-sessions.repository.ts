import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../domain/revision-session.entity';

export const REVISION_SESSIONS_REPOSITORY = Symbol(
  'REVISION_SESSIONS_REPOSITORY',
);

export interface RevisionSessionStartContext {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  knowledgeUnitTitle: string | null;
}

export interface RevisionSessionAllowedKnowledgeUnit {
  id: string;
  documentId: string | null;
  title: string | null;
}

export interface RevisionSessionPlanningContext {
  session: {
    id: string;
    status: RevisionSessionStatusValue;
    subjectId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
  };
  actions: Array<{
    kind: RevisionSessionActionKindValue;
    status: RevisionSessionActionStatusValue;
    displayOrder: number;
    activitySessionId: string | null;
    knowledgeUnitId: string | null;
  }>;
  allowedKnowledgeUnitIds: string[];
  allowedKnowledgeUnits: RevisionSessionAllowedKnowledgeUnit[];
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

  findPlanningContextByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionPlanningContext>;

  appendAction(input: {
    studentId: string;
    sessionId: string;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto>;
}
