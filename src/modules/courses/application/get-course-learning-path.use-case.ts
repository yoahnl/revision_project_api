import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDocumentStatus,
  type CourseLearningPathDataDto,
  type CourseLearningPathDocumentDto,
  type CourseLearningPathDto,
  type CourseLearningPathKnowledgeUnitDto,
  type CourseLearningPathNodeDto,
  type CourseLearningPathNodeState,
  type CourseLearningPathPrimaryActionKind,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class GetCourseLearningPathUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseLearningPathDto> {
    const data =
      await this.coursesRepository.findCourseLearningPathByIdForStudent({
        studentId: requiredId(input.studentId, 'studentId'),
        courseId: requiredId(input.courseId, 'courseId'),
      });

    if (!data) {
      throw new Error('Course not found');
    }

    return buildLearningPath(data);
  }
}

function buildLearningPath(data: CourseLearningPathDataDto) {
  const documents = sortDocuments(data.documents).filter(
    (document) => document.kind === 'COURSE_PDF',
  );
  const readyDocuments = documents.filter(
    (document) => document.status === 'READY',
  );
  const documentOrderById = new Map(
    documents.map((document, index) => [document.id, index]),
  );
  const sourceByDocumentId = new Map(
    readyDocuments.map((document) => [document.id, document]),
  );
  const nodes = sortKnowledgeUnits(
    data.knowledgeUnits.filter(
      (unit) => unit.documentId && sourceByDocumentId.has(unit.documentId),
    ),
    documentOrderById,
  ).map((unit, index) =>
    toLearningPathNode({
      unit,
      data,
      order: index,
      source:
        unit.documentId == null
          ? null
          : sourceByDocumentId.get(unit.documentId),
    }),
  );
  const summary = buildSummary(nodes, readyDocuments.length);
  const activeNode = chooseActiveNode(nodes);

  return {
    generatedAt: new Date(),
    course: {
      id: data.course.id,
      subjectId: data.course.subjectId,
      subjectName: data.course.subjectName,
      title: data.course.title,
    },
    summary,
    activeNodeId: activeNode?.id ?? null,
    primaryAction: buildPrimaryAction({
      data,
      documents,
      readySourceCount: readyDocuments.length,
      activeNode,
      nodeCount: nodes.length,
    }),
    nodes,
    emptyState: nodes.length === 0 ? buildEmptyState(documents) : null,
  };
}

function toLearningPathNode(input: {
  unit: CourseLearningPathKnowledgeUnitDto;
  data: CourseLearningPathDataDto;
  order: number;
  source: CourseLearningPathDocumentDto | null | undefined;
}): CourseLearningPathNodeDto {
  const mastery = input.unit.mastery[0] ?? null;
  const masteryScore = mastery?.score ?? null;
  const state = nodeState(masteryScore);

  return {
    id: input.unit.id,
    knowledgeUnitId: input.unit.id,
    courseId: input.data.course.id,
    subjectId: input.unit.subjectId,
    documentId: input.unit.documentId,
    title: input.unit.title,
    order: input.order,
    state,
    masteryScore,
    lastPracticedAt: mastery?.lastPracticedAt ?? null,
    source: input.source
      ? {
          documentId: input.source.id,
          fileName: input.source.fileName,
        }
      : null,
    display: {
      title: input.unit.title,
      statusLabel: statusLabel(state),
      metaLabel: input.source?.fileName ?? null,
      actionLabel: nodeActionLabel(state),
      unavailableReason: null,
    },
  };
}

function buildSummary(
  nodes: CourseLearningPathNodeDto[],
  readySourceCount: number,
): CourseLearningPathDto['summary'] {
  const practicedScores = nodes
    .map((node) => node.masteryScore)
    .filter((score): score is number => score != null);
  const knowledgeUnitCount = nodes.length;
  const coverage =
    knowledgeUnitCount === 0
      ? 0
      : roundRatio(practicedScores.length / knowledgeUnitCount);
  const mastery =
    practicedScores.length === 0
      ? null
      : roundRatio(
          practicedScores.reduce((sum, score) => sum + score, 0) /
            practicedScores.length,
        );
  const estimatedGlobalMastery =
    mastery == null ? 0 : roundRatio(coverage * mastery);

  return {
    knowledgeUnitCount,
    solidCount: countState(nodes, 'SOLID'),
    inProgressCount: countState(nodes, 'IN_PROGRESS'),
    toStrengthenCount: countState(nodes, 'TO_STRENGTHEN'),
    undiscoveredCount: countState(nodes, 'UNDISCOVERED'),
    estimatedGlobalMastery,
    mastery,
    coverage,
    readySourceCount,
  };
}

function buildPrimaryAction(input: {
  data: CourseLearningPathDataDto;
  documents: CourseLearningPathDocumentDto[];
  readySourceCount: number;
  activeNode: CourseLearningPathNodeDto | null;
  nodeCount: number;
}): CourseLearningPathDto['primaryAction'] {
  if (input.documents.length === 0) {
    return primaryAction({
      kind: 'ADD_SOURCE',
      label: 'Ajouter une source',
      description: 'Ajoute un PDF pour préparer le parcours de ce cours.',
      enabled: true,
    });
  }

  if (
    input.readySourceCount === 0 &&
    input.documents.some(isSourceInAnalysis)
  ) {
    return primaryAction({
      kind: 'WAIT_FOR_ANALYSIS',
      label: 'Analyse en cours',
      description: 'Le parcours sera disponible quand la source sera prête.',
      enabled: false,
      unavailableReason: 'Analyse en cours',
    });
  }

  if (
    input.readySourceCount === 0 &&
    input.documents.every((document) => document.status === 'FAILED')
  ) {
    return primaryAction({
      kind: 'UNAVAILABLE',
      label: 'Voir les sources',
      description:
        'Une source doit être corrigée avant de préparer le parcours.',
      enabled: true,
    });
  }

  if (input.readySourceCount > 0 && input.nodeCount === 0) {
    return primaryAction({
      kind: 'UNAVAILABLE',
      label: 'Parcours indisponible',
      description: 'Aucune notion exploitable n’a été trouvée pour ce cours.',
      enabled: false,
      unavailableReason: 'Aucune notion exploitable',
    });
  }

  if (input.activeNode) {
    return primaryAction({
      kind: 'REVIEW_ACTIVE_NODE',
      label: 'Continuer',
      description: 'Reprendre le parcours à la notion recommandée.',
      enabled: true,
      estimatedMinutes: input.data.course.estimatedMinutes ?? null,
      targetKnowledgeUnitId: input.activeNode.knowledgeUnitId,
      targetNodeId: input.activeNode.id,
    });
  }

  return primaryAction({
    kind: 'UNAVAILABLE',
    label: 'Parcours indisponible',
    description: 'Le parcours de ce cours n’est pas encore disponible.',
    enabled: false,
    unavailableReason: 'Parcours indisponible',
  });
}

function primaryAction(input: {
  kind: CourseLearningPathPrimaryActionKind;
  label: string;
  description: string;
  enabled: boolean;
  estimatedMinutes?: number | null;
  targetKnowledgeUnitId?: string | null;
  targetNodeId?: string | null;
  unavailableReason?: string | null;
}): CourseLearningPathDto['primaryAction'] {
  return {
    kind: input.kind,
    label: input.label,
    description: input.description,
    estimatedMinutes: input.estimatedMinutes ?? null,
    targetKnowledgeUnitId: input.targetKnowledgeUnitId ?? null,
    targetNodeId: input.targetNodeId ?? null,
    enabled: input.enabled,
    unavailableReason: input.unavailableReason ?? null,
  };
}

function buildEmptyState(
  documents: CourseLearningPathDocumentDto[],
): CourseLearningPathDto['emptyState'] {
  if (documents.length === 0) {
    return {
      title: 'Ajoute une source',
      message:
        'Ajoute un PDF pour que Neralune prépare le parcours de ce cours.',
      actionLabel: 'Ajouter une source',
      actionKind: 'ADD_SOURCE',
    };
  }

  if (documents.some(isSourceInAnalysis)) {
    return {
      title: 'Analyse en cours',
      message: 'Neralune prépare les notions de ce cours.',
      actionLabel: 'Revenir plus tard',
      actionKind: 'WAIT_FOR_ANALYSIS',
    };
  }

  if (documents.every((document) => document.status === 'FAILED')) {
    return {
      title: 'Source à corriger',
      message:
        'La source n’a pas pu être analysée. Remplace-la ou ajoute un autre PDF.',
      actionLabel: 'Voir les sources',
      actionKind: 'RETRY_SOURCE',
    };
  }

  return {
    title: 'Aucune notion trouvée',
    message: 'Ce cours ne contient pas encore de notion exploitable.',
    actionLabel: 'Voir les sources',
    actionKind: 'NONE',
  };
}

function chooseActiveNode(nodes: CourseLearningPathNodeDto[]) {
  return (
    nodes.find((node) => node.state === 'TO_STRENGTHEN') ??
    nodes.find((node) => node.state === 'IN_PROGRESS') ??
    nodes.find((node) => node.state === 'UNDISCOVERED') ??
    nodes.find((node) => node.state === 'SOLID') ??
    null
  );
}

function nodeState(score: number | null): CourseLearningPathNodeState {
  if (score == null) {
    return 'UNDISCOVERED';
  }

  if (score >= 0.8) {
    return 'SOLID';
  }

  if (score >= 0.5) {
    return 'IN_PROGRESS';
  }

  return 'TO_STRENGTHEN';
}

function statusLabel(state: CourseLearningPathNodeState) {
  if (state === 'SOLID') {
    return 'Solide';
  }

  if (state === 'IN_PROGRESS') {
    return 'En cours';
  }

  if (state === 'TO_STRENGTHEN') {
    return 'À renforcer';
  }

  return 'À découvrir';
}

function nodeActionLabel(state: CourseLearningPathNodeState) {
  if (state === 'SOLID') {
    return 'Revoir';
  }

  if (state === 'IN_PROGRESS') {
    return 'Continuer';
  }

  if (state === 'TO_STRENGTHEN') {
    return 'Renforcer';
  }

  return 'Découvrir';
}

function countState(
  nodes: CourseLearningPathNodeDto[],
  state: CourseLearningPathNodeState,
) {
  return nodes.filter((node) => node.state === state).length;
}

function sortDocuments(documents: CourseLearningPathDocumentDto[]) {
  return [...documents].sort((left, right) => {
    const createdDiff = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortKnowledgeUnits(
  units: CourseLearningPathKnowledgeUnitDto[],
  documentOrderById: Map<string, number>,
) {
  return [...units].sort((left, right) => {
    const leftDocumentOrder =
      left.documentId == null
        ? Number.MAX_SAFE_INTEGER
        : (documentOrderById.get(left.documentId) ?? Number.MAX_SAFE_INTEGER);
    const rightDocumentOrder =
      right.documentId == null
        ? Number.MAX_SAFE_INTEGER
        : (documentOrderById.get(right.documentId) ?? Number.MAX_SAFE_INTEGER);
    const documentDiff = leftDocumentOrder - rightDocumentOrder;
    if (documentDiff !== 0) {
      return documentDiff;
    }

    const orderDiff =
      nullableOrder(left.displayOrder) - nullableOrder(right.displayOrder);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    const createdDiff = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function nullableOrder(value: number | null) {
  return value == null ? Number.MAX_SAFE_INTEGER : value;
}

function isSourceInAnalysis(document: { status: CourseDocumentStatus }) {
  return document.status === 'UPLOADED' || document.status === 'PROCESSING';
}

function roundRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(3));
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}
