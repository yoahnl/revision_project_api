import type { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';

export interface GeneratedDiagnosticQuizChoice {
  id: string;
  label: string;
}

export interface GeneratedDiagnosticQuizQuestion {
  prompt: string;
  choices: GeneratedDiagnosticQuizChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface GeneratedDiagnosticQuiz {
  title: string;
  questions: GeneratedDiagnosticQuizQuestion[];
}

export const DIAGNOSTIC_QUIZ_GENERATOR = Symbol('DIAGNOSTIC_QUIZ_GENERATOR');

export interface DiagnosticQuizGenerator {
  generate(input: {
    knowledgeUnit: KnowledgeUnit;
  }): Promise<GeneratedDiagnosticQuiz>;
}
