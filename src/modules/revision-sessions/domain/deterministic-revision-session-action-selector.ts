import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from './revision-coach-next-action.entity';

export function selectDeterministicRevisionSessionAction(
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  const allowedKnowledgeUnitIds = [...input.allowedKnowledgeUnitIds];
  const availableActions = new Set(input.availableActions);
  const history = [...input.history].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const lastAction = history.at(-1);
  const reliableKnowledgeUnitId = findReliableKnowledgeUnitId({
    sessionKnowledgeUnitId: input.sessionKnowledgeUnitId,
    lastActionKnowledgeUnitId: lastAction?.knowledgeUnitId ?? null,
    allowedKnowledgeUnitIds,
  });
  const canOpenQuestion =
    availableActions.has('OPEN_QUESTION') && reliableKnowledgeUnitId !== null;
  const canDiagnosticQuiz = availableActions.has('DIAGNOSTIC_QUIZ');

  if (lastAction?.kind === 'DIAGNOSTIC_QUIZ' && canOpenQuestion) {
    return {
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: reliableKnowledgeUnitId,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    };
  }

  if (lastAction?.kind === 'OPEN_QUESTION' && canDiagnosticQuiz) {
    return {
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    };
  }

  if (canOpenQuestion) {
    return {
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: reliableKnowledgeUnitId,
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    };
  }

  if (canDiagnosticQuiz) {
    return {
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CONTINUE_SESSION_DEFAULT',
    };
  }

  throw new Error('Revision coach no action available');
}

function findReliableKnowledgeUnitId(input: {
  sessionKnowledgeUnitId: string | null;
  lastActionKnowledgeUnitId: string | null;
  allowedKnowledgeUnitIds: string[];
}): string | null {
  const allowed = new Set(input.allowedKnowledgeUnitIds);
  const candidates = [
    input.sessionKnowledgeUnitId,
    input.lastActionKnowledgeUnitId,
    input.allowedKnowledgeUnitIds[0] ?? null,
  ];

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && allowed.has(candidate),
    ) ?? null
  );
}
