import { buildSubjectLifecycleDecision } from './subject-lifecycle.entity';

describe('buildSubjectLifecycleDecision', () => {
  it('recommends deleting an active empty subject', () => {
    const decision = buildSubjectLifecycleDecision({
      subjectId: 'subject-1',
      archivedAt: null,
      dependencyCounts: emptyCounts(),
    });

    expect(decision).toMatchObject({
      subjectId: 'subject-1',
      status: 'ACTIVE',
      recommendedAction: 'DELETE',
      canDelete: true,
      canArchive: false,
      canUpdate: true,
      blockingReasons: [],
    });
  });

  it('recommends archiving a subject with courses and learning history', () => {
    const decision = buildSubjectLifecycleDecision({
      subjectId: 'subject-1',
      archivedAt: null,
      dependencyCounts: {
        ...emptyCounts(),
        courses: 1,
        documents: 1,
        revisionSessions: 1,
        questionBankItems: 1,
      },
    });

    expect(decision.recommendedAction).toBe('ARCHIVE');
    expect(decision.canDelete).toBe(false);
    expect(decision.canArchive).toBe(true);
    expect(decision.canUpdate).toBe(true);
    expect(decision.blockingReasons).toEqual([
      'HAS_COURSES',
      'HAS_DOCUMENTS',
      'HAS_REVISION_SESSIONS',
      'HAS_QUESTION_BANK_ITEMS',
    ]);
  });

  it('blocks lifecycle actions while a subject source is still processing', () => {
    const decision = buildSubjectLifecycleDecision({
      subjectId: 'subject-1',
      archivedAt: null,
      dependencyCounts: {
        ...emptyCounts(),
        documents: 1,
        processingDocuments: 1,
      },
    });

    expect(decision.recommendedAction).toBe('BLOCK');
    expect(decision.canDelete).toBe(false);
    expect(decision.canArchive).toBe(false);
    expect(decision.canUpdate).toBe(true);
    expect(decision.blockingReasons).toContain('HAS_PROCESSING_DOCUMENTS');
  });

  it('blocks an already archived subject', () => {
    const decision = buildSubjectLifecycleDecision({
      subjectId: 'subject-1',
      archivedAt: new Date('2026-06-22T10:00:00.000Z'),
      dependencyCounts: emptyCounts(),
    });

    expect(decision).toMatchObject({
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      canUpdate: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
    });
  });
});

function emptyCounts() {
  return {
    courses: 0,
    documents: 0,
    processingDocuments: 0,
    knowledgeUnits: 0,
    masteryStates: 0,
    activitySessions: 0,
    revisionSessions: 0,
    summaries: 0,
    revisionSheets: 0,
    openQuestions: 0,
    openAnswerEvaluations: 0,
    questionBankItems: 0,
  };
}
