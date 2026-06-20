import type { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';

export type DiagnosticQuizDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';
export type DiagnosticQuizSelectionMode = 'single' | 'multiple';
export type DiagnosticQuizVisualType = 'IMAGE' | 'CHART' | 'DIAGRAM';

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
  visualsEnabled?: boolean;
  visualTypes?: DiagnosticQuizVisualType[];
  selectionModes?: DiagnosticQuizSelectionMode[];
}

export interface GeneratedDiagnosticQuizChoice {
  id: string;
  label: string;
  feedback?: string | null;
}

export interface GeneratedDiagnosticQuizQuestion {
  bankQuestionId?: string;
  prompt: string;
  difficulty?: DiagnosticQuizDifficulty | null;
  choices: GeneratedDiagnosticQuizChoice[];
  selectionMode?: DiagnosticQuizSelectionMode;
  minSelections?: number | null;
  maxSelections?: number | null;
  correctChoiceId?: string | null;
  correctChoiceIds?: string[];
  explanation: string;
  sourceChunkIds?: string[];
  visuals?: GeneratedDiagnosticQuizVisual[];
}

export type GeneratedDiagnosticQuizVisual =
  | GeneratedDiagnosticQuizImageVisual
  | GeneratedDiagnosticQuizChartVisual
  | GeneratedDiagnosticQuizDiagramVisual;

export interface GeneratedDiagnosticQuizVisualBase {
  type: DiagnosticQuizVisualType;
  displayOrder?: number;
  sourceChunkIds: string[];
}

export interface GeneratedDiagnosticQuizImageVisual extends GeneratedDiagnosticQuizVisualBase {
  type: 'IMAGE';
  imageUrl: string;
  altText: string;
  caption?: string | null;
}

export interface GeneratedDiagnosticQuizChartVisual extends GeneratedDiagnosticQuizVisualBase {
  type: 'CHART';
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  description?: string | null;
  data: Array<Record<string, string | number | null>>;
  xKey?: string | null;
  yKeys?: string[] | null;
}

export interface GeneratedDiagnosticQuizDiagramVisual extends GeneratedDiagnosticQuizVisualBase {
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
  version?: 2 | 3;
  questions: GeneratedDiagnosticQuizQuestion[];
  metadata?: GeneratedDiagnosticQuizMetadata;
}

export const DIAGNOSTIC_QUIZ_GENERATOR = Symbol('DIAGNOSTIC_QUIZ_GENERATOR');

export interface DiagnosticQuizGenerator {
  generate(
    input: DiagnosticQuizGenerationInput,
  ): Promise<GeneratedDiagnosticQuiz>;
}
