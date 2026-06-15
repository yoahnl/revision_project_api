import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';

export const REVISION_COACH_NEXT_ACTION_GENERATOR = Symbol(
  'REVISION_COACH_NEXT_ACTION_GENERATOR',
);

export interface RevisionCoachNextActionGenerator {
  generate(
    input: RevisionCoachNextActionInput,
  ): Promise<RevisionCoachNextActionDecision>;
}
