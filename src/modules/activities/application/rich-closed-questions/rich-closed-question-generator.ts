import type {
  RichClosedExercise,
  RichClosedQuestionKind,
} from './rich-closed-question.types';

export type RichClosedComplexityProfile = 'standard' | 'exam' | 'advanced';

export interface RichClosedQuestionGenerationInput {
  studentId: string;
  subjectId: string;
  documentId?: string | null;
  knowledgeUnit: {
    id: string;
    subjectId: string;
    title: string;
    summary: string;
    difficulty?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    sourceChunkIds?: string[];
  };
  chunks: Array<{
    id: string;
    index: number;
    text: string;
    pageNumber: number | null;
  }>;
  questionCount: number;
  questionTypeMix: Partial<Record<RichClosedQuestionKind, number>>;
  complexityProfile: RichClosedComplexityProfile;
}

export interface RichClosedQuestionGenerationMetadata {
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
}

export type GeneratedRichClosedExercise = RichClosedExercise & {
  metadata?: RichClosedQuestionGenerationMetadata;
};

export const RICH_CLOSED_QUESTION_GENERATOR = Symbol(
  'RICH_CLOSED_QUESTION_GENERATOR',
);

export interface RichClosedQuestionGenerator {
  generate(
    input: RichClosedQuestionGenerationInput,
  ): Promise<GeneratedRichClosedExercise>;
}
