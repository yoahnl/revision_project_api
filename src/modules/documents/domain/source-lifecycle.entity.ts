import type { DocumentStatus } from './document.entity';

export type SourceLifecycleStatus = 'ACTIVE' | 'ARCHIVED';

export type SourceLifecycleRecommendedAction = 'DELETE' | 'ARCHIVE' | 'BLOCK';

export type SourceLifecycleReason =
  | 'ALREADY_ARCHIVED'
  | 'SOURCE_PROCESSING'
  | 'HAS_DOCUMENT_CHUNKS'
  | 'HAS_KNOWLEDGE_UNITS'
  | 'HAS_SUMMARY'
  | 'HAS_REVISION_SHEET'
  | 'HAS_QUESTION_BANK_ITEMS'
  | 'HAS_REVISION_SESSIONS'
  | 'HAS_REVISION_SESSION_ACTIONS'
  | 'HAS_OPEN_QUESTIONS'
  | 'HAS_ACTIVITY_SESSIONS'
  | 'HAS_QUESTIONS'
  | 'HAS_RICH_CLOSED_PAYLOADS';

export interface SourceLifecycleDecision {
  documentId: string;
  courseId: string | null;
  status: SourceLifecycleStatus;
  recommendedAction: SourceLifecycleRecommendedAction;
  canDelete: boolean;
  canArchive: boolean;
  blockingReasons: SourceLifecycleReason[];
  userMessage: string;
}

export interface SourceLifecycleInput {
  documentId: string;
  courseId: string | null;
  status: DocumentStatus;
  archivedAt: Date | null;
  dependencyCounts: Partial<Record<SourceLifecycleReason, number>>;
}

export class SourceDeleteBlockedError extends Error {
  readonly code = 'SOURCE_DELETE_BLOCKED';

  constructor(readonly decision: SourceLifecycleDecision) {
    super(decision.userMessage);
  }
}

export class SourceArchiveBlockedError extends Error {
  readonly code = 'SOURCE_ARCHIVE_BLOCKED';

  constructor(readonly decision: SourceLifecycleDecision) {
    super(decision.userMessage);
  }
}

export function buildSourceLifecycleDecision(
  input: SourceLifecycleInput,
): SourceLifecycleDecision {
  if (input.archivedAt) {
    return {
      documentId: input.documentId,
      courseId: input.courseId,
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
      userMessage: 'Cette source est deja archivee.',
    };
  }

  if (input.status === 'UPLOADED' || input.status === 'PROCESSING') {
    return {
      documentId: input.documentId,
      courseId: input.courseId,
      status: 'ACTIVE',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['SOURCE_PROCESSING'],
      userMessage:
        "Cette source est encore en cours d'analyse. Reessaie quand l'analyse sera terminee.",
    };
  }

  const reasons = usedSourceReasons(input.dependencyCounts);

  if (reasons.length > 0) {
    return {
      documentId: input.documentId,
      courseId: input.courseId,
      status: 'ACTIVE',
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      blockingReasons: reasons,
      userMessage:
        "Cette source a deja servi a construire ton cours. Elle peut etre archivee, mais pas supprimee sans perdre l'historique.",
    };
  }

  return {
    documentId: input.documentId,
    courseId: input.courseId,
    status: 'ACTIVE',
    recommendedAction: 'DELETE',
    canDelete: true,
    canArchive: true,
    blockingReasons: [],
    userMessage:
      "Cette source n'a pas encore servi a construire un historique. Elle peut etre supprimee.",
  };
}

function usedSourceReasons(
  dependencyCounts: Partial<Record<SourceLifecycleReason, number>>,
): SourceLifecycleReason[] {
  const reasons: SourceLifecycleReason[] = [
    'HAS_DOCUMENT_CHUNKS',
    'HAS_KNOWLEDGE_UNITS',
    'HAS_SUMMARY',
    'HAS_REVISION_SHEET',
    'HAS_QUESTION_BANK_ITEMS',
    'HAS_REVISION_SESSIONS',
    'HAS_REVISION_SESSION_ACTIONS',
    'HAS_OPEN_QUESTIONS',
    'HAS_ACTIVITY_SESSIONS',
    'HAS_QUESTIONS',
    'HAS_RICH_CLOSED_PAYLOADS',
  ];

  return reasons.filter((reason) => (dependencyCounts[reason] ?? 0) > 0);
}
