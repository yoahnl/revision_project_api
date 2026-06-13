import { Inject, Injectable } from '@nestjs/common';
import {
  SUBJECTS_REPOSITORY,
  type SubjectsRepository,
} from '../../subjects/application/subjects.repository';
import { AdaptivePlanService } from '../domain/adaptive-plan.service';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from './revision.repository';

export interface TodayPlanDto {
  generatedAt: Date;
  items: TodayPlanItemDto[];
}

export interface TodayPlanItemDto {
  subjectId: string;
  subjectName: string;
  knowledgeUnitId: string;
  knowledgeUnitTitle: string;
  masteryScore: number;
  action: 'diagnostic_quiz';
  estimatedMinutes: number;
  reason: string;
}

@Injectable()
export class GetTodayPlanUseCase {
  constructor(
    private readonly adaptivePlanService: AdaptivePlanService,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    now?: Date;
  }): Promise<TodayPlanDto> {
    const now = input.now ?? new Date();
    const goal = await this.revisionRepository.getActiveGoal(input.studentId);

    if (!goal) {
      return { generatedAt: now, items: [] };
    }

    const [subjects, knowledgeUnits, masteryStates] = await Promise.all([
      this.subjectsRepository.findByStudent(input.studentId),
      this.revisionRepository.findKnowledgeUnits(input.studentId),
      this.revisionRepository.findMasteryStates(input.studentId),
    ]);
    const subjectById = new Map(
      subjects.map((subject) => [subject.id, subject]),
    );
    const unitById = new Map(knowledgeUnits.map((unit) => [unit.id, unit]));
    const masteryByUnitId = new Map(
      masteryStates.map((mastery) => [mastery.knowledgeUnitId, mastery]),
    );
    const plan = this.adaptivePlanService.buildTodayPlan({
      now,
      goal,
      subjects,
      knowledgeUnits,
      masteryStates,
    });

    return {
      generatedAt: plan.generatedAt,
      items: plan.items.map((item) => {
        const subject = subjectById.get(item.subjectId);
        const unit = unitById.get(item.knowledgeUnitId);

        if (!subject || !unit) {
          throw new Error('Today plan references missing data');
        }

        return {
          subjectId: item.subjectId,
          subjectName: subject.name,
          knowledgeUnitId: item.knowledgeUnitId,
          knowledgeUnitTitle: unit.title,
          masteryScore: masteryByUnitId.get(item.knowledgeUnitId)?.score ?? 0,
          action: item.activityType,
          estimatedMinutes: item.estimatedMinutes,
          reason: item.reason,
        };
      }),
    };
  }
}
