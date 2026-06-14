import type { RevisionRepository } from '../../revision/application/revision.repository';
import { AdaptivePlanService } from '../../revision/domain/adaptive-plan.service';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { MasteryState } from '../../revision/domain/mastery-state.entity';
import type { DiagnosticQuizGenerator } from './diagnostic-quiz-generator';
import { StartNextActivityUseCase } from './start-next-activity.use-case';

describe('StartNextActivityUseCase', () => {
  it('returns a diagnostic quiz activity contract for an explicit knowledge unit', async () => {
    const repository = createActivitiesRepository();
    const generator = createDiagnosticQuizGenerator();
    const revisionRepository = createRevisionRepository();
    const knowledgeUnit = new KnowledgeUnit({
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Pouvoir constituant derive',
      summary:
        'La revision constitutionnelle est encadree par la Constitution de 1958.',
    });
    revisionRepository.findKnowledgeUnits.mockResolvedValue([knowledgeUnit]);

    const activity = await new StartNextActivityUseCase(
      new AdaptivePlanService(),
      repository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    expect(activity.sessionId).toBe('session-1');
    expect(activity.questions).toHaveLength(1);
    expect(repository.createDiagnosticQuiz).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      quiz: generatedQuiz(),
    });
    expect(generator.generate.mock.calls[0]?.[0]).toEqual({
      knowledgeUnit,
      questionCount: 10,
    });
    expect(repository.findDiagnosticQuizGenerationContext).toHaveBeenCalledWith(
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      },
    );
  });

  it('uses sourced v2 generation context when chunks are available', async () => {
    const repository = createActivitiesRepository();
    const generator = createDiagnosticQuizGenerator();
    const revisionRepository = createRevisionRepository();
    const knowledgeUnit = new KnowledgeUnit({
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Pouvoir constituant derive',
      summary:
        'La revision constitutionnelle est encadree par la Constitution de 1958.',
    });
    revisionRepository.findKnowledgeUnits.mockResolvedValue([knowledgeUnit]);
    repository.findDiagnosticQuizGenerationContext.mockResolvedValue({
      documentId: 'document-1',
      knowledgeUnit: Object.assign(knowledgeUnit, {
        difficulty: 'MEDIUM' as const,
        sourceChunkIds: ['chunk-1'],
      }),
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'Article 89 encadre la revision constitutionnelle.',
          pageNumber: null,
        },
      ],
    });

    await new StartNextActivityUseCase(
      new AdaptivePlanService(),
      repository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      questionCount: 12,
    });

    const [generationInput] = generator.generate.mock.calls[0] ?? [];
    expect(generationInput?.subjectId).toBe('subject-1');
    expect(generationInput?.documentId).toBe('document-1');
    expect(generationInput?.knowledgeUnit.id).toBe('unit-1');
    expect(generationInput?.knowledgeUnit.sourceChunkIds).toEqual(['chunk-1']);
    expect(generationInput?.chunks).toEqual([
      {
        id: 'chunk-1',
        index: 0,
        text: 'Article 89 encadre la revision constitutionnelle.',
        pageNumber: null,
      },
    ]);
    expect(generationInput?.questionCount).toBe(12);
    expect(repository.createDiagnosticQuiz).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      documentId: 'document-1',
      quiz: generatedQuiz(),
    });
  });

  it('chooses the lowest mastery knowledge unit when none is provided', async () => {
    const repository = createActivitiesRepository();
    const generator = createDiagnosticQuizGenerator();
    const revisionRepository = createRevisionRepository();
    const weakestUnit = new KnowledgeUnit({
      id: 'unit-2',
      subjectId: 'subject-1',
      title: 'Tissus',
      summary: 'Bases',
    });
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-1',
        title: 'Cellules',
        summary: 'Bases',
      }),
      weakestUnit,
    ]);
    revisionRepository.findMasteryStates.mockResolvedValue([
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.8,
        lastPracticedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-2',
        score: 0.2,
        lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
      }),
    ]);

    await new StartNextActivityUseCase(
      new AdaptivePlanService(),
      repository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.createDiagnosticQuiz).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-2',
      quiz: generatedQuiz(),
    });
    expect(generator.generate.mock.calls[0]?.[0]).toEqual({
      knowledgeUnit: weakestUnit,
      questionCount: 10,
    });
  });

  it('passes an explicit legacy question count to the generator', async () => {
    const repository = createActivitiesRepository();
    const generator = createDiagnosticQuizGenerator();
    const revisionRepository = createRevisionRepository();
    const knowledgeUnit = new KnowledgeUnit({
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Controle de constitutionnalite',
      summary: 'Le Conseil constitutionnel controle certaines normes.',
    });
    revisionRepository.findKnowledgeUnits.mockResolvedValue([knowledgeUnit]);

    await new StartNextActivityUseCase(
      new AdaptivePlanService(),
      repository,
      revisionRepository,
      generator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      questionCount: 15,
    });

    expect(generator.generate.mock.calls[0]?.[0]).toEqual({
      knowledgeUnit,
      questionCount: 15,
    });
  });

  it('rejects subjects without available knowledge units', async () => {
    const repository = createActivitiesRepository();
    const generator = createDiagnosticQuizGenerator();
    const revisionRepository = createRevisionRepository();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([]);

    await expect(
      new StartNextActivityUseCase(
        new AdaptivePlanService(),
        repository,
        revisionRepository,
        generator,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('No knowledge unit available for subject');

    expect(repository.createDiagnosticQuiz).not.toHaveBeenCalled();
    expect(generator.generate.mock.calls).toHaveLength(0);
  });

  it('rejects explicit knowledge units outside the student subject', async () => {
    const repository = createActivitiesRepository();
    const generator = createDiagnosticQuizGenerator();
    const revisionRepository = createRevisionRepository();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-2',
        title: 'Controle de constitutionnalite',
        summary: 'Le Conseil constitutionnel controle certaines normes.',
      }),
    ]);

    await expect(
      new StartNextActivityUseCase(
        new AdaptivePlanService(),
        repository,
        revisionRepository,
        generator,
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).rejects.toThrow('Knowledge unit does not belong to student subject');

    expect(generator.generate.mock.calls).toHaveLength(0);
    expect(repository.createDiagnosticQuiz).not.toHaveBeenCalled();
  });
});

function createActivitiesRepository() {
  return {
    createDiagnosticQuiz: jest.fn().mockResolvedValue({
      sessionId: 'session-1',
      type: 'diagnostic_quiz',
      title: 'Diagnostic rapide',
      questions: [
        {
          id: 'question-1',
          prompt:
            'Quelle structure est principalement responsable de la contraction cardiaque ?',
          choices: [
            { id: 'a', label: 'Myocarde' },
            { id: 'b', label: 'Pericarde' },
          ],
        },
      ],
    }),
    submitResult: jest.fn(),
    findDiagnosticQuizGenerationContext: jest.fn().mockResolvedValue(null),
  };
}

function createDiagnosticQuizGenerator(): jest.Mocked<DiagnosticQuizGenerator> {
  return {
    generate: jest.fn().mockResolvedValue(generatedQuiz()),
  };
}

function generatedQuiz() {
  return {
    title: 'Diagnostic constitutionnel',
    questions: [
      {
        prompt:
          'Quel principe limite le pouvoir constituant derive dans la Constitution de 1958 ?',
        choices: [
          { id: 'a', label: 'La forme republicaine du gouvernement' },
          { id: 'b', label: 'La superiorite du pouvoir reglementaire' },
        ],
        correctChoiceId: 'a',
        explanation:
          'La Constitution interdit de reviser la forme republicaine du gouvernement.',
      },
    ],
  };
}

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn().mockResolvedValue([]),
    findMasteryStates: jest.fn().mockResolvedValue([]),
    upsertMastery: jest.fn(),
  };
}
