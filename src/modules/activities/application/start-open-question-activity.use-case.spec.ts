import type { RevisionRepository } from '../../revision/application/revision.repository';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import type { ActivitiesRepository } from './activities.repository';
import type { OpenQuestionGenerator } from './open-question-generator';
import { StartOpenQuestionActivityUseCase } from './start-open-question-activity.use-case';

describe('StartOpenQuestionActivityUseCase', () => {
  it('creates an open question activity for an owned knowledge unit', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const openQuestionGenerator = createOpenQuestionGenerator();
    const knowledgeUnit = new KnowledgeUnit({
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Séparation des pouvoirs',
      summary:
        'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle.',
    });
    revisionRepository.findKnowledgeUnits.mockResolvedValue([knowledgeUnit]);
    activitiesRepository.findOpenQuestionGenerationContext.mockResolvedValue({
      documentId: 'document-1',
      knowledgeUnit: Object.assign(knowledgeUnit, {
        difficulty: 'MEDIUM' as const,
        sourceChunkIds: ['chunk-1'],
      }),
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'La séparation des pouvoirs organise les fonctions de l’État.',
          pageNumber: null,
        },
      ],
    });
    openQuestionGenerator.generate.mockResolvedValue({
      version: 1,
      prompt:
        'Explique pourquoi la séparation des pouvoirs protège contre la concentration du pouvoir.',
      instructions:
        'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
      maxAnswerLength: 2500,
      sourceChunkIds: ['chunk-1'],
      metadata: {
        flowName: 'openQuestionGeneration',
        provider: 'google-genai',
        model: 'googleai/gemini-2.5-flash',
        promptVersion: 'open-question-generation-v1',
        schemaVersion: 'open-question-generation-v1',
        inputSize: 1200,
      },
    });
    activitiesRepository.createOpenQuestionActivity.mockResolvedValue(
      openQuestionActivity(),
    );

    const activity = await new StartOpenQuestionActivityUseCase(
      activitiesRepository,
      revisionRepository,
      openQuestionGenerator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    expect(activity).toEqual(openQuestionActivity());
    expect(
      activitiesRepository.findOpenQuestionGenerationContext.mock.calls,
    ).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
    ]);
    expect(openQuestionGenerator.generate.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnit: {
            id: 'unit-1',
            subjectId: 'subject-1',
            documentId: null,
            title: 'Séparation des pouvoirs',
            summary:
              'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle.',
            difficulty: 'MEDIUM',
            sourceChunkIds: ['chunk-1'],
          },
          chunks: [
            {
              id: 'chunk-1',
              index: 0,
              text: 'La séparation des pouvoirs organise les fonctions de l’État.',
              pageNumber: null,
            },
          ],
        },
      ],
    ]);
    expect(activitiesRepository.createOpenQuestionActivity.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          documentId: 'document-1',
          question: {
            prompt:
              'Explique pourquoi la séparation des pouvoirs protège contre la concentration du pouvoir.',
            instructions:
              'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
            maxAnswerLength: 2500,
            sourceChunkIds: ['chunk-1'],
            version: 1,
            metadata: {
              flowName: 'openQuestionGeneration',
              provider: 'google-genai',
              model: 'googleai/gemini-2.5-flash',
              promptVersion: 'open-question-generation-v1',
              schemaVersion: 'open-question-generation-v1',
              inputSize: 1200,
            },
          },
        },
      ],
    ]);
  });

  it('rejects a knowledge unit outside the student subject', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-2',
        title: 'Séparation des pouvoirs',
        summary: 'Résumé.',
      }),
    ]);

    await expect(
      new StartOpenQuestionActivityUseCase(
        activitiesRepository,
        revisionRepository,
        createOpenQuestionGenerator(),
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).rejects.toThrow('Knowledge unit does not belong to student subject');

    expect(
      activitiesRepository.createOpenQuestionActivity.mock.calls,
    ).toHaveLength(0);
  });
});

function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
  return {
    findDiagnosticQuizGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    submitResult: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    findOpenAnswerEvaluationContext: jest.fn(),
    saveOpenAnswerEvaluation: jest.fn(),
  };
}

function createOpenQuestionGenerator(): jest.Mocked<OpenQuestionGenerator> {
  return {
    generate: jest.fn(),
  };
}

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'session-1',
    type: 'open_question',
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt:
        'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
      instructions:
        'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}
