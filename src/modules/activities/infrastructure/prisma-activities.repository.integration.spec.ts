import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { PrismaActivitiesRepository } from './prisma-activities.repository';
import type { GeneratedDiagnosticQuiz } from '../application/diagnostic-quiz-generator';

const describeIntegration =
  process.env.RUN_PRISMA_INTEGRATION_TESTS === 'true'
    ? describe
    : describe.skip;

describeIntegration('PrismaActivitiesRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaActivitiesRepository;
  const createdStudentIds: string[] = [];

  beforeAll(async () => {
    assertDisposableDatabaseUrl();
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaActivitiesRepository(prisma);
  });

  afterEach(async () => {
    await prisma.studentProfile.deleteMany({
      where: {
        id: {
          in: createdStudentIds.splice(0),
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists, reads and submits a sourced QCM v3 with visuals and multiple answers', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const studentId = `student-${suffix}`;
    const subjectId = `subject-${suffix}`;
    const documentId = `document-${suffix}`;
    const chunkOneId = `chunk-one-${suffix}`;
    const chunkTwoId = `chunk-two-${suffix}`;
    const knowledgeUnitId = `unit-${suffix}`;
    createdStudentIds.push(studentId);

    await prisma.studentProfile.create({
      data: {
        id: studentId,
        firebaseUid: `firebase-${suffix}`,
        email: `student-${suffix}@example.test`,
      },
    });
    await prisma.subject.create({
      data: {
        id: subjectId,
        studentId,
        name: 'Droit constitutionnel',
        priority: 4,
      },
    });
    await prisma.document.create({
      data: {
        id: documentId,
        studentId,
        subjectId,
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: `students/${studentId}/subjects/${subjectId}/cours.pdf`,
        mimeType: 'application/pdf',
        status: 'READY',
      },
    });
    await prisma.documentChunk.createMany({
      data: [
        {
          id: chunkOneId,
          documentId,
          subjectId,
          index: 0,
          text: 'Le regime parlementaire implique une responsabilite politique du gouvernement devant le Parlement.',
          pageNumber: 3,
        },
        {
          id: chunkTwoId,
          documentId,
          subjectId,
          index: 1,
          text: 'Le regime presidentiel repose sur une separation plus stricte des pouvoirs et une election distincte des organes.',
          pageNumber: 4,
        },
      ],
    });
    await prisma.knowledgeUnit.create({
      data: {
        id: knowledgeUnitId,
        subjectId,
        documentId,
        title: 'Regimes parlementaire et presidentiel',
        summary: 'Comparer les criteres de distinction entre les deux regimes.',
        difficulty: 'HIGH',
      },
    });
    await prisma.knowledgeUnitSource.createMany({
      data: [
        {
          knowledgeUnitId,
          subjectId,
          chunkId: chunkOneId,
        },
        {
          knowledgeUnitId,
          subjectId,
          chunkId: chunkTwoId,
        },
      ],
    });

    const quiz: GeneratedDiagnosticQuiz = {
      title: 'Quiz regimes politiques',
      version: 3,
      metadata: {
        flowName: 'diagnosticQuizGeneration',
        provider: 'test',
        model: 'test-model',
        promptVersion: 'diagnostic-quiz-v3',
        schemaVersion: 'diagnostic-quiz-v3',
        inputSize: 1234,
      },
      questions: [
        {
          prompt:
            'Quel critere distingue principalement le regime parlementaire ?',
          difficulty: 'MEDIUM',
          selectionMode: 'single',
          choices: [
            {
              id: 'single-good',
              label: 'La responsabilite politique du gouvernement.',
              feedback: 'Ce critere correspond au regime parlementaire.',
            },
            {
              id: 'single-bad',
              label: 'Une election totalement separee de tous les organes.',
              feedback: 'Ce critere renvoie plutot au regime presidentiel.',
            },
          ],
          correctChoiceId: 'single-good',
          explanation:
            'Le regime parlementaire se reconnait a la responsabilite du gouvernement devant le Parlement.',
          sourceChunkIds: [chunkOneId],
          visuals: [
            {
              type: 'CHART',
              displayOrder: 0,
              chartType: 'bar',
              title: 'Criteres compares',
              data: [
                {
                  critere: 'Responsabilite politique',
                  parlementaire: 1,
                  presidentiel: 0,
                },
              ],
              xKey: 'critere',
              yKeys: ['parlementaire', 'presidentiel'],
              sourceChunkIds: [chunkOneId],
            },
          ],
        },
        {
          prompt:
            'Quels elements caracterisent le regime presidentiel dans le cours ?',
          difficulty: 'HIGH',
          selectionMode: 'multiple',
          minSelections: 2,
          maxSelections: 2,
          choices: [
            {
              id: 'multi-good-1',
              label: 'Une separation plus stricte des pouvoirs.',
              feedback:
                'La separation stricte est un marqueur du regime presidentiel.',
            },
            {
              id: 'multi-bad',
              label: 'La responsabilite politique devant le Parlement.',
              feedback:
                'Cette responsabilite est associee au regime parlementaire.',
            },
            {
              id: 'multi-good-2',
              label: 'Une election distincte des organes.',
              feedback:
                'Le cours relie cette election distincte au regime presidentiel.',
            },
          ],
          correctChoiceIds: ['multi-good-1', 'multi-good-2'],
          explanation:
            'Le regime presidentiel combine separation plus stricte et election distincte des organes.',
          sourceChunkIds: [chunkTwoId],
          visuals: [
            {
              type: 'DIAGRAM',
              displayOrder: 0,
              title: 'Separation des pouvoirs',
              nodes: [
                { id: 'president', label: 'President' },
                { id: 'congres', label: 'Congres' },
              ],
              edges: [
                {
                  from: 'president',
                  to: 'congres',
                  label: 'organes distincts',
                },
              ],
              sourceChunkIds: [chunkTwoId],
            },
          ],
        },
      ],
    };

    const activity = await repository.createDiagnosticQuiz({
      studentId,
      subjectId,
      knowledgeUnitId,
      documentId,
      quiz,
    });

    const publicActivityJson = JSON.stringify(activity);
    expect(activity.version).toBe(3);
    expect(activity.questions).toHaveLength(2);
    expect(activity.questions[0].visuals?.[0].type).toBe('CHART');
    expect(activity.questions[1].selectionMode).toBe('multiple');
    expect(activity.questions[1].visuals?.[0].type).toBe('DIAGRAM');
    expect(publicActivityJson).not.toContain('correctChoiceId');
    expect(publicActivityJson).not.toContain('correctChoiceIds');
    expect(publicActivityJson).not.toContain('isCorrect');
    expect(publicActivityJson).not.toContain('explanation');
    expect(publicActivityJson).not.toContain('feedback');
    expect(publicActivityJson).not.toContain(
      'responsabilite politique du gouvernement devant le Parlement',
    );
    expect(publicActivityJson).not.toContain(
      'separation plus stricte des pouvoirs et une election distincte',
    );

    const visualCount = await prisma.questionVisual.count({
      where: {
        question: {
          sessionId: activity.sessionId,
        },
      },
    });
    const visualSourceCount = await prisma.questionVisualSource.count({
      where: {
        visual: {
          question: {
            sessionId: activity.sessionId,
          },
        },
      },
    });

    expect(visualCount).toBe(2);
    expect(visualSourceCount).toBe(2);

    const result = await repository.submitResult({
      studentId,
      sessionId: activity.sessionId,
      answers: [
        {
          questionId: activity.questions[0].id,
          choiceId: 'single-good',
        },
        {
          questionId: activity.questions[1].id,
          choiceIds: ['multi-good-1', 'multi-good-2'],
        },
      ],
    });

    expect(result.correctAnswers).toBe(2);
    expect(result.totalQuestions).toBe(2);
    expect(result.score).toBe(1);
    expect(result.items[0].selectedChoiceId).toBe('single-good');
    expect(result.items[0].correctChoiceId).toBe('single-good');
    expect(result.items[0].sources[0].text).toContain('regime parlementaire');
    expect(result.items[1].selectedChoiceIds).toEqual([
      'multi-good-1',
      'multi-good-2',
    ]);
    expect(result.items[1].correctChoiceIds).toEqual([
      'multi-good-1',
      'multi-good-2',
    ]);
    expect(result.items[1].partialScore).toBe(1);
    expect(result.items[1].sources[0].text).toContain('regime presidentiel');

    await expect(
      repository.submitResult({
        studentId,
        sessionId: activity.sessionId,
        answers: [
          {
            questionId: activity.questions[0].id,
            choiceId: 'single-good',
          },
          {
            questionId: activity.questions[1].id,
            choiceIds: ['multi-good-1', 'multi-good-2'],
          },
        ],
      }),
    ).rejects.toThrow('Activity session already completed');

    await expect(
      prisma.questionAnswerChoice.count({
        where: {
          answer: {
            sessionId: activity.sessionId,
          },
        },
      }),
    ).resolves.toBe(2);
  });
});

function assertDisposableDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (
    !databaseUrl.includes('localhost:55432') ||
    !databaseUrl.includes('revision_runtime_validation')
  ) {
    throw new Error(
      'RUN_PRISMA_INTEGRATION_TESTS requires the LOT-025F disposable local database',
    );
  }
}
