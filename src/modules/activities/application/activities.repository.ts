import type {
  DiagnosticQuizDifficulty,
  DiagnosticQuizVisualType,
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationKnowledgeUnit,
  GeneratedDiagnosticQuiz,
} from './diagnostic-quiz-generator';
import type {
  GeneratedOpenAnswerEvaluation,
  OpenAnswerEvaluationQuestion,
} from './open-answer-evaluator';
import type { OpenQuestionGenerationMetadata } from './open-question-generator';

export interface ActivityQuestionChoice {
  id: string;
  label: string;
}

export interface ActivityQuestion {
  id: string;
  knowledgeUnitId?: string;
  prompt: string;
  difficulty?: DiagnosticQuizDifficulty | null;
  selectionMode?: 'single' | 'multiple';
  minSelections?: number | null;
  maxSelections?: number | null;
  choices: ActivityQuestionChoice[];
  sources?: ActivityQuestionSource[];
  visuals?: ActivityQuestionVisual[];
}

export interface ActivityQuestionSource {
  chunkId: string;
  pageNumber: number | null;
  index: number;
}

export type ActivityQuestionVisual =
  | ActivityQuestionImageVisual
  | ActivityQuestionChartVisual
  | ActivityQuestionDiagramVisual;

export interface ActivityQuestionVisualBase {
  id?: string;
  type: DiagnosticQuizVisualType;
  displayOrder: number;
  sources: ActivityQuestionSource[];
}

export interface ActivityQuestionImageVisual extends ActivityQuestionVisualBase {
  type: 'IMAGE';
  imageUrl: string;
  altText: string;
  caption?: string | null;
}

export interface ActivityQuestionChartVisual extends ActivityQuestionVisualBase {
  type: 'CHART';
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  description?: string | null;
  data: Array<Record<string, string | number | null>>;
  xKey?: string | null;
  yKeys?: string[] | null;
}

export interface ActivityQuestionDiagramVisual extends ActivityQuestionVisualBase {
  type: 'DIAGRAM';
  title: string;
  description?: string | null;
  nodes: Array<{
    id: string;
    label: string;
  }>;
  edges?: Array<{
    from: string;
    to: string;
    label?: string | null;
  }>;
}

export interface DiagnosticQuizActivity {
  sessionId: string;
  type: 'diagnostic_quiz';
  title: string;
  version?: number;
  documentId?: string | null;
  subjectId?: string;
  questions: ActivityQuestion[];
}

export interface OpenQuestionActivitySource {
  chunkId: string;
  pageNumber: number | null;
  index: number;
}

export interface OpenQuestionActivity {
  sessionId: string;
  type: 'open_question';
  version: number;
  subjectId: string;
  documentId?: string | null;
  knowledgeUnitId: string;
  question: {
    id: string;
    prompt: string;
    instructions: string | null;
    maxAnswerLength: number;
    sources: OpenQuestionActivitySource[];
  };
}

export interface OpenQuestionDraft {
  prompt: string;
  instructions: string | null;
  maxAnswerLength: number;
  sourceChunkIds: string[];
  version: number;
  metadata?: OpenQuestionGenerationMetadata;
}

export const ACTIVITIES_REPOSITORY = Symbol('ACTIVITIES_REPOSITORY');

export interface DiagnosticQuizGenerationContext {
  documentId: string | null;
  knowledgeUnit: DiagnosticQuizGenerationKnowledgeUnit;
  chunks: DiagnosticQuizGenerationChunk[];
}

export interface ActivityQuestionCorrectionSource {
  chunkId: string;
  text: string;
  pageNumber: number | null;
  index: number;
}

export interface ActivityQuestionChoiceFeedback {
  choiceId: string;
  feedback: string;
}

export interface ActivityQuestionCorrectionItem {
  questionId: string;
  knowledgeUnitId: string;
  prompt: string;
  selectedChoiceId?: string;
  selectedChoiceIds?: string[];
  correctChoiceId?: string;
  correctChoiceIds?: string[];
  isCorrect: boolean;
  partialScore?: number;
  explanation: string;
  choiceFeedback: ActivityQuestionChoiceFeedback[];
  sources: ActivityQuestionCorrectionSource[];
}

export interface DiagnosticQuizSubmissionResult {
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  knowledgeUnitId: string;
  items: ActivityQuestionCorrectionItem[];
}

export interface OpenAnswerSubmissionResult {
  sessionId: string;
  type: 'open_question';
  status: 'submitted';
  evaluation: {
    id: string;
    status: 'PENDING' | 'READY' | 'FAILED';
    score: number | null;
    maxScore: number | null;
    feedback: string | null;
    presentPoints: unknown[];
    missingPoints: unknown[];
    errors: unknown[];
    modelAnswer: string | null;
    advice: string | null;
    sources: ActivityQuestionCorrectionSource[];
  };
}

export interface OpenAnswerEvaluationContext {
  sessionId: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnit: DiagnosticQuizGenerationKnowledgeUnit;
  question: OpenAnswerEvaluationQuestion;
  chunks: DiagnosticQuizGenerationChunk[];
}

export type OpenAnswerEvaluationDraft =
  | GeneratedOpenAnswerEvaluation
  | {
      status: 'FAILED';
      errorCode: string;
      metadata?: OpenQuestionGenerationMetadata;
    };

export interface ActivitiesRepository {
  findDiagnosticQuizGenerationContext(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<DiagnosticQuizGenerationContext | null>;

  findOpenQuestionGenerationContext(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<DiagnosticQuizGenerationContext | null>;

  createDiagnosticQuiz(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
    documentId?: string | null;
    quiz: GeneratedDiagnosticQuiz;
  }): Promise<DiagnosticQuizActivity>;

  createOpenQuestionActivity(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
    documentId?: string | null;
    question: OpenQuestionDraft;
  }): Promise<OpenQuestionActivity>;

  submitResult(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{
      questionId: string;
      choiceId?: string;
      choiceIds?: string[];
    }>;
  }): Promise<DiagnosticQuizSubmissionResult>;

  findOpenAnswerEvaluationContext(input: {
    studentId: string;
    sessionId: string;
  }): Promise<OpenAnswerEvaluationContext>;

  saveOpenAnswerEvaluation(input: {
    studentId: string;
    sessionId: string;
    answerText: string;
    evaluation: OpenAnswerEvaluationDraft;
  }): Promise<OpenAnswerSubmissionResult>;
}
