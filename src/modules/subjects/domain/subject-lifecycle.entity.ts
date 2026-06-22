export type SubjectLifecycleStatus = 'ACTIVE' | 'ARCHIVED';
export type SubjectLifecycleRecommendedAction = 'DELETE' | 'ARCHIVE' | 'BLOCK';

export type SubjectLifecycleBlockingReason =
  | 'ALREADY_ARCHIVED'
  | 'HAS_COURSES'
  | 'HAS_DOCUMENTS'
  | 'HAS_PROCESSING_DOCUMENTS'
  | 'HAS_KNOWLEDGE_UNITS'
  | 'HAS_MASTERY'
  | 'HAS_ACTIVITY_SESSIONS'
  | 'HAS_REVISION_SESSIONS'
  | 'HAS_SUMMARIES'
  | 'HAS_REVISION_SHEETS'
  | 'HAS_OPEN_QUESTIONS'
  | 'HAS_OPEN_ANSWER_EVALUATIONS'
  | 'HAS_QUESTION_BANK_ITEMS';

export type SubjectLifecycleDependencyCounts = {
  courses: number;
  documents: number;
  processingDocuments: number;
  knowledgeUnits: number;
  masteryStates: number;
  activitySessions: number;
  revisionSessions: number;
  summaries: number;
  revisionSheets: number;
  openQuestions: number;
  openAnswerEvaluations: number;
  questionBankItems: number;
};

export type SubjectLifecycleDecision = {
  subjectId: string;
  status: SubjectLifecycleStatus;
  recommendedAction: SubjectLifecycleRecommendedAction;
  canDelete: boolean;
  canArchive: boolean;
  canUpdate: boolean;
  blockingReasons: SubjectLifecycleBlockingReason[];
  userMessage: string;
};

export class SubjectDeleteBlockedError extends Error {
  readonly code = 'SUBJECT_DELETE_BLOCKED';
  readonly statusCode = 409;

  constructor(readonly decision: SubjectLifecycleDecision) {
    super(decision.userMessage);
  }
}

export class SubjectArchiveBlockedError extends Error {
  readonly code = 'SUBJECT_ARCHIVE_BLOCKED';
  readonly statusCode = 409;

  constructor(readonly decision: SubjectLifecycleDecision) {
    super(decision.userMessage);
  }
}

export function buildSubjectLifecycleDecision(input: {
  subjectId: string;
  archivedAt: Date | null;
  dependencyCounts: SubjectLifecycleDependencyCounts;
}): SubjectLifecycleDecision {
  if (input.archivedAt) {
    return {
      subjectId: input.subjectId,
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      canUpdate: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
      userMessage: 'Cette matière est déjà archivée.',
    };
  }

  const reasons = subjectDependencyReasons(input.dependencyCounts);

  if (reasons.includes('HAS_PROCESSING_DOCUMENTS')) {
    return {
      subjectId: input.subjectId,
      status: 'ACTIVE',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      canUpdate: true,
      blockingReasons: reasons,
      userMessage:
        'Cette matière contient une source en analyse. Réessaie quand elle sera prête.',
    };
  }

  if (reasons.length > 0) {
    return {
      subjectId: input.subjectId,
      status: 'ACTIVE',
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      canUpdate: true,
      blockingReasons: reasons,
      userMessage:
        'Cette matière contient déjà des cours ou des révisions. Archive-la plutôt que la supprimer.',
    };
  }

  return {
    subjectId: input.subjectId,
    status: 'ACTIVE',
    recommendedAction: 'DELETE',
    canDelete: true,
    canArchive: false,
    canUpdate: true,
    blockingReasons: [],
    userMessage:
      'Cette matière ne contient encore aucun cours ni historique. Elle peut être supprimée.',
  };
}

function subjectDependencyReasons(
  counts: SubjectLifecycleDependencyCounts,
): SubjectLifecycleBlockingReason[] {
  const reasons: SubjectLifecycleBlockingReason[] = [];

  if (counts.courses > 0) {
    reasons.push('HAS_COURSES');
  }
  if (counts.documents > 0) {
    reasons.push('HAS_DOCUMENTS');
  }
  if (counts.processingDocuments > 0) {
    reasons.push('HAS_PROCESSING_DOCUMENTS');
  }
  if (counts.knowledgeUnits > 0) {
    reasons.push('HAS_KNOWLEDGE_UNITS');
  }
  if (counts.masteryStates > 0) {
    reasons.push('HAS_MASTERY');
  }
  if (counts.activitySessions > 0) {
    reasons.push('HAS_ACTIVITY_SESSIONS');
  }
  if (counts.revisionSessions > 0) {
    reasons.push('HAS_REVISION_SESSIONS');
  }
  if (counts.summaries > 0) {
    reasons.push('HAS_SUMMARIES');
  }
  if (counts.revisionSheets > 0) {
    reasons.push('HAS_REVISION_SHEETS');
  }
  if (counts.openQuestions > 0) {
    reasons.push('HAS_OPEN_QUESTIONS');
  }
  if (counts.openAnswerEvaluations > 0) {
    reasons.push('HAS_OPEN_ANSWER_EVALUATIONS');
  }
  if (counts.questionBankItems > 0) {
    reasons.push('HAS_QUESTION_BANK_ITEMS');
  }

  return reasons;
}
