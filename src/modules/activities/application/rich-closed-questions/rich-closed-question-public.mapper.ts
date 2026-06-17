import type {
  RichClosedExercise,
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
