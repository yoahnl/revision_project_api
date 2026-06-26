import { Inject, Injectable } from '@nestjs/common';
import {
  SUBJECTS_REPOSITORY,
  type SubjectsRepository,
} from '../../subjects/application/subjects.repository';
import {
  AdaptivePlanService,
  type RevisionPlanStartPayload,
  type TodayPlanActionType,
  type TodayPlanReasonCode,
} from '../domain/adaptive-plan.service';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from './revision.repository';
import {
  buildTodayEmptyState,
  buildTodayPlanItemDisplay,
  buildTodayWeeklyObjective,
  resolveTodayPlanContinuationItemIds,
  resolveTodayPlanItemRole,
  resolveTodayPlanPrimaryItemId,
  resolveTodayPlanReason,
  type TodayEmptyStateDto,
  type TodayPlanItemDisplayDto,
  type TodayPlanItemRole,
  type TodayWeeklyObjectiveDto,
} from './today-plan-display.presenter';

export interface TodayPlanDto {
  generatedAt: Date;
  items: TodayPlanItemDto[];
  primaryItemId: string | null;
  continuationItemIds: string[];
  weeklyObjective: TodayWeeklyObjectiveDto | null;
  emptyState: TodayEmptyStateDto;
}

export interface TodayPlanItemDto {
  id: string;
  subjectId: string;
  subjectName: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  knowledgeUnitTitle: string | null;
  masteryScore: number | null;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  priority: number;
  reasonCode: TodayPlanReasonCode;
  reason: string;
  startPayload: RevisionPlanStartPayload;
  role: TodayPlanItemRole;
  display: TodayPlanItemDisplayDto;
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
      return {
        generatedAt: now,
        items: [],
        primaryItemId: null,
        continuationItemIds: [],
        weeklyObjective: null,
        emptyState: buildTodayEmptyState(),
      };
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

    const items = plan.items.map((item, index) => {
      const subject = subjectById.get(item.subjectId);
      const unit = unitById.get(item.knowledgeUnitId);

      if (!subject || !unit) {
        throw new Error('Today plan references missing data');
      }

      const role = resolveTodayPlanItemRole(index);
      const reason = resolveTodayPlanReason(item.reasonCode);

      return {
        id: item.id,
        subjectId: item.subjectId,
        subjectName: subject.name,
        documentId: item.documentId,
        knowledgeUnitId: item.knowledgeUnitId,
        knowledgeUnitTitle: unit.title,
        masteryScore: masteryByUnitId.get(item.knowledgeUnitId)?.score ?? null,
        action: item.action,
        estimatedMinutes: item.estimatedMinutes,
        priority: item.priority,
        reasonCode: item.reasonCode,
        reason,
        startPayload: item.startPayload,
        role,
        display: buildTodayPlanItemDisplay({
          subjectId: item.subjectId,
          subjectName: subject.name,
          knowledgeUnitTitle: unit.title,
          action: item.action,
          estimatedMinutes: item.estimatedMinutes,
          reasonCode: item.reasonCode,
          startPayload: item.startPayload,
          role,
        }),
      };
    });

    return {
      generatedAt: plan.generatedAt,
      items,
      primaryItemId: resolveTodayPlanPrimaryItemId(items),
      continuationItemIds: resolveTodayPlanContinuationItemIds(items),
      weeklyObjective: buildTodayWeeklyObjective(goal.weeklyMinutes),
      emptyState: buildTodayEmptyState(),
    };
  }
}
