import type {
  DiagnosticQuizGenerationChunk,
  DiagnosticQuizGenerationKnowledgeUnit,
} from './diagnostic-quiz-generator';

export interface OpenQuestionGenerationMetadata {
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
}

export interface OpenQuestionGenerationInput {
  studentId?: string;
  subjectId: string;
  documentId?: string | null;
  knowledgeUnit: DiagnosticQuizGenerationKnowledgeUnit;
  chunks?: DiagnosticQuizGenerationChunk[];
}

export interface GeneratedOpenQuestion {
  version: 1;
  prompt: string;
  instructions: string | null;
  maxAnswerLength: number;
  sourceChunkIds: string[];
  metadata?: OpenQuestionGenerationMetadata;
}

export const OPEN_QUESTION_GENERATOR = Symbol('OPEN_QUESTION_GENERATOR');

export interface OpenQuestionGenerator {
  generate(input: OpenQuestionGenerationInput): Promise<GeneratedOpenQuestion>;
}
