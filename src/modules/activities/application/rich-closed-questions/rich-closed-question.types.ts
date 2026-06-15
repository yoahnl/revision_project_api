export const RICH_CLOSED_EXERCISE_VERSION = 'rich-closed-question-v1';

export type RichClosedExerciseVersion = typeof RICH_CLOSED_EXERCISE_VERSION;

export const RICH_CLOSED_QUESTION_KINDS = [
  'single_choice',
  'multiple_choice',
  'matching',
  'ordering',
  'case_qualification',
  'error_detection',
] as const;

export type RichClosedQuestionKind =
  (typeof RICH_CLOSED_QUESTION_KINDS)[number];

export type RichClosedDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export type RichClosedCognitiveSkill =
  | 'memorization'
  | 'comprehension'
  | 'comparison'
  | 'classification'
  | 'case_application'
  | 'procedure'
  | 'error_detection'
  | 'causality';

export interface RichClosedChoice {
  id: string;
  label: string;
  feedback?: string | null;
}

export interface RichClosedPair {
  leftId: string;
  rightId: string;
}

export interface RichClosedLabelItem {
  id: string;
  label: string;
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
  | RichClosedErrorDetectionQuestion;

export type RichClosedPublicQuestion =
  | Omit<RichClosedSingleChoiceQuestion, 'correctChoiceId' | 'explanation'>
  | Omit<RichClosedMultipleChoiceQuestion, 'correctChoiceIds' | 'explanation'>
  | Omit<RichClosedMatchingQuestion, 'correctPairs' | 'explanation'>
  | Omit<RichClosedOrderingQuestion, 'correctOrder' | 'explanation'>
  | Omit<RichClosedCaseQualificationQuestion, 'correctChoiceId' | 'explanation'>
  | Omit<RichClosedErrorDetectionQuestion, 'correctErrorId' | 'explanation'>;

export type RichClosedAnswer =
  | {
      questionId: string;
      questionKind: 'single_choice' | 'case_qualification';
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
