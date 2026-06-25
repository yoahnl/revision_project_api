import type {
  GeneratedDiagnosticQuiz,
  GeneratedDiagnosticQuizChoice,
  GeneratedDiagnosticQuizVisual,
} from './diagnostic-quiz-generator';

export const QUESTION_BANK_REPOSITORY = Symbol('QUESTION_BANK_REPOSITORY');

export interface CountActiveCourseQuickQuestionsInput {
  studentId: string;
  subjectId: string;
  courseId: string;
  knowledgeUnitId?: string;
  knowledgeUnitIds?: string[];
}

export interface CountActiveCourseQuickQuestionsByKnowledgeUnitInput {
  studentId: string;
  subjectId: string;
  courseId: string;
  knowledgeUnitIds: string[];
}

export interface PersistGeneratedQuestionsInput {
  studentId: string;
  subjectId: string;
  courseId: string;
  documentId: string;
  knowledgeUnitId: string;
  quiz: GeneratedDiagnosticQuiz;
}

export interface QuestionBankPersistenceStats {
  persistedCount: number;
  duplicateSkippedCount: number;
  structureSkippedCount: number;
}

export interface ReserveCourseQuickQuestionsInput {
  studentId: string;
  subjectId: string;
  courseId: string;
  knowledgeUnits: CourseQuickQuestionKnowledgeUnitInput[];
  questionCount: number;
  maxAttempts: number;
}

export interface CourseQuickQuestionKnowledgeUnitInput {
  id: string;
  documentId: string;
}

export interface QuestionBankReservedQuestionDto {
  id: string;
  documentId: string | null;
  knowledgeUnitId: string;
  prompt: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  choices: GeneratedDiagnosticQuizChoice[];
  selectionMode: 'single' | 'multiple';
  minSelections: number | null;
  maxSelections: number | null;
  correctChoiceId: string | null;
  correctChoiceIds: string[];
  explanation: string;
  sourceChunkIds: string[];
  visuals: GeneratedDiagnosticQuizVisual[];
}

export interface QuestionBankRepository {
  countActiveCourseQuickQuestions(
    input: CountActiveCourseQuickQuestionsInput,
  ): Promise<number>;

  countActiveCourseQuickQuestionsByKnowledgeUnit(
    input: CountActiveCourseQuickQuestionsByKnowledgeUnitInput,
  ): Promise<Map<string, number>>;

  persistGeneratedQuestions(
    input: PersistGeneratedQuestionsInput,
  ): Promise<QuestionBankPersistenceStats>;

  reserveCourseQuickQuestions(
    input: ReserveCourseQuickQuestionsInput,
  ): Promise<QuestionBankReservedQuestionDto[]>;
}
