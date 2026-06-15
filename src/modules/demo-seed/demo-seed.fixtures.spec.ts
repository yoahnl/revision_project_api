import {
  buildDemoSeedFixtures,
  buildDemoSeedPlan,
  buildDemoSeedRuntimeOptions,
  demoSeedIds,
  maskDatabaseUrl,
} from './demo-seed.fixtures';

describe('demo seed fixtures', () => {
  it('builds stable non-sensitive fixtures for the demo scenario', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const fixtures = buildDemoSeedFixtures({
      studentId: 'demo-student-profile',
      now,
    });

    expect(fixtures.subject.id).toBe(demoSeedIds.subjectId);
    expect(fixtures.subject.name).toBe('Droit constitutionnel — Ve République');
    expect(fixtures.document.id).toBe(demoSeedIds.documentId);
    expect(fixtures.document.status).toBe('READY');
    expect(fixtures.document.storagePath).toBe(
      'demo://droit-constitutionnel-veme-republique',
    );
    expect(fixtures.chunks).toHaveLength(6);
    expect(fixtures.knowledgeUnits.length).toBeGreaterThanOrEqual(5);
    expect(fixtures.goal.targetDate.getTime()).toBeGreaterThan(now.getTime());
    expect(fixtures.masteryStates.map((state) => state.score)).toEqual([
      0.2, 0.55, 0.75, 0.35,
    ]);

    const serialized = JSON.stringify(fixtures);
    expect(serialized).not.toContain('firebase');
    expect(serialized).not.toContain('MISTRAL');
    expect(serialized).not.toContain('AIza');
    expect(serialized).not.toContain('701YN');
  });

  it('keeps every knowledge unit source linked to an existing demo chunk', () => {
    const fixtures = buildDemoSeedFixtures({
      studentId: 'demo-student-profile',
      now: new Date('2026-06-15T12:00:00.000Z'),
    });
    const chunkIds = new Set(fixtures.chunks.map((chunk) => chunk.id));
    const knowledgeUnitIds = new Set(
      fixtures.knowledgeUnits.map((unit) => unit.id),
    );

    for (const source of fixtures.knowledgeUnitSources) {
      expect(knowledgeUnitIds.has(source.knowledgeUnitId)).toBe(true);
      expect(chunkIds.has(source.chunkId)).toBe(true);
      expect(source.subjectId).toBe(fixtures.subject.id);
    }
  });

  it('builds a deletion plan constrained to demo identifiers', () => {
    const fixtures = buildDemoSeedFixtures({
      studentId: 'demo-student-profile',
      now: new Date('2026-06-15T12:00:00.000Z'),
    });
    const plan = buildDemoSeedPlan(fixtures);
    const serialized = JSON.stringify(plan.deletePlan);

    expect(plan.deletePlan.documentIds).toEqual([demoSeedIds.documentId]);
    expect(plan.deletePlan.subjectIds).toEqual([demoSeedIds.subjectId]);
    expect(plan.deletePlan.revisionGoalIds).toEqual([demoSeedIds.goalId]);
    expect(serialized).toContain('demo-');
    expect(serialized).not.toContain('deleteManyStudent');
  });

  it('requires production guard, explicit confirmation and Firebase UID', () => {
    expect(() =>
      buildDemoSeedRuntimeOptions({
        env: {
          NODE_ENV: 'production',
          DEMO_SEED_CONFIRM: 'revision-demo',
          DEMO_FIREBASE_UID: 'demo-local-uid',
        },
        argv: [],
      }),
    ).toThrow('Demo seed is not allowed with NODE_ENV=production');

    expect(() =>
      buildDemoSeedRuntimeOptions({
        env: {
          NODE_ENV: 'development',
          DEMO_FIREBASE_UID: 'demo-local-uid',
        },
        argv: [],
      }),
    ).toThrow('DEMO_SEED_CONFIRM=revision-demo is required');

    expect(() =>
      buildDemoSeedRuntimeOptions({
        env: {
          NODE_ENV: 'development',
          DEMO_SEED_CONFIRM: 'revision-demo',
        },
        argv: [],
      }),
    ).toThrow('DEMO_FIREBASE_UID or DEMO_STUDENT_FIREBASE_UID is required');
  });

  it('resolves dry-run mode and masks database URLs', () => {
    const options = buildDemoSeedRuntimeOptions({
      env: {
        NODE_ENV: 'development',
        DEMO_SEED_CONFIRM: 'revision-demo',
        DEMO_STUDENT_FIREBASE_UID: 'demo-local-uid',
        DEMO_STUDENT_EMAIL: 'demo-revision@example.test',
        DEMO_STUDENT_DISPLAY_NAME: 'Demo Revision',
        DEMO_SEED_DRY_RUN: '1',
      },
      argv: ['--dry-run'],
    });

    expect(options.dryRun).toBe(true);
    expect(options.firebaseUid).toBe('demo-local-uid');
    expect(options.email).toBe('demo-revision@example.test');
    expect(options.displayName).toBe('Demo Revision');
    expect(maskDatabaseUrl('postgresql://user:secret@localhost:5432/db')).toBe(
      'postgresql://user:***@localhost:5432/db',
    );
  });
});
