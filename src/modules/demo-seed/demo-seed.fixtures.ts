import { richClosedExerciseFixture } from '../activities/application/rich-closed-questions/rich-closed-question.fixtures';
import type {
  RichClosedExercise,
  RichClosedQuestion,
} from '../activities/application/rich-closed-questions/rich-closed-question.types';

type DemoSeedEnv = {
  NODE_ENV?: string;
  DEMO_SEED_CONFIRM?: string;
  DEMO_FIREBASE_UID?: string;
  DEMO_STUDENT_FIREBASE_UID?: string;
  DEMO_STUDENT_EMAIL?: string;
  DEMO_STUDENT_DISPLAY_NAME?: string;
  DEMO_SEED_DRY_RUN?: string;
};

export type DemoSeedRuntimeOptions = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  dryRun: boolean;
};

export type DemoSeedSubjectFixture = {
  id: string;
  studentId: string;
  name: string;
  priority: number;
};

export type DemoSeedDocumentFixture = {
  id: string;
  studentId: string;
  subjectId: string;
  kind: 'COURSE_PDF';
  fileName: string;
  storagePath: string;
  mimeType: 'application/pdf';
  status: 'READY';
};

export type DemoSeedChunkFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  pageNumber: number;
};

export type DemoSeedKnowledgeUnitFixture = {
  id: string;
  subjectId: string;
  documentId: string;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder: number;
  confidence: number;
  extractionPromptVersion: string;
  extractionSchemaVersion: string;
};

export type DemoSeedKnowledgeUnitSourceFixture = {
  knowledgeUnitId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRevisionGoalFixture = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
};

export type DemoSeedMasteryStateFixture = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
};

export type DemoSeedSummaryFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  studentId: string;
  status: 'READY';
  title: string;
  content: string;
  keyPoints: string[];
  limits: string;
  generatedAt: Date;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  sourceStrategy: 'DOCUMENT_CHUNKS';
  errorCode: null;
};

export type DemoSeedSummarySourceFixture = {
  summaryId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRevisionSheetFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  studentId: string;
  status: 'READY';
  title: string;
  introduction: string;
  keyPoints: string[];
  commonMistakes: string[];
  mustKnow: string[];
  practiceSuggestions: string[];
  generatedAt: Date;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  sourceStrategy: 'DOCUMENT_CHUNKS';
  errorCode: null;
};

export type DemoSeedRevisionSheetSectionFixture = {
  id: string;
  revisionSheetId: string;
  subjectId: string;
  displayOrder: number;
  title: string;
  content: string;
};

export type DemoSeedRevisionSheetSectionSourceFixture = {
  sectionId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRichClosedActivitySessionFixture = {
  id: string;
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId: string;
  version: number;
  type: 'RICH_CLOSED_EXERCISE';
  status: 'STARTED';
  generationFlowName: string;
  generationProvider: string;
  generationModel: string;
  generationPromptVersion: string;
  generationSchemaVersion: string;
  generationInputSize: number;
};

export type DemoSeedRichClosedExercisePayloadFixture = {
  id: string;
  activitySessionId: string;
  version: string;
  title: string;
  subjectId: string;
  documentId: string;
  knowledgeUnitId: string;
  exercisePayload: RichClosedExercise;
  generationMetadata: {
    flowName: string;
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    inputSize: number;
  };
  qualityMetrics: {
    accepted: true;
    questionKinds: string[];
    sourceChunkIds: string[];
  };
};

export type DemoSeedFixtures = {
  subject: DemoSeedSubjectFixture;
  document: DemoSeedDocumentFixture;
  chunks: DemoSeedChunkFixture[];
  knowledgeUnits: DemoSeedKnowledgeUnitFixture[];
  knowledgeUnitSources: DemoSeedKnowledgeUnitSourceFixture[];
  goal: DemoSeedRevisionGoalFixture;
  masteryStates: DemoSeedMasteryStateFixture[];
  summary: DemoSeedSummaryFixture;
  summarySources: DemoSeedSummarySourceFixture[];
  revisionSheet: DemoSeedRevisionSheetFixture;
  revisionSheetSections: DemoSeedRevisionSheetSectionFixture[];
  revisionSheetSectionSources: DemoSeedRevisionSheetSectionSourceFixture[];
  richClosedActivitySession: DemoSeedRichClosedActivitySessionFixture;
  richClosedExercisePayload: DemoSeedRichClosedExercisePayloadFixture;
};

export const demoSeedIds = {
  subjectId: 'demo-subject-droit-constitutionnel',
  documentId: 'demo-document-constitution-veme',
  goalId: 'demo-revision-goal-constitution',
  summaryId: 'demo-summary-constitution',
  revisionSheetId: 'demo-sheet-constitution',
  richClosedActivitySessionId: 'demo-rich-closed-session-regime-parlementaire',
  richClosedExercisePayloadId: 'demo-rich-closed-payload-regime-parlementaire',
  richClosedExerciseId: 'demo-rich-closed-exercise-regime-parlementaire-v1a',
  chunkIds: [
    'demo-chunk-constitution-001',
    'demo-chunk-constitution-002',
    'demo-chunk-constitution-003',
    'demo-chunk-constitution-004',
    'demo-chunk-constitution-005',
    'demo-chunk-constitution-006',
  ],
  knowledgeUnitIds: {
    separationPowers: 'demo-ku-separation-pouvoirs',
    constitutionalReview: 'demo-ku-controle-constitutionnalite',
    rationalizedParliamentary: 'demo-ku-regime-parlementaire',
    governmentResponsibility: 'demo-ku-responsabilite-gouvernement',
    nationalSovereignty: 'demo-ku-souverainete-nationale',
    presidentialPowers: 'demo-ku-pouvoirs-president',
  },
};

const demoSeedVersion = 'demo-seed-v1';

export function buildDemoSeedRuntimeOptions(input: {
  env: DemoSeedEnv;
  argv: string[];
}): DemoSeedRuntimeOptions {
  if (input.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is not allowed with NODE_ENV=production');
  }

  if (input.env.DEMO_SEED_CONFIRM !== 'revision-demo') {
    throw new Error('DEMO_SEED_CONFIRM=revision-demo is required');
  }

  const firebaseUid = (
    input.env.DEMO_FIREBASE_UID ??
    input.env.DEMO_STUDENT_FIREBASE_UID ??
    ''
  ).trim();

  if (!firebaseUid) {
    throw new Error(
      'DEMO_FIREBASE_UID or DEMO_STUDENT_FIREBASE_UID is required',
    );
  }

  return {
    firebaseUid,
    email: trimOptional(input.env.DEMO_STUDENT_EMAIL),
    displayName: trimOptional(input.env.DEMO_STUDENT_DISPLAY_NAME),
    dryRun:
      input.argv.includes('--dry-run') || input.env.DEMO_SEED_DRY_RUN === '1',
  };
}

export function buildDemoSeedFixtures(input: {
  studentId: string;
  now: Date;
}): DemoSeedFixtures {
  const chunks = buildChunks();
  const knowledgeUnits = buildKnowledgeUnits();
  const generatedAt = new Date(input.now);

  return {
    subject: {
      id: demoSeedIds.subjectId,
      studentId: input.studentId,
      name: 'Droit constitutionnel — Ve République',
      priority: 5,
    },
    document: {
      id: demoSeedIds.documentId,
      studentId: input.studentId,
      subjectId: demoSeedIds.subjectId,
      kind: 'COURSE_PDF',
      fileName: 'demo-droit-constitutionnel-veme-republique.pdf',
      storagePath: 'demo://droit-constitutionnel-veme-republique',
      mimeType: 'application/pdf',
      status: 'READY',
    },
    chunks,
    knowledgeUnits,
    knowledgeUnitSources: buildKnowledgeUnitSources(),
    goal: {
      id: demoSeedIds.goalId,
      studentId: input.studentId,
      targetDate: daysAfter(input.now, 30),
      weeklyMinutes: 240,
    },
    masteryStates: buildMasteryStates(input.studentId, input.now),
    summary: buildSummary(input.studentId, generatedAt),
    summarySources: [
      summarySource(0, 0.92),
      summarySource(1, 0.88),
      summarySource(2, 0.86),
      summarySource(3, 0.82),
    ],
    revisionSheet: buildRevisionSheet(input.studentId, generatedAt),
    revisionSheetSections: buildRevisionSheetSections(),
    revisionSheetSectionSources: buildRevisionSheetSectionSources(),
    richClosedActivitySession: buildRichClosedActivitySession(input.studentId),
    richClosedExercisePayload: buildRichClosedExercisePayload(),
  };
}

export function buildDemoSeedPlan(fixtures: DemoSeedFixtures) {
  return {
    fixtures,
    deletePlan: {
      revisionSheetSectionIds: fixtures.revisionSheetSections.map(
        (section) => section.id,
      ),
      revisionSheetIds: [fixtures.revisionSheet.id],
      summaryIds: [fixtures.summary.id],
      richClosedExercisePayloadIds: [fixtures.richClosedExercisePayload.id],
      richClosedActivitySessionIds: [fixtures.richClosedActivitySession.id],
      revisionGoalIds: [fixtures.goal.id],
      knowledgeUnitIds: fixtures.knowledgeUnits.map((unit) => unit.id),
      chunkIds: fixtures.chunks.map((chunk) => chunk.id),
      documentIds: [fixtures.document.id],
      subjectIds: [fixtures.subject.id],
    },
  };
}

export function maskDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid-database-url>';
  }
}

function trimOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function buildChunks(): DemoSeedChunkFixture[] {
  const texts = [
    'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle. Dans la Ve République, cette séparation est organisée mais reste souple afin de permettre la coopération entre institutions.',
    'Le gouvernement est politiquement responsable devant l’Assemblée nationale. La motion de censure et la question de confiance encadrent cette responsabilité et structurent les rapports entre exécutif et Parlement.',
    'Le Conseil constitutionnel contrôle la conformité des lois à la Constitution. Ce contrôle protège la hiérarchie des normes et limite les atteintes aux droits et libertés constitutionnellement garantis.',
    'La rationalisation du parlementarisme encadre la procédure législative et les moyens de contrôle du Parlement. Elle vise à stabiliser l’action gouvernementale tout en maintenant une responsabilité politique.',
    'La souveraineté nationale s’exprime par le suffrage et par la représentation. Le peuple délègue l’exercice du pouvoir à des représentants, tout en conservant une place centrale dans la légitimité des institutions.',
    'Le Président de la République dispose de pouvoirs propres et de pouvoirs partagés. Son rôle varie selon la majorité parlementaire et l’équilibre politique entre le chef de l’État, le gouvernement et le Parlement.',
  ];

  let cursor = 0;

  return texts.map((text, index) => {
    const charStart = cursor;
    const charEnd = cursor + text.length;
    cursor = charEnd + 1;

    return {
      id: demoSeedIds.chunkIds[index],
      documentId: demoSeedIds.documentId,
      subjectId: demoSeedIds.subjectId,
      index,
      text,
      charStart,
      charEnd,
      pageNumber: index + 1,
    };
  });
}

function buildKnowledgeUnits(): DemoSeedKnowledgeUnitFixture[] {
  return [
    unit({
      id: demoSeedIds.knowledgeUnitIds.separationPowers,
      title: 'Séparation des pouvoirs',
      summary:
        'Principe d’organisation qui distingue les fonctions de l’État tout en permettant leur collaboration.',
      difficulty: 'LOW',
      displayOrder: 0,
      confidence: 0.96,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.constitutionalReview,
      title: 'Contrôle de constitutionnalité',
      summary:
        'Contrôle exercé pour vérifier qu’une loi respecte la Constitution et les droits protégés.',
      difficulty: 'MEDIUM',
      displayOrder: 1,
      confidence: 0.93,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
      title: 'Régime parlementaire rationalisé',
      summary:
        'Ensemble de mécanismes qui stabilisent le gouvernement et organisent les rapports avec le Parlement.',
      difficulty: 'HIGH',
      displayOrder: 2,
      confidence: 0.91,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.governmentResponsibility,
      title: 'Responsabilité politique du gouvernement',
      summary:
        'Principe selon lequel le gouvernement peut être renversé par l’Assemblée nationale selon des procédures encadrées.',
      difficulty: 'MEDIUM',
      displayOrder: 3,
      confidence: 0.9,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.nationalSovereignty,
      title: 'Souveraineté nationale',
      summary:
        'Fondement de la légitimité démocratique exercée par le suffrage et la représentation.',
      difficulty: 'LOW',
      displayOrder: 4,
      confidence: 0.94,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.presidentialPowers,
      title: 'Pouvoirs du Président',
      summary:
        'Compétences propres et partagées du Président, variables selon le contexte majoritaire.',
      difficulty: 'MEDIUM',
      displayOrder: 5,
      confidence: 0.92,
    }),
  ];
}

function unit(input: {
  id: string;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder: number;
  confidence: number;
}): DemoSeedKnowledgeUnitFixture {
  return {
    id: input.id,
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    title: input.title,
    summary: input.summary,
    difficulty: input.difficulty,
    displayOrder: input.displayOrder,
    confidence: input.confidence,
    extractionPromptVersion: demoSeedVersion,
    extractionSchemaVersion: demoSeedVersion,
  };
}

function buildKnowledgeUnitSources(): DemoSeedKnowledgeUnitSourceFixture[] {
  return [
    source(demoSeedIds.knowledgeUnitIds.separationPowers, 0, 0.95),
    source(demoSeedIds.knowledgeUnitIds.governmentResponsibility, 1, 0.94),
    source(demoSeedIds.knowledgeUnitIds.constitutionalReview, 2, 0.96),
    source(demoSeedIds.knowledgeUnitIds.rationalizedParliamentary, 3, 0.93),
    source(demoSeedIds.knowledgeUnitIds.nationalSovereignty, 4, 0.94),
    source(demoSeedIds.knowledgeUnitIds.presidentialPowers, 5, 0.92),
    source(demoSeedIds.knowledgeUnitIds.rationalizedParliamentary, 1, 0.81),
  ];
}

function source(
  knowledgeUnitId: string,
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedKnowledgeUnitSourceFixture {
  return {
    knowledgeUnitId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildMasteryStates(
  studentId: string,
  now: Date,
): DemoSeedMasteryStateFixture[] {
  return [
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.separationPowers,
      0.2,
      daysBefore(now, 16),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.constitutionalReview,
      0.55,
      daysBefore(now, 8),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
      0.75,
      daysBefore(now, 2),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.governmentResponsibility,
      0.35,
      null,
    ),
  ];
}

function mastery(
  studentId: string,
  knowledgeUnitId: string,
  score: number,
  lastPracticedAt: Date | null,
): DemoSeedMasteryStateFixture {
  return {
    studentId,
    subjectId: demoSeedIds.subjectId,
    knowledgeUnitId,
    score,
    lastPracticedAt,
  };
}

function buildSummary(
  studentId: string,
  generatedAt: Date,
): DemoSeedSummaryFixture {
  return {
    id: demoSeedIds.summaryId,
    documentId: demoSeedIds.documentId,
    subjectId: demoSeedIds.subjectId,
    studentId,
    status: 'READY',
    title: 'Synthèse demo — Ve République',
    content:
      'La Ve République combine un exécutif fort, un Parlement encadré et des mécanismes de contrôle constitutionnel. La séparation des pouvoirs reste centrale, mais elle s’exprime dans un régime parlementaire rationalisé.',
    keyPoints: [
      'Séparation des pouvoirs organisée et souple.',
      'Responsabilité politique du gouvernement devant l’Assemblée nationale.',
      'Contrôle de constitutionnalité comme garantie normative.',
      'Président renforcé selon le contexte majoritaire.',
    ],
    limits:
      'Fixture synthétique de démonstration, sans appel IA et sans document PDF réel.',
    generatedAt,
    flowName: 'demoSeedSummary',
    provider: 'demo-seed',
    model: 'demo-fixture',
    promptVersion: demoSeedVersion,
    schemaVersion: demoSeedVersion,
    inputSize: 0,
    sourceStrategy: 'DOCUMENT_CHUNKS',
    errorCode: null,
  };
}

function summarySource(
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedSummarySourceFixture {
  return {
    summaryId: demoSeedIds.summaryId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildRevisionSheet(
  studentId: string,
  generatedAt: Date,
): DemoSeedRevisionSheetFixture {
  return {
    id: demoSeedIds.revisionSheetId,
    documentId: demoSeedIds.documentId,
    subjectId: demoSeedIds.subjectId,
    studentId,
    status: 'READY',
    title: 'Fiche demo — Droit constitutionnel',
    introduction:
      'Cette fiche de démonstration résume les notions clés pour tester les parcours de révision sans IA.',
    keyPoints: [
      'Identifier les fonctions de l’État.',
      'Relier responsabilité gouvernementale et parlementarisme.',
      'Comprendre le rôle du Conseil constitutionnel.',
    ],
    commonMistakes: [
      'Confondre séparation stricte et séparation souple des pouvoirs.',
      'Oublier que le gouvernement reste responsable devant l’Assemblée nationale.',
    ],
    mustKnow: [
      'Motion de censure.',
      'Contrôle de constitutionnalité.',
      'Rationalisation du parlementarisme.',
    ],
    practiceSuggestions: [
      'Faire un QCM ciblé sur les pouvoirs.',
      'Répondre à une question ouverte sur la responsabilité politique.',
    ],
    generatedAt,
    flowName: 'demoSeedRevisionSheet',
    provider: 'demo-seed',
    model: 'demo-fixture',
    promptVersion: demoSeedVersion,
    schemaVersion: demoSeedVersion,
    inputSize: 0,
    sourceStrategy: 'DOCUMENT_CHUNKS',
    errorCode: null,
  };
}

function buildRevisionSheetSections(): DemoSeedRevisionSheetSectionFixture[] {
  return [
    {
      id: 'demo-sheet-section-constitution-001',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 0,
      title: 'Institutions et séparation des pouvoirs',
      content:
        'La Ve République distingue les fonctions institutionnelles tout en prévoyant des interactions constantes entre exécutif, Parlement et juge constitutionnel.',
    },
    {
      id: 'demo-sheet-section-constitution-002',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 1,
      title: 'Parlementarisme rationalisé',
      content:
        'Les mécanismes de responsabilité et de procédure cherchent à éviter l’instabilité gouvernementale tout en conservant un contrôle parlementaire.',
    },
    {
      id: 'demo-sheet-section-constitution-003',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 2,
      title: 'Contrôle constitutionnel',
      content:
        'Le Conseil constitutionnel garantit la conformité des lois aux normes constitutionnelles et protège les libertés fondamentales.',
    },
  ];
}

function buildRevisionSheetSectionSources(): DemoSeedRevisionSheetSectionSourceFixture[] {
  return [
    sectionSource('demo-sheet-section-constitution-001', 0, 0.94),
    sectionSource('demo-sheet-section-constitution-002', 3, 0.92),
    sectionSource('demo-sheet-section-constitution-003', 2, 0.93),
  ];
}

function sectionSource(
  sectionId: string,
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedRevisionSheetSectionSourceFixture {
  return {
    sectionId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildRichClosedActivitySession(
  studentId: string,
): DemoSeedRichClosedActivitySessionFixture {
  return {
    id: demoSeedIds.richClosedActivitySessionId,
    studentId,
    subjectId: demoSeedIds.subjectId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    documentId: demoSeedIds.documentId,
    version: 1,
    type: 'RICH_CLOSED_EXERCISE',
    status: 'STARTED',
    generationFlowName: 'demoSeedRichClosedExercise',
    generationProvider: 'demo-seed',
    generationModel: 'demo-fixture',
    generationPromptVersion: demoSeedVersion,
    generationSchemaVersion: demoSeedVersion,
    generationInputSize: 0,
  };
}

function buildRichClosedExercisePayload(): DemoSeedRichClosedExercisePayloadFixture {
  const exercise = buildRichClosedExercise();
  const sourceChunkIds = Array.from(
    new Set(exercise.questions.flatMap((question) => question.sourceChunkIds)),
  );

  return {
    id: demoSeedIds.richClosedExercisePayloadId,
    activitySessionId: demoSeedIds.richClosedActivitySessionId,
    version: exercise.version,
    title: exercise.title,
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    exercisePayload: exercise,
    generationMetadata: {
      flowName: 'demoSeedRichClosedExercise',
      provider: 'demo-seed',
      model: 'demo-fixture',
      promptVersion: demoSeedVersion,
      schemaVersion: demoSeedVersion,
      inputSize: 0,
    },
    qualityMetrics: {
      accepted: true,
      questionKinds: exercise.questions.map(
        (question) => question.questionKind,
      ),
      sourceChunkIds,
    },
  };
}

function buildRichClosedExercise(): RichClosedExercise {
  const exercise = richClosedExerciseFixture();

  return {
    ...exercise,
    id: demoSeedIds.richClosedExerciseId,
    title: 'Régime parlementaire rationalisé — exercice fermé riche V1-A',
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    questions: exercise.questions.map((question) =>
      withDemoSources(question, demoSourcesForQuestion(question.questionKind)),
    ),
  };
}

function demoSourcesForQuestion(
  questionKind: RichClosedQuestion['questionKind'],
): string[] {
  switch (questionKind) {
    case 'single_choice':
    case 'multiple_choice':
    case 'case_qualification':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'matching':
    case 'ordering':
      return [demoSeedIds.chunkIds[3]];
    case 'error_detection':
      return [demoSeedIds.chunkIds[1]];
    case 'timeline':
      return [demoSeedIds.chunkIds[3]];
    case 'date_slider':
      return [demoSeedIds.chunkIds[1]];
    case 'true_false_grid':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'cause_consequence':
      return [demoSeedIds.chunkIds[3]];
    case 'institution_matrix':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
  }
}

function withDemoSources(
  question: RichClosedQuestion,
  sourceChunkIds: string[],
): RichClosedQuestion {
  return {
    ...question,
    sourceChunkIds,
  };
}
