import type {
  RichClosedExercise,
  RichClosedPublicChoice,
  RichClosedPublicExercise,
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
