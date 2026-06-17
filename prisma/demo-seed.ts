import 'dotenv/config';
import { resolvePrismaDatabaseUrl } from '../src/shared/infrastructure/prisma/database-url';
import {
  buildDemoSeedFixtures,
  buildDemoSeedPlan,
  buildDemoSeedRuntimeOptions,
  demoSeedIds,
  maskDatabaseUrl,
  type DemoSeedFixtures,
} from '../src/modules/demo-seed/demo-seed.fixtures';

async function main(): Promise<void> {
  const options = buildDemoSeedRuntimeOptions({
    env: process.env,
    argv: process.argv.slice(2),
  });
  const databaseUrl = resolvePrismaDatabaseUrl();
  const now = new Date();

  if (options.dryRun) {
    const fixtures = buildDemoSeedFixtures({
      studentId: 'demo-student-profile',
      now,
    });
    const plan = buildDemoSeedPlan(fixtures);

    printSeedSummary({
      mode: 'dry-run',
      databaseUrl,
      firebaseUid: options.firebaseUid,
      fixtures,
      deletePlan: plan.deletePlan,
    });
    return;
  }

  const [{ PrismaPg }, { getPrismaClientClass }] = await Promise.all([
    import('@prisma/adapter-pg'),
    Promise.resolve(require('../src/generated/prisma/internal/class')),
  ]);
  const PrismaClient = getPrismaClientClass();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await prisma.$connect();

    const student = await prisma.studentProfile.upsert({
      where: { firebaseUid: options.firebaseUid },
      create: {
        id: 'demo-student-profile',
        firebaseUid: options.firebaseUid,
        email: options.email,
        displayName: options.displayName,
      },
      update: {
        email: options.email,
        displayName: options.displayName,
      },
    });
    const fixtures = buildDemoSeedFixtures({
      studentId: student.id,
      now,
    });
    const plan = buildDemoSeedPlan(fixtures);

    await prisma.$transaction(async (tx) => {
      await assertDemoNamespaceAvailable(tx, student.id);
      await seedFixtures(tx, fixtures);
    });

    printSeedSummary({
      mode: 'write',
      databaseUrl,
      firebaseUid: options.firebaseUid,
      fixtures,
      deletePlan: plan.deletePlan,
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function assertDemoNamespaceAvailable(
  tx: TransactionClient,
  studentId: string,
): Promise<void> {
  const [subject, document, goal] = await Promise.all([
    tx.subject.findUnique({
      where: { id: demoSeedIds.subjectId },
      select: { studentId: true },
    }),
    tx.document.findUnique({
      where: { id: demoSeedIds.documentId },
      select: { studentId: true },
    }),
    tx.revisionGoal.findUnique({
      where: { id: demoSeedIds.goalId },
      select: { studentId: true },
    }),
  ]);

  for (const record of [subject, document, goal]) {
    if (record && record.studentId !== studentId) {
      throw new Error(
        'Demo namespace already belongs to another student profile',
      );
    }
  }
}

async function seedFixtures(
  tx: TransactionClient,
  fixtures: DemoSeedFixtures,
): Promise<void> {
  await tx.subject.upsert({
    where: { id: fixtures.subject.id },
    create: fixtures.subject,
    update: {
      studentId: fixtures.subject.studentId,
      name: fixtures.subject.name,
      priority: fixtures.subject.priority,
    },
  });

  await tx.document.upsert({
    where: { id: fixtures.document.id },
    create: fixtures.document,
    update: {
      studentId: fixtures.document.studentId,
      subjectId: fixtures.document.subjectId,
      kind: fixtures.document.kind,
      fileName: fixtures.document.fileName,
      storagePath: fixtures.document.storagePath,
      mimeType: fixtures.document.mimeType,
      status: fixtures.document.status,
      errorCode: null,
    },
  });

  for (const chunk of fixtures.chunks) {
    await tx.documentChunk.upsert({
      where: { id: chunk.id },
      create: chunk,
      update: {
        documentId: chunk.documentId,
        subjectId: chunk.subjectId,
        index: chunk.index,
        text: chunk.text,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        pageNumber: chunk.pageNumber,
      },
    });
  }

  for (const unit of fixtures.knowledgeUnits) {
    await tx.knowledgeUnit.upsert({
      where: { id: unit.id },
      create: unit,
      update: unit,
    });
  }

  for (const source of fixtures.knowledgeUnitSources) {
    await tx.knowledgeUnitSource.upsert({
      where: {
        knowledgeUnitId_chunkId: {
          knowledgeUnitId: source.knowledgeUnitId,
          chunkId: source.chunkId,
        },
      },
      create: source,
      update: {
        subjectId: source.subjectId,
        relevanceScore: source.relevanceScore,
      },
    });
  }

  await tx.revisionGoal.upsert({
    where: { id: fixtures.goal.id },
    create: fixtures.goal,
    update: {
      studentId: fixtures.goal.studentId,
      targetDate: fixtures.goal.targetDate,
      weeklyMinutes: fixtures.goal.weeklyMinutes,
    },
  });

  for (const mastery of fixtures.masteryStates) {
    await tx.masteryState.upsert({
      where: {
        studentId_knowledgeUnitId: {
          studentId: mastery.studentId,
          knowledgeUnitId: mastery.knowledgeUnitId,
        },
      },
      create: mastery,
      update: {
        subjectId: mastery.subjectId,
        score: mastery.score,
        lastPracticedAt: mastery.lastPracticedAt,
      },
    });
  }

  const summary = await tx.summary.upsert({
    where: { documentId: fixtures.summary.documentId },
    create: fixtures.summary,
    update: {
      subjectId: fixtures.summary.subjectId,
      studentId: fixtures.summary.studentId,
      status: fixtures.summary.status,
      title: fixtures.summary.title,
      content: fixtures.summary.content,
      keyPoints: fixtures.summary.keyPoints,
      limits: fixtures.summary.limits,
      generatedAt: fixtures.summary.generatedAt,
      flowName: fixtures.summary.flowName,
      provider: fixtures.summary.provider,
      model: fixtures.summary.model,
      promptVersion: fixtures.summary.promptVersion,
      schemaVersion: fixtures.summary.schemaVersion,
      inputSize: fixtures.summary.inputSize,
      sourceStrategy: fixtures.summary.sourceStrategy,
      errorCode: fixtures.summary.errorCode,
    },
  });
  for (const source of fixtures.summarySources) {
    await tx.summarySource.upsert({
      where: {
        summaryId_chunkId: {
          summaryId: summary.id,
          chunkId: source.chunkId,
        },
      },
      create: {
        ...source,
        summaryId: summary.id,
      },
      update: {
        subjectId: source.subjectId,
        relevanceScore: source.relevanceScore,
      },
    });
  }

  const revisionSheet = await tx.revisionSheet.upsert({
    where: { documentId: fixtures.revisionSheet.documentId },
    create: fixtures.revisionSheet,
    update: {
      subjectId: fixtures.revisionSheet.subjectId,
      studentId: fixtures.revisionSheet.studentId,
      status: fixtures.revisionSheet.status,
      title: fixtures.revisionSheet.title,
      introduction: fixtures.revisionSheet.introduction,
      keyPoints: fixtures.revisionSheet.keyPoints,
      commonMistakes: fixtures.revisionSheet.commonMistakes,
      mustKnow: fixtures.revisionSheet.mustKnow,
      practiceSuggestions: fixtures.revisionSheet.practiceSuggestions,
      generatedAt: fixtures.revisionSheet.generatedAt,
      flowName: fixtures.revisionSheet.flowName,
      provider: fixtures.revisionSheet.provider,
      model: fixtures.revisionSheet.model,
      promptVersion: fixtures.revisionSheet.promptVersion,
      schemaVersion: fixtures.revisionSheet.schemaVersion,
      inputSize: fixtures.revisionSheet.inputSize,
      sourceStrategy: fixtures.revisionSheet.sourceStrategy,
      errorCode: fixtures.revisionSheet.errorCode,
    },
  });
  for (const section of fixtures.revisionSheetSections) {
    await tx.revisionSheetSection.upsert({
      where: { id: section.id },
      create: {
        ...section,
        revisionSheetId: revisionSheet.id,
      },
      update: {
        revisionSheetId: revisionSheet.id,
        subjectId: section.subjectId,
        displayOrder: section.displayOrder,
        title: section.title,
        content: section.content,
      },
    });
  }

  for (const source of fixtures.revisionSheetSectionSources) {
    await tx.revisionSheetSectionSource.upsert({
      where: {
        sectionId_chunkId: {
          sectionId: source.sectionId,
          chunkId: source.chunkId,
        },
      },
      create: source,
      update: {
        subjectId: source.subjectId,
        relevanceScore: source.relevanceScore,
      },
    });
  }

  await tx.activitySession.upsert({
    where: { id: fixtures.richClosedActivitySession.id },
    create: fixtures.richClosedActivitySession,
    update: {
      studentId: fixtures.richClosedActivitySession.studentId,
      subjectId: fixtures.richClosedActivitySession.subjectId,
      knowledgeUnitId: fixtures.richClosedActivitySession.knowledgeUnitId,
      documentId: fixtures.richClosedActivitySession.documentId,
      version: fixtures.richClosedActivitySession.version,
      type: fixtures.richClosedActivitySession.type,
      status: fixtures.richClosedActivitySession.status,
      generationFlowName: fixtures.richClosedActivitySession.generationFlowName,
      generationProvider: fixtures.richClosedActivitySession.generationProvider,
      generationModel: fixtures.richClosedActivitySession.generationModel,
      generationPromptVersion:
        fixtures.richClosedActivitySession.generationPromptVersion,
      generationSchemaVersion:
        fixtures.richClosedActivitySession.generationSchemaVersion,
      generationInputSize:
        fixtures.richClosedActivitySession.generationInputSize,
    },
  });

  await tx.richClosedExercisePayload.upsert({
    where: {
      activitySessionId: fixtures.richClosedExercisePayload.activitySessionId,
    },
    create: fixtures.richClosedExercisePayload,
    update: {
      version: fixtures.richClosedExercisePayload.version,
      title: fixtures.richClosedExercisePayload.title,
      subjectId: fixtures.richClosedExercisePayload.subjectId,
      documentId: fixtures.richClosedExercisePayload.documentId,
      knowledgeUnitId: fixtures.richClosedExercisePayload.knowledgeUnitId,
      exercisePayload: fixtures.richClosedExercisePayload.exercisePayload,
      generationMetadata: fixtures.richClosedExercisePayload.generationMetadata,
      qualityMetrics: fixtures.richClosedExercisePayload.qualityMetrics,
    },
  });
}

function printSeedSummary(input: {
  mode: 'dry-run' | 'write';
  databaseUrl: string;
  firebaseUid: string;
  fixtures: DemoSeedFixtures;
  deletePlan: ReturnType<typeof buildDemoSeedPlan>['deletePlan'];
}): void {
  const summary = {
    mode: input.mode,
    databaseUrl: maskDatabaseUrl(input.databaseUrl),
    firebaseUid: maskFirebaseUid(input.firebaseUid),
    subjectId: input.fixtures.subject.id,
    documentId: input.fixtures.document.id,
    chunks: input.fixtures.chunks.length,
    knowledgeUnits: input.fixtures.knowledgeUnits.length,
    masteryStates: input.fixtures.masteryStates.length,
    summaryId: input.fixtures.summary.id,
    revisionSheetId: input.fixtures.revisionSheet.id,
    richClosedSessionId: input.fixtures.richClosedActivitySession.id,
    richClosedExerciseId:
      input.fixtures.richClosedExercisePayload.exercisePayload.id,
    richClosedQuestionKinds:
      input.fixtures.richClosedExercisePayload.exercisePayload.questions.map(
        (question) => question.questionKind,
      ),
    deletePlan: input.deletePlan,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function maskFirebaseUid(firebaseUid: string): string {
  if (firebaseUid.length <= 8) {
    return '***';
  }

  return `${firebaseUid.slice(0, 4)}***${firebaseUid.slice(-4)}`;
}

type TransactionClient = any;

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Demo seed failed: ${message}`);
  process.exitCode = 1;
});
