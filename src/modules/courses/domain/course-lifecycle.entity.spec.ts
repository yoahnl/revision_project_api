import { buildCourseLifecycleDecision } from './course-lifecycle.entity';

describe('buildCourseLifecycleDecision', () => {
  it('recommends deleting an active empty course', () => {
    const decision = buildCourseLifecycleDecision({
      courseId: 'course-1',
      archivedAt: null,
      dependencyCounts: {
        documents: 0,
        processingDocuments: 0,
        revisionSessions: 0,
        questionBankItems: 0,
      },
    });

    expect(decision).toMatchObject({
      courseId: 'course-1',
      status: 'ACTIVE',
      recommendedAction: 'DELETE',
      canDelete: true,
      canArchive: false,
      canUpdate: true,
      blockingReasons: [],
    });
  });

  it('recommends archiving a course with historical dependencies', () => {
    const decision = buildCourseLifecycleDecision({
      courseId: 'course-1',
      archivedAt: null,
      dependencyCounts: {
        documents: 1,
        processingDocuments: 0,
        revisionSessions: 1,
        questionBankItems: 1,
      },
    });

    expect(decision.recommendedAction).toBe('ARCHIVE');
    expect(decision.canDelete).toBe(false);
    expect(decision.canArchive).toBe(true);
    expect(decision.canUpdate).toBe(true);
    expect(decision.blockingReasons).toEqual([
      'HAS_DOCUMENTS',
      'HAS_REVISION_SESSIONS',
      'HAS_QUESTION_BANK_ITEMS',
    ]);
  });

  it('blocks lifecycle actions while a course source is still processing', () => {
    const decision = buildCourseLifecycleDecision({
      courseId: 'course-1',
      archivedAt: null,
      dependencyCounts: {
        documents: 1,
        processingDocuments: 1,
        revisionSessions: 0,
        questionBankItems: 0,
      },
    });

    expect(decision.recommendedAction).toBe('BLOCK');
    expect(decision.canDelete).toBe(false);
    expect(decision.canArchive).toBe(false);
    expect(decision.canUpdate).toBe(true);
    expect(decision.blockingReasons).toContain('HAS_PROCESSING_DOCUMENTS');
  });

  it('blocks an already archived course', () => {
    const decision = buildCourseLifecycleDecision({
      courseId: 'course-1',
      archivedAt: new Date('2026-06-22T10:00:00.000Z'),
      dependencyCounts: {
        documents: 0,
        processingDocuments: 0,
        revisionSessions: 0,
        questionBankItems: 0,
      },
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
