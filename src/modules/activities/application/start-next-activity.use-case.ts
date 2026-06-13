import { Inject, Injectable } from '@nestjs/common';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../revision/application/revision.repository';
import { AdaptivePlanService } from '../../revision/domain/adaptive-plan.service';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type DiagnosticQuizActivity,
} from './activities.repository';

@Injectable()
export class StartNextActivityUseCase {
  constructor(
    private readonly adaptivePlanService: AdaptivePlanService,
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId?: string;
  }): Promise<DiagnosticQuizActivity> {
    void this.adaptivePlanService;
    const knowledgeUnitId =
      input.knowledgeUnitId ?? (await this.chooseKnowledgeUnit(input));

    return this.activitiesRepository.createDiagnosticQuiz({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId,
    });
  }

  private async chooseKnowledgeUnit(input: {
    studentId: string;
    subjectId: string;
  }): Promise<string> {
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

    return next.unit.id;
  }
}
