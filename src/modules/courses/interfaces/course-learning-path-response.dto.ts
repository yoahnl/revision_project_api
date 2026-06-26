import type {
  CourseLearningPathDto,
  CourseLearningPathNodeDto,
} from '../application/courses.repository';

export type CourseLearningPathResponse = {
  generatedAt: string;
  course: {
    id: string;
    subjectId: string;
    subjectName: string;
    title: string;
  };
  summary: CourseLearningPathDto['summary'];
  activeNodeId: string | null;
  primaryAction: CourseLearningPathDto['primaryAction'];
  nodes: CourseLearningPathNodeResponse[];
  emptyState: CourseLearningPathDto['emptyState'];
};

export type CourseLearningPathNodeResponse = Omit<
  CourseLearningPathNodeDto,
  'lastPracticedAt'
> & {
  lastPracticedAt: string | null;
};

export function toCourseLearningPathResponse(
  learningPath: CourseLearningPathDto,
): CourseLearningPathResponse {
  return {
    generatedAt: learningPath.generatedAt.toISOString(),
    course: learningPath.course,
    summary: learningPath.summary,
    activeNodeId: learningPath.activeNodeId,
    primaryAction: learningPath.primaryAction,
    nodes: learningPath.nodes.map(toCourseLearningPathNodeResponse),
    emptyState: learningPath.emptyState,
  };
}

function toCourseLearningPathNodeResponse(
  node: CourseLearningPathNodeDto,
): CourseLearningPathNodeResponse {
  return {
    ...node,
    lastPracticedAt: node.lastPracticedAt?.toISOString() ?? null,
  };
}
