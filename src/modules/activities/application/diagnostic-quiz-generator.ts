import type { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';

export type DiagnosticQuizDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DiagnosticQuizGenerationChunk {
  id: string;
  index: number;
  text: string;
  pageNumber?: number | null;
}

export interface DiagnosticQuizGenerationKnowledgeUnit extends KnowledgeUnit {
  difficulty?: DiagnosticQuizDifficulty | null;
  sourceChunkIds?: string[];
}

export interface DiagnosticQuizGenerationInput {
  subjectId?: string;
  documentId?: string | null;
  knowledgeUnit: DiagnosticQuizGenerationKnowledgeUnit;
  chunks?: DiagnosticQuizGenerationChunk[];
  questionCount?: number;
}

export interface GeneratedDiagnosticQuizChoice {
  id: string;
  label: string;
  feedback?: string | null;
}

export interface GeneratedDiagnosticQuizQuestion {
  prompt: string;
  difficulty?: DiagnosticQuizDifficulty | null;
  choices: GeneratedDiagnosticQuizChoice[];
  correctChoiceId: string;
  explanation: string;
  sourceChunkIds?: string[];
}

export interface GeneratedDiagnosticQuizMetadata {
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
}

export interface GeneratedDiagnosticQuiz {
  title: string;
  version?: 2;
  questions: GeneratedDiagnosticQuizQuestion[];
  metadata?: GeneratedDiagnosticQuizMetadata;
}

export const DIAGNOSTIC_QUIZ_GENERATOR = Symbol('DIAGNOSTIC_QUIZ_GENERATOR');

export interface DiagnosticQuizGenerator {
  generate(
    input: DiagnosticQuizGenerationInput,
  ): Promise<GeneratedDiagnosticQuiz>;
}
