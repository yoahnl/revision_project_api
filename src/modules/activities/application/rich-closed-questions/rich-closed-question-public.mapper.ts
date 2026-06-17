import type {
  RichClosedExercise,
  RichClosedCalculationData,
  RichClosedCalculationChoice,
  RichClosedDiagram,
  RichClosedDiagramLabelingSlot,
  RichClosedPublicChoice,
  RichClosedPublicExercise,
  RichClosedPublicExerciseEnvelope,
  RichClosedPublicQuestion,
  RichClosedQuestion,
} from './rich-closed-question.types';

export function toRichClosedPublicExercise(
  exercise: RichClosedExercise,
): RichClosedPublicExercise {
  return {
    id: exercise.id,
    version: exercise.version,
    title: exercise.title,
    ...(exercise.subjectId === undefined
      ? {}
      : { subjectId: exercise.subjectId }),
    ...(exercise.documentId === undefined
      ? {}
      : { documentId: exercise.documentId }),
    ...(exercise.knowledgeUnitId === undefined
      ? {}
      : { knowledgeUnitId: exercise.knowledgeUnitId }),
    questions: exercise.questions.map(toRichClosedPublicQuestion),
  };
}

export function toRichClosedPublicExerciseEnvelope(input: {
  sessionId: string;
  exercise: RichClosedExercise;
}): RichClosedPublicExerciseEnvelope {
  return {
    sessionId: input.sessionId,
    type: 'rich_closed_exercise',
    ...toRichClosedPublicExercise(input.exercise),
  };
}

export function toRichClosedPublicQuestion(
  question: RichClosedQuestion,
): RichClosedPublicQuestion {
  const base = {
    id: question.id,
    questionKind: question.questionKind,
    prompt: question.prompt,
    difficulty: question.difficulty,
    cognitiveSkill: question.cognitiveSkill,
    sourceChunkIds: [...question.sourceChunkIds],
  };

  switch (question.questionKind) {
    case 'single_choice':
      return {
        ...base,
        questionKind: question.questionKind,
        choices: publicChoices(question.choices),
      };
    case 'multiple_choice':
      return {
        ...base,
        questionKind: question.questionKind,
        choices: publicChoices(question.choices),
        minSelections: question.minSelections,
        maxSelections: question.maxSelections,
      };
    case 'matching':
      return {
        ...base,
        questionKind: question.questionKind,
        leftItems: cloneLabelItems(question.leftItems),
        rightItems: cloneLabelItems(question.rightItems),
      };
    case 'ordering':
      return {
        ...base,
        questionKind: question.questionKind,
        items: cloneLabelItems(question.items),
      };
    case 'timeline':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        events: cloneTimelineEvents(question.events),
      };
    case 'date_slider':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        minYear: question.minYear,
        maxYear: question.maxYear,
        step: question.step,
        toleranceYears: question.toleranceYears,
      };
    case 'true_false_grid':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        rows: cloneTrueFalseRows(question.rows),
      };
    case 'cause_consequence':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        causes: cloneDescribedLabelItems(question.causes),
        consequences: cloneDescribedLabelItems(question.consequences),
      };
    case 'institution_matrix':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        rows: cloneDescribedLabelItems(question.rows),
        columns: cloneDescribedLabelItems(question.columns),
        cells: cloneInstitutionMatrixCells(question.cells),
      };
    case 'diagram_labeling':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        diagram: cloneDiagram(question.diagram),
        slots: cloneDiagramLabelingSlots(question.slots),
      };
    case 'calculation_mcq':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        scenario: question.scenario,
        calculation: cloneCalculation(question.calculation),
        choices: cloneCalculationChoices(question.choices),
      };
    case 'case_qualification':
      return {
        ...base,
        questionKind: question.questionKind,
        caseText: question.caseText,
        choices: publicChoices(question.choices),
      };
    case 'error_detection':
      return {
        ...base,
        questionKind: question.questionKind,
        statement: question.statement,
        errorOptions: publicChoices(question.errorOptions),
      };
  }
}

function publicChoices(
  choices: Array<{ id: string; label: string }>,
): RichClosedPublicChoice[] {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
  }));
}

function cloneLabelItems(items: Array<{ id: string; label: string }>) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
  }));
}

function cloneTimelineEvents(
  events: Array<{ id: string; label: string; description?: string | null }>,
) {
  return events.map((event) => ({
    id: event.id,
    label: event.label,
    ...(event.description === undefined
      ? {}
      : { description: event.description }),
  }));
}

function cloneTrueFalseRows(
  rows: Array<{ id: string; statement: string; context?: string | null }>,
) {
  return rows.map((row) => ({
    id: row.id,
    statement: row.statement,
    ...(row.context === undefined ? {} : { context: row.context }),
  }));
}

function cloneDescribedLabelItems(
  items: Array<{ id: string; label: string; description?: string | null }>,
) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    ...(item.description === undefined
      ? {}
      : { description: item.description }),
  }));
}

function cloneInstitutionMatrixCells(
  cells: Array<{
    id: string;
    rowId: string;
    columnId: string;
    prompt?: string | null;
    options: Array<{ id: string; label: string }>;
  }>,
) {
  return cells.map((cell) => ({
    id: cell.id,
    rowId: cell.rowId,
    columnId: cell.columnId,
    ...(cell.prompt === undefined ? {} : { prompt: cell.prompt }),
    options: publicChoices(cell.options),
  }));
}

function cloneDiagram(diagram: RichClosedDiagram): RichClosedDiagram {
  return {
    ...(diagram.title === undefined ? {} : { title: diagram.title }),
    ...(diagram.description === undefined
      ? {}
      : { description: diagram.description }),
    layout: diagram.layout,
    nodes: diagram.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      ...(node.description === undefined
        ? {}
        : { description: node.description }),
      ...(node.groupId === undefined ? {} : { groupId: node.groupId }),
    })),
    ...(diagram.groups === undefined
      ? {}
      : { groups: cloneDescribedLabelItems(diagram.groups) }),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      ...(edge.label === undefined ? {} : { label: edge.label }),
      ...(edge.description === undefined
        ? {}
        : { description: edge.description }),
    })),
  };
}

function cloneDiagramLabelingSlots(
  slots: RichClosedDiagramLabelingSlot[],
): RichClosedDiagramLabelingSlot[] {
  return slots.map((slot) => ({
    id: slot.id,
    anchorType: slot.anchorType,
    anchorId: slot.anchorId,
    prompt: slot.prompt,
    options: publicChoices(slot.options),
  }));
}

function cloneCalculation(
  calculation: RichClosedCalculationData,
): RichClosedCalculationData {
  switch (calculation.mode) {
    case 'absolute_majority_threshold':
      return {
        mode: calculation.mode,
        validVotes: calculation.validVotes,
      };
    case 'largest_remainder_target_party_seats':
      return {
        mode: calculation.mode,
        totalSeats: calculation.totalSeats,
        targetPartyId: calculation.targetPartyId,
        parties: calculation.parties.map((party) => ({
          id: party.id,
          label: party.label,
          votes: party.votes,
        })),
      };
  }
}

function cloneCalculationChoices(
  choices: RichClosedCalculationChoice[],
): RichClosedCalculationChoice[] {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    value: choice.value,
  }));
}
