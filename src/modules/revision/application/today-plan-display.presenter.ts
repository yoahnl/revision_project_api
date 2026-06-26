import {
  type RevisionPlanStartPayload,
  type TodayPlanActionType,
  type TodayPlanReasonCode,
} from '../domain/adaptive-plan.service';

export type TodayPlanItemRole = 'PRIMARY' | 'CONTINUATION';

export interface TodayPlanItemDisplayDto {
  title: string;
  subjectLabel: string;
  badgeLabel: string;
  durationLabel: string | null;
  metaLabel: string;
  recommendation: string;
  actionLabel: string;
  unavailableReason: string | null;
}

export interface TodayWeeklyObjectiveDto {
  targetMinutes: number;
  completedMinutes: number | null;
  progressRatio: number | null;
  label: string;
  status: 'TARGET_ONLY' | 'PROGRESS_AVAILABLE';
}

export interface TodayEmptyStateDto {
  title: string;
  message: string;
  actionLabel: string;
  actionKind: 'OPEN_COURSES';
}

export function resolveTodayPlanPrimaryItemId(
  items: readonly { id: string }[],
): string | null {
  return items[0]?.id ?? null;
}

export function resolveTodayPlanContinuationItemIds(
  items: readonly { id: string }[],
): string[] {
  return items.slice(1, 3).map((item) => item.id);
}

export function resolveTodayPlanItemRole(index: number): TodayPlanItemRole {
  return index === 0 ? 'PRIMARY' : 'CONTINUATION';
}

export function buildTodayPlanItemDisplay(input: {
  subjectId: string;
  subjectName: string;
  knowledgeUnitTitle: string | null;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  reasonCode: TodayPlanReasonCode;
  startPayload: RevisionPlanStartPayload;
  role: TodayPlanItemRole;
}): TodayPlanItemDisplayDto {
  const subjectLabel = cleanLabel(input.subjectName) ?? 'Matière';
  const durationLabel =
    input.estimatedMinutes > 0 ? `${input.estimatedMinutes} min` : null;
  const unavailableReason = resolveUnavailableReason(input);

  return {
    title:
      cleanLabel(input.knowledgeUnitTitle) ??
      cleanLabel(input.subjectName) ??
      'À travailler aujourd’hui',
    subjectLabel,
    badgeLabel: subjectLabel.toUpperCase(),
    durationLabel,
    metaLabel:
      durationLabel === null
        ? 'Session guidée'
        : `${durationLabel} · session guidée`,
    recommendation: resolveTodayPlanReason(input.reasonCode),
    actionLabel:
      unavailableReason === null
        ? resolveActionLabel(input.role)
        : 'Session indisponible',
    unavailableReason,
  };
}

export function resolveTodayPlanReason(
  reasonCode: TodayPlanReasonCode,
): string {
  const reasons: Record<TodayPlanReasonCode, string> = {
    LOW_MASTERY:
      'Cette notion semble fragile : la revoir maintenant aidera à consolider tes bases.',
    STALE_PRACTICE:
      'Tu ne l’as pas travaillée récemment. C’est un bon moment pour l’entretenir.',
    HIGH_PRIORITY_SUBJECT:
      'Cette matière est prioritaire dans ton plan de révision.',
    MIX_ACTIVITY_TYPE: 'Changer d’angle peut t’aider à mieux ancrer la notion.',
    RICH_CLOSED_PRACTICE:
      'Cette notion mérite une session cadrée avec feedback.',
    START_REVISION_SESSION:
      'Neralune a assez de contexte pour te guider sans te disperser.',
    CONTINUE_PROGRESS:
      'Tu as déjà commencé ici : reprendre maintenant garde l’élan.',
  };

  return reasons[reasonCode];
}

export function buildTodayWeeklyObjective(
  weeklyMinutes: number | null | undefined,
): TodayWeeklyObjectiveDto | null {
  if (
    typeof weeklyMinutes !== 'number' ||
    !Number.isInteger(weeklyMinutes) ||
    weeklyMinutes <= 0
  ) {
    return null;
  }

  return {
    targetMinutes: weeklyMinutes,
    completedMinutes: null,
    progressRatio: null,
    label: `Objectif : ${formatMinutes(weeklyMinutes)} cette semaine`,
    status: 'TARGET_ONLY',
  };
}

export function buildTodayEmptyState(): TodayEmptyStateDto {
  return {
    title: 'Rien de prêt pour aujourd’hui',
    message:
      'Ajoute un cours ou une source pour que Neralune prépare ta prochaine session.',
    actionLabel: 'Voir mes cours',
    actionKind: 'OPEN_COURSES',
  };
}

function resolveUnavailableReason(input: {
  subjectId: string;
  action: TodayPlanActionType;
  startPayload: RevisionPlanStartPayload;
}): string | null {
  if (!hasText(input.subjectId) || !hasText(input.startPayload.subjectId)) {
    return 'Cette action nécessite encore une matière prête.';
  }

  if (
    (input.action === 'open_question' ||
      input.action === 'rich_closed_exercise') &&
    !hasText(input.startPayload.knowledgeUnitId)
  ) {
    return 'Cette action nécessite encore une notion prête.';
  }

  return null;
}

function resolveActionLabel(role: TodayPlanItemRole): string {
  return role === 'PRIMARY' ? 'Réviser maintenant' : 'Continuer';
}

function cleanLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function hasText(value: string | null | undefined): boolean {
  return cleanLabel(value) !== null;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes}`;
}
