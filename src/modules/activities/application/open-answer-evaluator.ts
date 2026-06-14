import type {
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationKnowledgeUnit,
} from './diagnostic-quiz-generator';
import type { OpenQuestionGenerationMetadata } from './open-question-generator';

export interface OpenAnswerEvaluationQuestion {
  id: string;
  prompt: string;
  instructions: string | null;
  sourceChunkIds: string[];
}

export interface OpenAnswerEvaluationInput {
  studentId?: string;
  subjectId: string;
  documentId?: string | null;
  activitySessionId: string;
  knowledgeUnit: DiagnosticQuizGenerationKnowledgeUnit;
  question: OpenAnswerEvaluationQuestion;
  answerText: string;
  chunks?: DiagnosticQuizGenerationChunk[];
}

export interface GeneratedOpenAnswerEvaluation {
  status: 'READY';
  score: number;
  maxScore: number;
  feedback: string;
  presentPoints: string[];
  missingPoints: string[];
  errors: string[];
  modelAnswer: string;
  advice: string;
  sourceChunkIds: string[];
  metadata?: OpenQuestionGenerationMetadata;
}

export const OPEN_ANSWER_EVALUATION_SOURCE_INVALID =
  'OPEN_ANSWER_EVALUATION_SOURCE_INVALID';
export const OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT =
  'OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT';
export const OPEN_ANSWER_EVALUATION_INVALID = 'OPEN_ANSWER_EVALUATION_INVALID';
export const OPEN_ANSWER_EVALUATION_FAILED = 'OPEN_ANSWER_EVALUATION_FAILED';

export const OPEN_ANSWER_EVALUATOR = Symbol('OPEN_ANSWER_EVALUATOR');

export interface OpenAnswerEvaluator {
  evaluate(
    input: OpenAnswerEvaluationInput,
  ): Promise<GeneratedOpenAnswerEvaluation>;
}
