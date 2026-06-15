import type {
  DiagnosticQuizActivity,
  OpenQuestionActivity,
} from '../../activities/application/activities.repository';

export type RevisionSessionStatusValue = 'STARTED' | 'COMPLETED' | 'ABANDONED';

export type RevisionSessionActionKindValue =
  | 'DIAGNOSTIC_QUIZ'
  | 'OPEN_QUESTION';

export type RevisionSessionActionStatusValue = 'READY' | 'COMPLETED' | 'FAILED';

export type RevisionSessionPreferredAction =
  | 'diagnostic_quiz'
  | 'open_question';

export type RevisionSessionActionPayload =
  | DiagnosticQuizActivity
  | OpenQuestionActivity
  | {
      type: 'diagnostic_quiz' | 'open_question';
      sessionId: string | null;
    }
  | null;

export interface RevisionSessionDto {
  id: string;
  status: RevisionSessionStatusValue;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface RevisionSessionActionDto {
  id: string;
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
}

export interface RevisionSessionCurrentActionDto extends RevisionSessionActionDto {
  payload: RevisionSessionActionPayload;
}

export interface RevisionSessionResponseDto {
  session: RevisionSessionDto;
  currentAction: RevisionSessionCurrentActionDto | null;
  history: RevisionSessionActionDto[];
}
