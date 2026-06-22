import { buildSourceLifecycleDecision } from './source-lifecycle.entity';

describe('buildSourceLifecycleDecision', () => {
  it('blocks uploaded and processing sources', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: 'course-1',
        status: 'PROCESSING',
        archivedAt: null,
        dependencyCounts: {},
      }),
    ).toMatchObject({
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['SOURCE_PROCESSING'],
    });
  });

  it('recommends archive when the source has learning dependencies', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: 'course-1',
        status: 'READY',
        archivedAt: null,
        dependencyCounts: {
          HAS_KNOWLEDGE_UNITS: 3,
          HAS_REVISION_SESSIONS: 1,
        },
      }),
    ).toMatchObject({
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      blockingReasons: ['HAS_KNOWLEDGE_UNITS', 'HAS_REVISION_SESSIONS'],
    });
  });

  it('allows deletion when no learning dependency exists', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: null,
        status: 'FAILED',
        archivedAt: null,
        dependencyCounts: {},
      }),
    ).toMatchObject({
      recommendedAction: 'DELETE',
      canDelete: true,
      canArchive: true,
      blockingReasons: [],
    });
  });

  it('blocks any further lifecycle action on already archived sources', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: 'course-1',
        status: 'READY',
        archivedAt: new Date('2026-06-21T10:00:00.000Z'),
        dependencyCounts: {},
      }),
    ).toMatchObject({
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
    });
  });
});
