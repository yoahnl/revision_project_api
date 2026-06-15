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

export interface TodayPlanDto {
  generatedAt: Date;
  items: TodayPlanItemDto[];
}

export interface TodayPlanItemDto {
  id: string;
  subjectId: string;
  subjectName: string;
  knowledgeUnitId: string | null;
  knowledgeUnitTitle: string | null;
  masteryScore: number | null;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  priority: number;
  reasonCode: TodayPlanReasonCode;
  reason: string;
  startPayload: RevisionPlanStartPayload;
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
          id: item.id,
          subjectId: item.subjectId,
          subjectName: subject.name,
          knowledgeUnitId: item.knowledgeUnitId,
          knowledgeUnitTitle: unit.title,
          masteryScore:
            masteryByUnitId.get(item.knowledgeUnitId)?.score ?? null,
          action: item.action,
          estimatedMinutes: item.estimatedMinutes,
          priority: item.priority,
          reasonCode: item.reasonCode,
          reason: toReason(item.reasonCode),
          startPayload: item.startPayload,
        };
      }),
    };
  }
}

function toReason(reasonCode: TodayPlanReasonCode): string {
  const reasons: Record<TodayPlanReasonCode, string> = {
    LOW_MASTERY: 'À revoir en priorité : cette notion est encore fragile.',
    STALE_PRACTICE:
      'À entretenir : cette notion n’a pas été pratiquée récemment.',
    HIGH_PRIORITY_SUBJECT: 'Matière prioritaire dans ton objectif de révision.',
    MIX_ACTIVITY_TYPE: 'Change de format pour renforcer la mémorisation.',
    START_REVISION_SESSION:
      'Lance une session guidée pour enchaîner plusieurs exercices.',
    CONTINUE_PROGRESS: 'Continue ta progression sur cette notion.',
  };

  return reasons[reasonCode];
}
