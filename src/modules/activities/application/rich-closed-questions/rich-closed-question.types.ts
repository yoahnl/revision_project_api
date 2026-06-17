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
  | RichClosedCauseConsequenceQuestion;

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
  | RichClosedPublicCauseConsequenceQuestion;

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
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  items: RichClosedCorrectionItem[];
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
