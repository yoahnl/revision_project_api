export type CourseLifecycleStatus = 'ACTIVE' | 'ARCHIVED';
export type CourseLifecycleRecommendedAction = 'DELETE' | 'ARCHIVE' | 'BLOCK';

export type CourseLifecycleBlockingReason =
  | 'ALREADY_ARCHIVED'
  | 'HAS_DOCUMENTS'
  | 'HAS_PROCESSING_DOCUMENTS'
  | 'HAS_REVISION_SESSIONS'
  | 'HAS_QUESTION_BANK_ITEMS';

export type CourseLifecycleDependencyCounts = {
  documents: number;
  processingDocuments: number;
  revisionSessions: number;
  questionBankItems: number;
};

export type CourseLifecycleDecision = {
  courseId: string;
  status: CourseLifecycleStatus;
  recommendedAction: CourseLifecycleRecommendedAction;
  canDelete: boolean;
  canArchive: boolean;
  canUpdate: boolean;
  blockingReasons: CourseLifecycleBlockingReason[];
  userMessage: string;
};

export class CourseDeleteBlockedError extends Error {
  readonly code = 'COURSE_DELETE_BLOCKED';
  readonly statusCode = 409;

  constructor(readonly decision: CourseLifecycleDecision) {
    super(decision.userMessage);
  }
}

export class CourseArchiveBlockedError extends Error {
  readonly code = 'COURSE_ARCHIVE_BLOCKED';
  readonly statusCode = 409;

  constructor(readonly decision: CourseLifecycleDecision) {
    super(decision.userMessage);
  }
}

export function buildCourseLifecycleDecision(input: {
  courseId: string;
  archivedAt: Date | null;
  dependencyCounts: CourseLifecycleDependencyCounts;
}): CourseLifecycleDecision {
  if (input.archivedAt) {
    return {
      courseId: input.courseId,
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      canUpdate: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
      userMessage: 'Ce cours est déjà archivé.',
    };
  }

  const reasons = courseDependencyReasons(input.dependencyCounts);

  if (reasons.includes('HAS_PROCESSING_DOCUMENTS')) {
    return {
      courseId: input.courseId,
      status: 'ACTIVE',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      canUpdate: true,
      blockingReasons: reasons,
      userMessage:
        'Ce cours contient une source en analyse. Réessaie quand elle sera prête.',
    };
  }

  if (reasons.length > 0) {
    return {
      courseId: input.courseId,
      status: 'ACTIVE',
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      canUpdate: true,
      blockingReasons: reasons,
      userMessage:
        'Ce cours contient déjà des sources ou des révisions. Archive-le plutôt que le supprimer.',
    };
  }

  return {
    courseId: input.courseId,
    status: 'ACTIVE',
    recommendedAction: 'DELETE',
    canDelete: true,
    canArchive: false,
    canUpdate: true,
    blockingReasons: [],
    userMessage:
      'Ce cours ne contient encore aucune source ni révision. Il peut être supprimé.',
  };
}

function courseDependencyReasons(
  counts: CourseLifecycleDependencyCounts,
): CourseLifecycleBlockingReason[] {
  const reasons: CourseLifecycleBlockingReason[] = [];

  if (counts.documents > 0) {
    reasons.push('HAS_DOCUMENTS');
  }
  if (counts.processingDocuments > 0) {
    reasons.push('HAS_PROCESSING_DOCUMENTS');
  }
  if (counts.revisionSessions > 0) {
    reasons.push('HAS_REVISION_SESSIONS');
  }
  if (counts.questionBankItems > 0) {
    reasons.push('HAS_QUESTION_BANK_ITEMS');
  }

  return reasons;
}
