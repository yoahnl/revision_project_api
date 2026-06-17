import { selectDeterministicRevisionSessionAction } from './deterministic-revision-session-action-selector';
import type { RevisionCoachNextActionInput } from './revision-coach-next-action.entity';

describe('selectDeterministicRevisionSessionAction', () => {
  it('selects an open question after a diagnostic quiz when a reliable knowledge unit exists', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'quiz-session-1',
            knowledgeUnitId: null,
          },
        ],
      }),
    ).toEqual({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-1',
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('selects a rich closed exercise after an open question when available', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'open-session-1',
            knowledgeUnitId: 'unit-1',
          },
        ],
      }),
    ).toEqual({
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: 'unit-1',
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('selects a diagnostic quiz after an open question when rich closed is unavailable', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        availableActions: ['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION'],
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'open-session-1',
            knowledgeUnitId: 'unit-1',
          },
        ],
      }),
    ).toEqual({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('selects a diagnostic quiz after a rich closed exercise', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: null,
            knowledgeUnitId: 'unit-1',
          },
        ],
      }),
    ).toEqual({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('falls back to a diagnostic quiz when no reliable knowledge unit exists', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: null,
        allowedKnowledgeUnitIds: [],
        availableActions: ['DIAGNOSTIC_QUIZ'],
      }),
    ).toEqual({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CONTINUE_SESSION_DEFAULT',
    });
  });

  it('keeps a stable choice with empty history and does not mutate input', () => {
    const input = {
      ...baseInput(),
      sessionKnowledgeUnitId: null,
      allowedKnowledgeUnitIds: ['unit-2'],
      history: [],
    };
    const snapshot = JSON.stringify(input);

    expect(selectDeterministicRevisionSessionAction(input)).toEqual({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

function baseInput(): RevisionCoachNextActionInput {
  return {
    studentId: 'student-1',
    sessionId: 'revision-session-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    sessionKnowledgeUnitId: 'unit-1',
    history: [],
    availableActions: [
      'DIAGNOSTIC_QUIZ',
      'OPEN_QUESTION',
      'RICH_CLOSED_EXERCISE',
    ],
    allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
  };
}
