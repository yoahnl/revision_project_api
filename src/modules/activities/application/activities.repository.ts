import type {
  DiagnosticQuizDifficulty,
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationKnowledgeUnit,
  GeneratedDiagnosticQuiz,
} from './diagnostic-quiz-generator';

export interface ActivityQuestionChoice {
  id: string;
  label: string;
}

export interface ActivityQuestion {
  id: string;
  knowledgeUnitId?: string;
  prompt: string;
  difficulty?: DiagnosticQuizDifficulty | null;
  choices: ActivityQuestionChoice[];
  sources?: ActivityQuestionSource[];
}

export interface ActivityQuestionSource {
  chunkId: string;
  pageNumber: number | null;
  index: number;
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
  selectedChoiceId: string;
  correctChoiceId: string;
  isCorrect: boolean;
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

export interface ActivitiesRepository {
  findDiagnosticQuizGenerationContext(input: {
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

  submitResult(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{ questionId: string; choiceId: string }>;
  }): Promise<DiagnosticQuizSubmissionResult>;
}
