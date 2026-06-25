export interface CourseDeepRevisionSourceDto {
  chunkId: string;
  text: string;
  pageNumber: number | null;
  index: number;
}

export interface CourseDeepRevisionResultDto {
  session: {
    id: string;
    mode: 'DEEP';
    status: 'COMPLETED';
    courseId: string;
    createdAt: Date;
    completedAt: Date;
  };
  scope: {
    kind: 'knowledge_unit';
    id: string;
    label: string;
    sourceLabel: string | null;
  };
  question: {
    id: string;
    prompt: string;
    instructions: string | null;
    sources: CourseDeepRevisionSourceDto[];
  };
  answer: {
    text: string;
    submittedAt: Date;
  };
  evaluation: {
    id: string;
    status: 'READY' | 'FAILED';
    score: number | null;
    maxScore: number | null;
    feedback: string | null;
    presentPoints: unknown[];
    missingPoints: unknown[];
    errors: unknown[];
    modelAnswer: string | null;
    advice: string | null;
    sources: CourseDeepRevisionSourceDto[];
  };
}

export interface CourseDeepRevisionHistoryResponseDto {
  items: CourseDeepRevisionHistoryItemDto[];
}

export interface CourseDeepRevisionHistoryItemDto {
  sessionId: string;
  type: 'deep_revision';
  status: 'completed';
  title: 'Révision approfondie';
  course: {
    id: string;
    title: string;
  };
  knowledgeUnit: {
    id: string;
    title: string;
  };
  score: number | null;
  submittedAt: Date;
  resultPath: string;
}
