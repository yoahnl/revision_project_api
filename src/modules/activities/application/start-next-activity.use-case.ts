import { Inject, Injectable } from '@nestjs/common';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../revision/application/revision.repository';
import { AdaptivePlanService } from '../../revision/domain/adaptive-plan.service';
import type { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type DiagnosticQuizActivity,
} from './activities.repository';
import {
  DIAGNOSTIC_QUIZ_GENERATOR,
  type DiagnosticQuizGenerator,
} from './diagnostic-quiz-generator';

@Injectable()
export class StartNextActivityUseCase {
  constructor(
    private readonly adaptivePlanService: AdaptivePlanService,
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
    @Inject(DIAGNOSTIC_QUIZ_GENERATOR)
    private readonly diagnosticQuizGenerator: DiagnosticQuizGenerator,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId?: string;
  }): Promise<DiagnosticQuizActivity> {
    void this.adaptivePlanService;
    const knowledgeUnitId = input.knowledgeUnitId;
    const knowledgeUnit = knowledgeUnitId
      ? await this.findKnowledgeUnit({
          ...input,
          knowledgeUnitId,
        })
      : await this.chooseKnowledgeUnit(input);
    const quiz = await this.diagnosticQuizGenerator.generate({ knowledgeUnit });

    return this.activitiesRepository.createDiagnosticQuiz({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: knowledgeUnit.id,
      quiz,
    });
  }

  private async findKnowledgeUnit(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<KnowledgeUnit> {
    const knowledgeUnits = await this.revisionRepository.findKnowledgeUnits(
      input.studentId,
    );
    const knowledgeUnit = knowledgeUnits.find(
      (unit) =>
        unit.id === input.knowledgeUnitId && unit.subjectId === input.subjectId,
    );

    if (!knowledgeUnit) {
      throw new Error('Knowledge unit does not belong to student subject');
    }

    return knowledgeUnit;
  }

  private async chooseKnowledgeUnit(input: {
    studentId: string;
    subjectId: string;
  }): Promise<KnowledgeUnit> {
    const [knowledgeUnits, masteryStates] = await Promise.all([
      this.revisionRepository.findKnowledgeUnits(input.studentId),
      this.revisionRepository.findMasteryStates(input.studentId),
    ]);
    const masteryByUnit = new Map(
      masteryStates.map((mastery) => [mastery.knowledgeUnitId, mastery]),
    );
    const [next] = knowledgeUnits
      .filter((unit) => unit.subjectId === input.subjectId)
      .map((unit) => ({
        unit,
        mastery: masteryByUnit.get(unit.id),
      }))
      .sort((a, b) => {
        const scoreDelta = (a.mastery?.score ?? 0) - (b.mastery?.score ?? 0);

        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        const aPracticedAt = a.mastery?.lastPracticedAt?.getTime() ?? 0;
        const bPracticedAt = b.mastery?.lastPracticedAt?.getTime() ?? 0;

        return aPracticedAt - bPracticedAt;
      });

    if (!next) {
      throw new Error('No knowledge unit available for subject');
    }

    return next.unit;
  }
}
