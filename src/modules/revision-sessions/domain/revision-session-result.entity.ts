import type { RevisionSessionModeValue } from './revision-session.entity';

export type RevisionSessionResultKnowledgeUnitState = 'MASTERED' | 'TO_REVIEW';

export interface RevisionSessionResultDto {
  session: {
    id: string;
    subjectId: string;
    courseId: string | null;
    mode: RevisionSessionModeValue;
    status: 'COMPLETED';
    createdAt: Date;
    completedAt: Date;
  };
  summary: {
    correctAnswers: number;
    totalQuestions: number;
    score: number;
    durationSeconds: number;
  };
  knowledgeUnits: RevisionSessionKnowledgeUnitResultDto[];
}

export interface RevisionSessionKnowledgeUnitResultDto {
  knowledgeUnitId: string;
  title: string;
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  state: RevisionSessionResultKnowledgeUnitState;
}

export function revisionSessionResultStateForScore(
  score: number,
): RevisionSessionResultKnowledgeUnitState {
  return score >= 0.8 ? 'MASTERED' : 'TO_REVIEW';
}
