import type { RichClosedImageAssetLicense } from './rich-closed-image-assets';

export const RICH_CLOSED_EXERCISE_VERSION = 'rich-closed-question-v1';

export type RichClosedExerciseVersion = typeof RICH_CLOSED_EXERCISE_VERSION;

export const RICH_CLOSED_QUESTION_KINDS = [
  'single_choice',
  'multiple_choice',
  'matching',
  'ordering',
  'case_qualification',
  'error_detection',
  'timeline',
  'date_slider',
  'true_false_grid',
  'cause_consequence',
  'institution_matrix',
  'diagram_labeling',
  'calculation_mcq',
  'image_choice',
] as const;

export type RichClosedQuestionKind =
  (typeof RICH_CLOSED_QUESTION_KINDS)[number];

export type RichClosedDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export const RICH_CLOSED_COGNITIVE_SKILLS = [
  'memorization',
  'comprehension',
  'comparison',
  'classification',
  'case_application',
  'procedure',
  'error_detection',
  'causality',
] as const;

export type RichClosedCognitiveSkill =
  (typeof RICH_CLOSED_COGNITIVE_SKILLS)[number];

export interface RichClosedChoice {
  id: string;
  label: string;
  feedback?: string | null;
}

export interface RichClosedPublicChoice {
  id: string;
  label: string;
}

export interface RichClosedPair {
  leftId: string;
  rightId: string;
}

export interface RichClosedLabelItem {
  id: string;
  label: string;
}

export interface RichClosedTimelineEvent {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedTrueFalseRow {
  id: string;
  statement: string;
  context?: string | null;
}

export interface RichClosedTrueFalseValue {
  rowId: string;
  value: boolean;
}

export interface RichClosedCauseConsequenceItem {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedCauseConsequencePair {
  causeId: string;
  consequenceId: string;
}

export interface RichClosedInstitutionMatrixAxisItem {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedInstitutionMatrixOption {
  id: string;
  label: string;
}

export interface RichClosedInstitutionMatrixCell {
  id: string;
  rowId: string;
  columnId: string;
  prompt?: string | null;
  options: RichClosedInstitutionMatrixOption[];
}

export interface RichClosedInstitutionMatrixValue {
  cellId: string;
  optionId: string;
}

export type RichClosedDiagramLayout =
  | 'vertical_flow'
  | 'two_column'
  | 'cycle'
  | 'hierarchy'
  | 'plain';

export type RichClosedDiagramAnchorType = 'node' | 'edge';

export interface RichClosedDiagramGroup {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedDiagramNode {
  id: string;
  label: string;
  description?: string | null;
  groupId?: string | null;
}

export interface RichClosedDiagramEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string | null;
  description?: string | null;
}

export interface RichClosedDiagram {
  title?: string | null;
  description?: string | null;
  layout: RichClosedDiagramLayout;
  nodes: RichClosedDiagramNode[];
  groups?: RichClosedDiagramGroup[];
  edges: RichClosedDiagramEdge[];
}

export interface RichClosedDiagramLabelingOption {
  id: string;
  label: string;
}

export interface RichClosedDiagramLabelingSlot {
  id: string;
  anchorType: RichClosedDiagramAnchorType;
  anchorId: string;
  prompt: string;
  options: RichClosedDiagramLabelingOption[];
}

export interface RichClosedDiagramLabelingValue {
  slotId: string;
  optionId: string;
}

export interface RichClosedCalculationChoice {
  id: string;
  label: string;
  value: number;
}

export interface RichClosedImageChoiceOption {
  id: string;
  label: string;
  imageAssetId: string;
  altText: string;
  caption?: string | null;
  creditLabel?: string | null;
  license?: RichClosedImageAssetLicense;
}

export interface RichClosedCalculationParty {
  id: string;
  label: string;
  votes: number;
}

export interface RichClosedCalculationWorkedStep {
  id: string;
  label: string;
  detail: string;
  value?: number;
}

export interface RichClosedAbsoluteMajorityThresholdCalculation {
  mode: 'absolute_majority_threshold';
  validVotes: number;
}

export interface RichClosedLargestRemainderTargetPartySeatsCalculation {
  mode: 'largest_remainder_target_party_seats';
  totalSeats: number;
  targetPartyId: string;
  parties: RichClosedCalculationParty[];
}

export type RichClosedCalculationData =
  | RichClosedAbsoluteMajorityThresholdCalculation
  | RichClosedLargestRemainderTargetPartySeatsCalculation;

export interface RichClosedQuestionBase {
  id: string;
  questionKind: RichClosedQuestionKind;
  prompt: string;
  difficulty: RichClosedDifficulty;
  cognitiveSkill: RichClosedCognitiveSkill;
  sourceChunkIds: string[];
}

export interface RichClosedSingleChoiceQuestion extends RichClosedQuestionBase {
  questionKind: 'single_choice';
  choices: RichClosedChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedMultipleChoiceQuestion extends RichClosedQuestionBase {
  questionKind: 'multiple_choice';
  choices: RichClosedChoice[];
  minSelections: number;
  maxSelections: number;
  correctChoiceIds: string[];
  explanation: string;
}

export interface RichClosedMatchingQuestion extends RichClosedQuestionBase {
  questionKind: 'matching';
  leftItems: RichClosedLabelItem[];
  rightItems: RichClosedLabelItem[];
  correctPairs: RichClosedPair[];
  explanation: string;
}

export interface RichClosedOrderingQuestion extends RichClosedQuestionBase {
  questionKind: 'ordering';
  items: RichClosedLabelItem[];
  correctOrder: string[];
  explanation: string;
}

export interface RichClosedTimelineQuestion extends RichClosedQuestionBase {
  questionKind: 'timeline';
  instruction?: string | null;
  events: RichClosedTimelineEvent[];
  correctOrder: string[];
  explanation: string;
}

export interface RichClosedDateSliderQuestion extends RichClosedQuestionBase {
  questionKind: 'date_slider';
  instruction?: string | null;
  minYear: number;
  maxYear: number;
  step: number;
  correctYear: number;
  toleranceYears: number;
  explanation: string;
}

export interface RichClosedTrueFalseGridQuestion extends RichClosedQuestionBase {
  questionKind: 'true_false_grid';
  instruction?: string | null;
  rows: RichClosedTrueFalseRow[];
  correctValues: RichClosedTrueFalseValue[];
  explanation: string;
}

export interface RichClosedCauseConsequenceQuestion extends RichClosedQuestionBase {
  questionKind: 'cause_consequence';
  instruction?: string | null;
  causes: RichClosedCauseConsequenceItem[];
  consequences: RichClosedCauseConsequenceItem[];
  correctPairs: RichClosedCauseConsequencePair[];
  explanation: string;
}

export interface RichClosedInstitutionMatrixQuestion extends RichClosedQuestionBase {
  questionKind: 'institution_matrix';
  instruction?: string | null;
  rows: RichClosedInstitutionMatrixAxisItem[];
  columns: RichClosedInstitutionMatrixAxisItem[];
  cells: RichClosedInstitutionMatrixCell[];
  correctValues: RichClosedInstitutionMatrixValue[];
  explanation: string;
}

export interface RichClosedDiagramLabelingQuestion extends RichClosedQuestionBase {
  questionKind: 'diagram_labeling';
  instruction?: string | null;
  diagram: RichClosedDiagram;
  slots: RichClosedDiagramLabelingSlot[];
  correctValues: RichClosedDiagramLabelingValue[];
  explanation: string;
}

export interface RichClosedCalculationMcqQuestion extends RichClosedQuestionBase {
  questionKind: 'calculation_mcq';
  instruction?: string | null;
  scenario: string;
  calculation: RichClosedCalculationData;
  choices: RichClosedCalculationChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedImageChoiceQuestion extends RichClosedQuestionBase {
  questionKind: 'image_choice';
  instruction?: string | null;
  choices: RichClosedImageChoiceOption[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedCaseQualificationQuestion extends RichClosedQuestionBase {
  questionKind: 'case_qualification';
  caseText: string;
  choices: RichClosedChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedErrorDetectionQuestion extends RichClosedQuestionBase {
  questionKind: 'error_detection';
  statement: string;
  errorOptions: RichClosedChoice[];
  correctErrorId: string;
  explanation: string;
}

export type RichClosedQuestion =
  | RichClosedSingleChoiceQuestion
  | RichClosedMultipleChoiceQuestion
  | RichClosedMatchingQuestion
  | RichClosedOrderingQuestion
  | RichClosedCaseQualificationQuestion
  | RichClosedErrorDetectionQuestion
  | RichClosedTimelineQuestion
  | RichClosedDateSliderQuestion
  | RichClosedTrueFalseGridQuestion
  | RichClosedCauseConsequenceQuestion
  | RichClosedInstitutionMatrixQuestion
  | RichClosedDiagramLabelingQuestion
  | RichClosedCalculationMcqQuestion
  | RichClosedImageChoiceQuestion;

export interface RichClosedPublicQuestionBase {
  id: string;
  questionKind: RichClosedQuestionKind;
  prompt: string;
  difficulty: RichClosedDifficulty;
  cognitiveSkill: RichClosedCognitiveSkill;
  sourceChunkIds: string[];
}

export interface RichClosedPublicSingleChoiceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'single_choice';
  choices: RichClosedPublicChoice[];
}

export interface RichClosedPublicMultipleChoiceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'multiple_choice';
  choices: RichClosedPublicChoice[];
  minSelections: number;
  maxSelections: number;
}

export interface RichClosedPublicMatchingQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'matching';
  leftItems: RichClosedLabelItem[];
  rightItems: RichClosedLabelItem[];
}

export interface RichClosedPublicOrderingQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'ordering';
  items: RichClosedLabelItem[];
}

export interface RichClosedPublicTimelineQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'timeline';
  instruction?: string | null;
  events: RichClosedTimelineEvent[];
}

export interface RichClosedPublicDateSliderQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'date_slider';
  instruction?: string | null;
  minYear: number;
  maxYear: number;
  step: number;
  toleranceYears: number;
}

export interface RichClosedPublicTrueFalseGridQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'true_false_grid';
  instruction?: string | null;
  rows: RichClosedTrueFalseRow[];
}

export interface RichClosedPublicCauseConsequenceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'cause_consequence';
  instruction?: string | null;
  causes: RichClosedCauseConsequenceItem[];
  consequences: RichClosedCauseConsequenceItem[];
}

export interface RichClosedPublicInstitutionMatrixQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'institution_matrix';
  instruction?: string | null;
  rows: RichClosedInstitutionMatrixAxisItem[];
  columns: RichClosedInstitutionMatrixAxisItem[];
  cells: RichClosedInstitutionMatrixCell[];
}

export interface RichClosedPublicDiagramLabelingQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'diagram_labeling';
  instruction?: string | null;
  diagram: RichClosedDiagram;
  slots: RichClosedDiagramLabelingSlot[];
}

export interface RichClosedPublicCalculationMcqQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'calculation_mcq';
  instruction?: string | null;
  scenario: string;
  calculation: RichClosedCalculationData;
  choices: RichClosedCalculationChoice[];
}

export interface RichClosedPublicImageChoiceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'image_choice';
  instruction?: string | null;
  choices: RichClosedImageChoiceOption[];
}

export interface RichClosedPublicCaseQualificationQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'case_qualification';
  caseText: string;
  choices: RichClosedPublicChoice[];
}

export interface RichClosedPublicErrorDetectionQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'error_detection';
  statement: string;
  errorOptions: RichClosedPublicChoice[];
}

export type RichClosedPublicQuestion =
  | RichClosedPublicSingleChoiceQuestion
  | RichClosedPublicMultipleChoiceQuestion
  | RichClosedPublicMatchingQuestion
  | RichClosedPublicOrderingQuestion
  | RichClosedPublicCaseQualificationQuestion
  | RichClosedPublicErrorDetectionQuestion
  | RichClosedPublicTimelineQuestion
  | RichClosedPublicDateSliderQuestion
  | RichClosedPublicTrueFalseGridQuestion
  | RichClosedPublicCauseConsequenceQuestion
  | RichClosedPublicInstitutionMatrixQuestion
  | RichClosedPublicDiagramLabelingQuestion
  | RichClosedPublicCalculationMcqQuestion
  | RichClosedPublicImageChoiceQuestion;

export type RichClosedAnswer =
  | {
      questionId: string;
      questionKind: 'single_choice';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'case_qualification';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'multiple_choice';
      choiceIds: string[];
    }
  | {
      questionId: string;
      questionKind: 'matching';
      pairs: RichClosedPair[];
    }
  | {
      questionId: string;
      questionKind: 'ordering';
      orderedIds: string[];
    }
  | {
      questionId: string;
      questionKind: 'timeline';
      orderedEventIds: string[];
    }
  | {
      questionId: string;
      questionKind: 'date_slider';
      year: number;
    }
  | {
      questionId: string;
      questionKind: 'true_false_grid';
      values: RichClosedTrueFalseValue[];
    }
  | {
      questionId: string;
      questionKind: 'cause_consequence';
      pairs: RichClosedCauseConsequencePair[];
    }
  | {
      questionId: string;
      questionKind: 'institution_matrix';
      values: RichClosedInstitutionMatrixValue[];
    }
  | {
      questionId: string;
      questionKind: 'diagram_labeling';
      values: RichClosedDiagramLabelingValue[];
    }
  | {
      questionId: string;
      questionKind: 'calculation_mcq';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'image_choice';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'error_detection';
      errorId: string;
    };

export interface RichClosedCorrection {
  questionId: string;
  questionKind: RichClosedQuestionKind;
  isCorrect: boolean;
  partialScore?: number;
  explanation: string;
}

export type RichClosedCorrectionPayload =
  | { correctChoiceId: string }
  | { correctChoiceIds: string[] }
  | { correctPairs: RichClosedPair[] }
  | { correctValues: RichClosedTrueFalseValue[] }
  | { correctPairs: RichClosedCauseConsequencePair[] }
  | { correctValues: RichClosedInstitutionMatrixValue[] }
  | { correctValues: RichClosedDiagramLabelingValue[] }
  | {
      correctChoiceId: string;
      expectedValue: number;
      workedSteps: RichClosedCalculationWorkedStep[];
    }
  | { correctOrder: string[] }
  | { correctYear: number; minAcceptedYear: number; maxAcceptedYear: number }
  | { correctErrorId: string };

export interface RichClosedCorrectionItem {
  questionId: string;
  questionKind: RichClosedQuestionKind;
  prompt: string;
  submittedAnswer: RichClosedAnswer | null;
  isCorrect: boolean;
  partialScore: number;
  explanation: string;
  sourceChunkIds: string[];
  correction: RichClosedCorrectionPayload;
}

export interface RichClosedExerciseResult {
  sessionId: string;
  type: 'rich_closed_exercise';
  status: 'completed';
  subjectId?: string;
  documentId?: string | null;
  knowledgeUnitId?: string;
  createdAt?: Date;
  completedAt?: Date;
  durationSeconds?: number | null;
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  items: RichClosedCorrectionItem[];
}

export interface RichClosedExerciseHistoryResponse {
  items: RichClosedExerciseHistoryItem[];
}

export interface RichClosedExerciseHistoryItem {
  id: string;
  sessionId: string;
  type: 'rich_closed_exercise';
  status: 'completed';
  title: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnit: {
    id: string;
    title: string;
  };
  course: {
    id: string;
    title: string;
  };
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  completedAt: Date;
  resultPath: string;
}

export interface RichClosedExercise {
  id: string;
  version: RichClosedExerciseVersion;
  title: string;
  subjectId?: string;
  documentId?: string | null;
  knowledgeUnitId?: string;
  questions: RichClosedQuestion[];
}

export interface RichClosedPublicExercise {
  id: string;
  version: RichClosedExerciseVersion;
  title: string;
  subjectId?: string;
  documentId?: string | null;
  knowledgeUnitId?: string;
  questions: RichClosedPublicQuestion[];
}

export interface RichClosedPublicExerciseEnvelope extends RichClosedPublicExercise {
  sessionId: string;
  type: 'rich_closed_exercise';
}

export type RichClosedExerciseValidationSeverity = 'error' | 'warning';

export interface RichClosedExerciseValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: RichClosedExerciseValidationSeverity;
}

export interface RichClosedExerciseValidationResult {
  accepted: boolean;
  issues: RichClosedExerciseValidationIssue[];
}
