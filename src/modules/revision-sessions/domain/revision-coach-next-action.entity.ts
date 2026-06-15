import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
} from './revision-session.entity';

export type RevisionCoachNextActionKind = RevisionSessionActionKindValue;

export type RevisionCoachNextActionReasonCode =
  | 'ALTERNATE_ACTIVITY_TYPE'
  | 'REINFORCE_CURRENT_KNOWLEDGE_UNIT'
  | 'CHECK_UNDERSTANDING'
  | 'CONTINUE_SESSION_DEFAULT';

export interface RevisionCoachNextActionHistoryItem {
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  knowledgeUnitId: string | null;
}

export interface RevisionCoachNextActionInput {
  studentId: string;
  sessionId: string;
  subjectId: string;
  documentId: string | null;
  sessionKnowledgeUnitId: string | null;
  history: RevisionCoachNextActionHistoryItem[];
  availableActions: RevisionCoachNextActionKind[];
  allowedKnowledgeUnitIds: string[];
}

export interface RevisionCoachNextActionDecision {
  actionKind: RevisionCoachNextActionKind;
  knowledgeUnitId: string | null;
  reasonCode: RevisionCoachNextActionReasonCode;
}
