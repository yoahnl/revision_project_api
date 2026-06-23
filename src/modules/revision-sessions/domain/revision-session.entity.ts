import type {
  DiagnosticQuizActivity,
  OpenQuestionActivity,
} from '../../activities/application/activities.repository';

export type RevisionSessionStatusValue = 'STARTED' | 'COMPLETED' | 'ABANDONED';

export type RevisionSessionModeValue = 'QUICK' | 'DEEP' | 'EXAM';

export type RevisionSessionActionKindValue =
  | 'DIAGNOSTIC_QUIZ'
  | 'OPEN_QUESTION'
  | 'RICH_CLOSED_EXERCISE';

export type RevisionSessionActionStatusValue = 'READY' | 'COMPLETED' | 'FAILED';

export type RevisionSessionPreferredAction =
  | 'diagnostic_quiz'
  | 'open_question'
  | 'rich_closed_exercise';

export interface RevisionSessionRichClosedExercisePayload {
  type: 'rich_closed_exercise';
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle?: string | null;
  reason: string;
  estimatedMinutes: number;
  preferredAction: 'rich_closed_exercise';
}

export type RevisionSessionActionPayload =
  | DiagnosticQuizActivity
  | OpenQuestionActivity
  | RevisionSessionRichClosedExercisePayload
  | {
      type: 'diagnostic_quiz' | 'open_question';
      sessionId: string | null;
    }
  | null;

export interface RevisionSessionDto {
  id: string;
  status: RevisionSessionStatusValue;
  subjectId: string;
  courseId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  mode: RevisionSessionModeValue;
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

export interface RevisionSessionDraftAnswerDto {
  questionId: string;
  selectedChoiceIds: string[];
  updatedAt: Date;
}

export interface RevisionSessionResponseDto {
  session: RevisionSessionDto;
  currentAction: RevisionSessionCurrentActionDto | null;
  history: RevisionSessionActionDto[];
  draftAnswers: RevisionSessionDraftAnswerDto[];
}

export interface ResumableCourseRevisionSessionDto {
  session: RevisionSessionDto;
  currentAction: RevisionSessionActionDto | null;
  progress: {
    answeredQuestionCount: number;
    totalQuestionCount: number;
  };
  userMessage: string;
}
