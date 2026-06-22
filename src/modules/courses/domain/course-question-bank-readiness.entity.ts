export type CourseQuestionBankReadinessStatus =
  | 'NO_READY_SOURCE'
  | 'NO_KNOWLEDGE_UNITS'
  | 'NOT_PREPARED'
  | 'PREPARING'
  | 'READY'
  | 'FAILED';

export interface CourseQuestionBankReadiness {
  courseId: string;
  status: CourseQuestionBankReadinessStatus;
  readyQuestionCount: number;
  targetQuestionCount: number;
  canStartQuickRevision: boolean;
  canPrepare: boolean;
  userMessage: string;
}

export function buildCourseQuestionBankReadiness(input: {
  courseId: string;
  status: CourseQuestionBankReadinessStatus;
  readyQuestionCount: number;
  targetQuestionCount: number;
}): CourseQuestionBankReadiness {
  return {
    courseId: input.courseId,
    status: input.status,
    readyQuestionCount: input.readyQuestionCount,
    targetQuestionCount: input.targetQuestionCount,
    canStartQuickRevision: input.status === 'READY',
    canPrepare: input.status === 'NOT_PREPARED' || input.status === 'FAILED',
    userMessage: readinessUserMessage(input.status),
  };
}

function readinessUserMessage(
  status: CourseQuestionBankReadinessStatus,
): string {
  if (status === 'NO_READY_SOURCE') {
    return 'Ajoute une source prête avant de lancer la révision rapide.';
  }

  if (status === 'NO_KNOWLEDGE_UNITS') {
    return "Aucune notion exploitable n'a encore été trouvée pour ce cours.";
  }

  if (status === 'PREPARING') {
    return 'Les questions sont en préparation. Réessaie dans un instant.';
  }

  if (status === 'READY') {
    return 'Les questions sont prêtes.';
  }

  if (status === 'FAILED') {
    return "Les questions n'ont pas pu être préparées pour le moment.";
  }

  return 'Les questions doivent être préparées avant de commencer.';
}
