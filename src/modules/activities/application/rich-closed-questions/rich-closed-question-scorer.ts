import {
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
  RICH_CLOSED_SESSION_NOT_FOUND,
} from './rich-closed-question-errors';
import { evaluateRichClosedCalculationMcq } from './rich-closed-question-calculation';
import {
  type RichClosedAnswer,
  type RichClosedCalculationMcqQuestion,
  type RichClosedCauseConsequencePair,
  type RichClosedCorrectionItem,
  type RichClosedCorrectionPayload,
  type RichClosedDiagramLabelingValue,
  type RichClosedExercise,
  type RichClosedExerciseResult,
  type RichClosedInstitutionMatrixValue,
  type RichClosedPair,
  type RichClosedQuestion,
  type RichClosedTrueFalseValue,
} from './rich-closed-question.types';

export function scoreRichClosedExerciseSubmission(input: {
  sessionId: string;
  exercise: RichClosedExercise;
  answers: unknown[];
}): RichClosedExerciseResult {
  if (input.exercise.questions.length === 0) {
    throw new Error(RICH_CLOSED_SESSION_NOT_FOUND);
  }

  const answersByQuestionId = normalizeAnswers(input.answers);
  const questionIds = new Set(
    input.exercise.questions.map((question) => question.id),
  );

  for (const answer of answersByQuestionId.values()) {
    if (!questionIds.has(answer.questionId)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }
  }

  const items = input.exercise.questions.map((question) => {
    const answer = answersByQuestionId.get(question.id);

    if (!answer) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return scoreQuestion(question, answer);
  });
  const correctAnswers = items.filter((item) => item.isCorrect).length;
  const totalQuestions = input.exercise.questions.length;
  const score =
    totalQuestions === 0
      ? 0
      : Number((correctAnswers / totalQuestions).toFixed(3));

  return {
    sessionId: input.sessionId,
    type: 'rich_closed_exercise',
    status: 'completed',
    correctAnswers,
    totalQuestions,
    score,
    items,
  };
}

function normalizeAnswers(answers: unknown[]): Map<string, RichClosedAnswer> {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  const answersByQuestionId = new Map<string, RichClosedAnswer>();

  for (const answer of answers) {
    const normalizedAnswer = normalizeAnswer(answer);

    if (answersByQuestionId.has(normalizedAnswer.questionId)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    answersByQuestionId.set(normalizedAnswer.questionId, normalizedAnswer);
  }

  return answersByQuestionId;
}

function normalizeAnswer(answer: unknown): RichClosedAnswer {
  if (!isRecord(answer) || hasForbiddenSubmitField(answer)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  const questionId = readRequiredString(answer.questionId);
  const questionKind = readRequiredString(answer.questionKind);

  switch (questionKind) {
    case 'single_choice':
    case 'case_qualification':
      return {
        questionId,
        questionKind,
        choiceId: readRequiredString(answer.choiceId),
      };
    case 'multiple_choice':
      return {
        questionId,
        questionKind,
        choiceIds: readStringArray(answer.choiceIds),
      };
    case 'matching':
      return {
        questionId,
        questionKind,
        pairs: readPairs(answer.pairs),
      };
    case 'ordering':
      return {
        questionId,
        questionKind,
        orderedIds: readStringArray(answer.orderedIds),
      };
    case 'timeline':
      return {
        questionId,
        questionKind,
        orderedEventIds: readStringArray(answer.orderedEventIds),
      };
    case 'date_slider':
      return {
        questionId,
        questionKind,
        year: readRequiredInteger(answer.year),
      };
    case 'true_false_grid':
      return {
        questionId,
        questionKind,
        values: readTrueFalseValues(answer.values),
      };
    case 'cause_consequence':
      return {
        questionId,
        questionKind,
        pairs: readCauseConsequencePairs(answer.pairs),
      };
    case 'institution_matrix':
      return {
        questionId,
        questionKind,
        values: readInstitutionMatrixValues(answer.values),
      };
    case 'diagram_labeling':
      return {
        questionId,
        questionKind,
        values: readDiagramLabelingValues(answer.values),
      };
    case 'calculation_mcq':
      return {
        questionId,
        questionKind,
        choiceId: readRequiredString(answer.choiceId),
      };
    case 'image_choice':
      return {
        questionId,
        questionKind,
        choiceId: readRequiredString(answer.choiceId),
      };
    case 'error_detection':
      return {
        questionId,
        questionKind,
        errorId: readRequiredString(answer.errorId),
      };
    default:
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function scoreQuestion(
  question: RichClosedQuestion,
  answer: RichClosedAnswer,
): RichClosedCorrectionItem {
  if (question.questionKind !== answer.questionKind) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  switch (question.questionKind) {
    case 'single_choice': {
      const singleAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'single_choice' }
      >;
      assertKnownId(
        singleAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );

      return buildCorrectionItem({
        question,
        answer: singleAnswer,
        isCorrect: singleAnswer.choiceId === question.correctChoiceId,
        correction: { correctChoiceId: question.correctChoiceId },
      });
    }
    case 'case_qualification': {
      const caseAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'case_qualification' }
      >;
      assertKnownId(
        caseAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );

      return buildCorrectionItem({
        question,
        answer: caseAnswer,
        isCorrect: caseAnswer.choiceId === question.correctChoiceId,
        correction: { correctChoiceId: question.correctChoiceId },
      });
    }
    case 'error_detection': {
      const errorAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'error_detection' }
      >;
      assertKnownId(
        errorAnswer.errorId,
        question.errorOptions.map((option) => option.id),
      );

      return buildCorrectionItem({
        question,
        answer: errorAnswer,
        isCorrect: errorAnswer.errorId === question.correctErrorId,
        correction: { correctErrorId: question.correctErrorId },
      });
    }
    case 'multiple_choice': {
      const multipleAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'multiple_choice' }
      >;
      assertKnownIds(
        multipleAnswer.choiceIds,
        question.choices.map((choice) => choice.id),
      );

      if (
        multipleAnswer.choiceIds.length < question.minSelections ||
        multipleAnswer.choiceIds.length > question.maxSelections
      ) {
        throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
      }

      return buildCorrectionItem({
        question,
        answer: multipleAnswer,
        isCorrect: areStringSetsEqual(
          multipleAnswer.choiceIds,
          question.correctChoiceIds,
        ),
        correction: { correctChoiceIds: [...question.correctChoiceIds] },
      });
    }
    case 'matching': {
      const matchingAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'matching' }
      >;
      assertKnownPairs(matchingAnswer.pairs, question);

      return buildCorrectionItem({
        question,
        answer: matchingAnswer,
        isCorrect: arePairsEqual(matchingAnswer.pairs, question.correctPairs),
        correction: { correctPairs: clonePairs(question.correctPairs) },
      });
    }
    case 'ordering': {
      const orderingAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'ordering' }
      >;
      assertKnownIds(
        orderingAnswer.orderedIds,
        question.items.map((item) => item.id),
      );

      if (orderingAnswer.orderedIds.length !== question.items.length) {
        throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
      }

      return buildCorrectionItem({
        question,
        answer: orderingAnswer,
        isCorrect: areStringArraysEqual(
          orderingAnswer.orderedIds,
          question.correctOrder,
        ),
        correction: { correctOrder: [...question.correctOrder] },
      });
    }
    case 'timeline': {
      const timelineAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'timeline' }
      >;
      assertKnownIds(
        timelineAnswer.orderedEventIds,
        question.events.map((event) => event.id),
      );

      if (timelineAnswer.orderedEventIds.length !== question.events.length) {
        throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
      }

      return buildCorrectionItem({
        question,
        answer: timelineAnswer,
        isCorrect: areStringArraysEqual(
          timelineAnswer.orderedEventIds,
          question.correctOrder,
        ),
        correction: { correctOrder: [...question.correctOrder] },
      });
    }
    case 'date_slider': {
      const dateSliderAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'date_slider' }
      >;
      assertDateSliderYear(dateSliderAnswer.year, question);

      const minAcceptedYear = Math.max(
        question.minYear,
        question.correctYear - question.toleranceYears,
      );
      const maxAcceptedYear = Math.min(
        question.maxYear,
        question.correctYear + question.toleranceYears,
      );

      return buildCorrectionItem({
        question,
        answer: dateSliderAnswer,
        isCorrect:
          Math.abs(dateSliderAnswer.year - question.correctYear) <=
          question.toleranceYears,
        correction: {
          correctYear: question.correctYear,
          minAcceptedYear,
          maxAcceptedYear,
        },
      });
    }
    case 'true_false_grid': {
      const trueFalseAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'true_false_grid' }
      >;
      assertKnownTrueFalseValues(trueFalseAnswer.values, question);

      return buildCorrectionItem({
        question,
        answer: trueFalseAnswer,
        isCorrect: areTrueFalseValuesEqual(
          trueFalseAnswer.values,
          question.correctValues,
        ),
        correction: {
          correctValues: cloneTrueFalseValues(question.correctValues),
        },
      });
    }
    case 'cause_consequence': {
      const causeConsequenceAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'cause_consequence' }
      >;
      assertKnownCauseConsequencePairs(causeConsequenceAnswer.pairs, question);

      return buildCorrectionItem({
        question,
        answer: causeConsequenceAnswer,
        isCorrect: areCauseConsequencePairsEqual(
          causeConsequenceAnswer.pairs,
          question.correctPairs,
        ),
        correction: {
          correctPairs: cloneCauseConsequencePairs(question.correctPairs),
        },
      });
    }
    case 'institution_matrix': {
      const institutionMatrixAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'institution_matrix' }
      >;
      assertKnownInstitutionMatrixValues(
        institutionMatrixAnswer.values,
        question,
      );

      return buildCorrectionItem({
        question,
        answer: institutionMatrixAnswer,
        isCorrect: areInstitutionMatrixValuesEqual(
          institutionMatrixAnswer.values,
          question.correctValues,
        ),
        correction: {
          correctValues: cloneInstitutionMatrixValues(question.correctValues),
        },
      });
    }
    case 'diagram_labeling': {
      const diagramLabelingAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'diagram_labeling' }
      >;
      assertKnownDiagramLabelingValues(diagramLabelingAnswer.values, question);

      return buildCorrectionItem({
        question,
        answer: diagramLabelingAnswer,
        isCorrect: areDiagramLabelingValuesEqual(
          diagramLabelingAnswer.values,
          question.correctValues,
        ),
        correction: {
          correctValues: cloneDiagramLabelingValues(question.correctValues),
        },
      });
    }
    case 'calculation_mcq': {
      const calculationAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'calculation_mcq' }
      >;
      assertKnownId(
        calculationAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );
      const evaluation = evaluateRichClosedCalculationMcq(question.calculation);
      const derivedCorrectChoiceId = deriveCalculationCorrectChoiceId(
        question,
        evaluation.expectedValue,
      );

      return buildCorrectionItem({
        question,
        answer: calculationAnswer,
        isCorrect: calculationAnswer.choiceId === derivedCorrectChoiceId,
        correction: {
          correctChoiceId: derivedCorrectChoiceId,
          expectedValue: evaluation.expectedValue,
          workedSteps: evaluation.workedSteps.map((step) => ({ ...step })),
        },
      });
    }
    case 'image_choice': {
      const imageChoiceAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'image_choice' }
      >;
      assertKnownId(
        imageChoiceAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );

      return buildCorrectionItem({
        question,
        answer: imageChoiceAnswer,
        isCorrect: imageChoiceAnswer.choiceId === question.correctChoiceId,
        correction: { correctChoiceId: question.correctChoiceId },
      });
    }
  }
}

function assertKnownId(submittedId: string, knownIds: string[]) {
  if (!knownIds.includes(submittedId)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function deriveCalculationCorrectChoiceId(
  question: RichClosedCalculationMcqQuestion,
  expectedValue: number,
): string {
  const matchingChoices = question.choices.filter(
    (choice) => choice.value === expectedValue,
  );

  if (matchingChoices.length !== 1) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return matchingChoices[0].id;
}

function buildCorrectionItem(input: {
  question: RichClosedQuestion;
  answer: RichClosedAnswer;
  isCorrect: boolean;
  correction: RichClosedCorrectionPayload;
}): RichClosedCorrectionItem {
  return {
    questionId: input.question.id,
    questionKind: input.question.questionKind,
    prompt: input.question.prompt,
    submittedAnswer: cloneAnswer(input.answer),
    isCorrect: input.isCorrect,
    partialScore: input.isCorrect ? 1 : 0,
    explanation: input.question.explanation,
    sourceChunkIds: [...input.question.sourceChunkIds],
    correction: input.correction,
  };
}

function assertKnownIds(submittedIds: string[], knownIds: string[]) {
  if (
    submittedIds.length === 0 ||
    hasDuplicates(submittedIds) ||
    submittedIds.some((id) => !knownIds.includes(id))
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertDateSliderYear(
  year: number,
  question: Extract<RichClosedQuestion, { questionKind: 'date_slider' }>,
) {
  if (
    year < question.minYear ||
    year > question.maxYear ||
    (year - question.minYear) % question.step !== 0
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownPairs(
  pairs: RichClosedPair[],
  question: Extract<RichClosedQuestion, { questionKind: 'matching' }>,
) {
  const leftIds = question.leftItems.map((item) => item.id);
  const rightIds = question.rightItems.map((item) => item.id);
  const submittedLeftIds = pairs.map((pair) => pair.leftId);
  const submittedRightIds = pairs.map((pair) => pair.rightId);

  if (
    pairs.length === 0 ||
    pairs.length !== question.correctPairs.length ||
    hasDuplicates(submittedLeftIds) ||
    hasDuplicates(submittedRightIds) ||
    pairs.some(
      (pair) =>
        !leftIds.includes(pair.leftId) || !rightIds.includes(pair.rightId),
    )
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownTrueFalseValues(
  values: RichClosedTrueFalseValue[],
  question: Extract<RichClosedQuestion, { questionKind: 'true_false_grid' }>,
) {
  const rowIds = question.rows.map((row) => row.id);
  const submittedRowIds = values.map((value) => value.rowId);

  if (
    values.length === 0 ||
    values.length !== question.rows.length ||
    hasDuplicates(submittedRowIds) ||
    values.some((value) => !rowIds.includes(value.rowId))
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownCauseConsequencePairs(
  pairs: RichClosedCauseConsequencePair[],
  question: Extract<RichClosedQuestion, { questionKind: 'cause_consequence' }>,
) {
  const causeIds = question.causes.map((cause) => cause.id);
  const consequenceIds = question.consequences.map(
    (consequence) => consequence.id,
  );
  const submittedCauseIds = pairs.map((pair) => pair.causeId);
  const submittedConsequenceIds = pairs.map((pair) => pair.consequenceId);

  if (
    pairs.length === 0 ||
    pairs.length !== question.causes.length ||
    hasDuplicates(submittedCauseIds) ||
    hasDuplicates(submittedConsequenceIds) ||
    pairs.some(
      (pair) =>
        !causeIds.includes(pair.causeId) ||
        !consequenceIds.includes(pair.consequenceId),
    )
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownInstitutionMatrixValues(
  values: RichClosedInstitutionMatrixValue[],
  question: Extract<RichClosedQuestion, { questionKind: 'institution_matrix' }>,
) {
  const cellIds = question.cells.map((cell) => cell.id);
  const cellsById = new Map(question.cells.map((cell) => [cell.id, cell]));
  const submittedCellIds = values.map((value) => value.cellId);

  if (
    values.length === 0 ||
    values.length !== question.cells.length ||
    hasDuplicates(submittedCellIds)
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  for (const value of values) {
    const cell = cellsById.get(value.cellId);

    if (
      !cellIds.includes(value.cellId) ||
      !cell ||
      !cell.options.some((option) => option.id === value.optionId)
    ) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }
  }
}

function assertKnownDiagramLabelingValues(
  values: RichClosedDiagramLabelingValue[],
  question: Extract<RichClosedQuestion, { questionKind: 'diagram_labeling' }>,
) {
  const slotIds = question.slots.map((slot) => slot.id);
  const slotsById = new Map(question.slots.map((slot) => [slot.id, slot]));
  const submittedSlotIds = values.map((value) => value.slotId);

  if (
    values.length === 0 ||
    values.length !== question.slots.length ||
    hasDuplicates(submittedSlotIds)
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  for (const value of values) {
    const slot = slotsById.get(value.slotId);

    if (
      !slotIds.includes(value.slotId) ||
      !slot ||
      !slot.options.some((option) => option.id === value.optionId)
    ) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }
  }
}

function readRequiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.trim();
}

function readRequiredInteger(value: unknown): number {
  if (!Number.isInteger(value)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value as number;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map(readRequiredString);
}

function readPairs(value: unknown): RichClosedPair[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((pair) => {
    if (!isRecord(pair)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      leftId: readRequiredString(pair.leftId),
      rightId: readRequiredString(pair.rightId),
    };
  });
}

function readTrueFalseValues(value: unknown): RichClosedTrueFalseValue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((item) => {
    if (!isRecord(item) || typeof item.value !== 'boolean') {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      rowId: readRequiredString(item.rowId),
      value: item.value,
    };
  });
}

function readCauseConsequencePairs(
  value: unknown,
): RichClosedCauseConsequencePair[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((pair) => {
    if (!isRecord(pair)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      causeId: readRequiredString(pair.causeId),
      consequenceId: readRequiredString(pair.consequenceId),
    };
  });
}

function readInstitutionMatrixValues(
  value: unknown,
): RichClosedInstitutionMatrixValue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      cellId: readRequiredString(item.cellId),
      optionId: readRequiredString(item.optionId),
    };
  });
}

function readDiagramLabelingValues(
  value: unknown,
): RichClosedDiagramLabelingValue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      slotId: readRequiredString(item.slotId),
      optionId: readRequiredString(item.optionId),
    };
  });
}

function hasForbiddenSubmitField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenSubmitField);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => {
    if (
      key.startsWith('correct') ||
      key === 'correction' ||
      key === 'correctionPayload' ||
      key === 'explanation' ||
      key === 'feedback' ||
      key === 'choiceFeedback' ||
      key === 'modelAnswer' ||
      key === 'answerText' ||
      key === 'freeTextAnswer' ||
      key === 'textAnswer' ||
      key === 'score' ||
      key === 'partialScore' ||
      key === 'expectedValue' ||
      key === 'workedSteps' ||
      key === 'answersPayload' ||
      key === 'expectedAnswer' ||
      key === 'expectedAnswers' ||
      key === 'semanticLabel' ||
      key === 'answerHint' ||
      isForbiddenRenderKey(key)
    ) {
      return true;
    }

    return hasForbiddenSubmitField(nestedValue);
  });
}

function cloneAnswer(answer: RichClosedAnswer): RichClosedAnswer {
  switch (answer.questionKind) {
    case 'single_choice':
    case 'case_qualification':
      return { ...answer };
    case 'multiple_choice':
      return { ...answer, choiceIds: [...answer.choiceIds] };
    case 'matching':
      return { ...answer, pairs: clonePairs(answer.pairs) };
    case 'ordering':
      return { ...answer, orderedIds: [...answer.orderedIds] };
    case 'timeline':
      return { ...answer, orderedEventIds: [...answer.orderedEventIds] };
    case 'date_slider':
      return { ...answer };
    case 'true_false_grid':
      return { ...answer, values: cloneTrueFalseValues(answer.values) };
    case 'cause_consequence':
      return { ...answer, pairs: cloneCauseConsequencePairs(answer.pairs) };
    case 'institution_matrix':
      return { ...answer, values: cloneInstitutionMatrixValues(answer.values) };
    case 'diagram_labeling':
      return { ...answer, values: cloneDiagramLabelingValues(answer.values) };
    case 'calculation_mcq':
      return { ...answer };
    case 'image_choice':
      return { ...answer };
    case 'error_detection':
      return { ...answer };
  }
}

function clonePairs(pairs: RichClosedPair[]): RichClosedPair[] {
  return pairs.map((pair) => ({ ...pair }));
}

function cloneTrueFalseValues(
  values: RichClosedTrueFalseValue[],
): RichClosedTrueFalseValue[] {
  return values.map((value) => ({ ...value }));
}

function cloneCauseConsequencePairs(
  pairs: RichClosedCauseConsequencePair[],
): RichClosedCauseConsequencePair[] {
  return pairs.map((pair) => ({ ...pair }));
}

function cloneInstitutionMatrixValues(
  values: RichClosedInstitutionMatrixValue[],
): RichClosedInstitutionMatrixValue[] {
  return values.map((value) => ({ ...value }));
}

function cloneDiagramLabelingValues(
  values: RichClosedDiagramLabelingValue[],
): RichClosedDiagramLabelingValue[] {
  return values.map((value) => ({ ...value }));
}

function areStringSetsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    right.every((value) => left.includes(value))
  );
}

function arePairsEqual(left: RichClosedPair[], right: RichClosedPair[]) {
  return areStringSetsEqual(pairKeys(left), pairKeys(right));
}

function areTrueFalseValuesEqual(
  left: RichClosedTrueFalseValue[],
  right: RichClosedTrueFalseValue[],
) {
  return areStringSetsEqual(
    trueFalseValueKeys(left),
    trueFalseValueKeys(right),
  );
}

function areCauseConsequencePairsEqual(
  left: RichClosedCauseConsequencePair[],
  right: RichClosedCauseConsequencePair[],
) {
  return areStringSetsEqual(
    causeConsequencePairKeys(left),
    causeConsequencePairKeys(right),
  );
}

function areInstitutionMatrixValuesEqual(
  left: RichClosedInstitutionMatrixValue[],
  right: RichClosedInstitutionMatrixValue[],
) {
  return areStringSetsEqual(
    institutionMatrixValueKeys(left),
    institutionMatrixValueKeys(right),
  );
}

function areDiagramLabelingValuesEqual(
  left: RichClosedDiagramLabelingValue[],
  right: RichClosedDiagramLabelingValue[],
) {
  return areStringSetsEqual(
    diagramLabelingValueKeys(left),
    diagramLabelingValueKeys(right),
  );
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function pairKeys(pairs: RichClosedPair[]): string[] {
  return pairs.map((pair) => tupleKey(pair.leftId, pair.rightId));
}

function trueFalseValueKeys(values: RichClosedTrueFalseValue[]): string[] {
  return values.map((value) => tupleKey(value.rowId, value.value));
}

function causeConsequencePairKeys(
  pairs: RichClosedCauseConsequencePair[],
): string[] {
  return pairs.map((pair) => tupleKey(pair.causeId, pair.consequenceId));
}

function institutionMatrixValueKeys(
  values: RichClosedInstitutionMatrixValue[],
): string[] {
  return values.map((value) => tupleKey(value.cellId, value.optionId));
}

function diagramLabelingValueKeys(
  values: RichClosedDiagramLabelingValue[],
): string[] {
  return values.map((value) => tupleKey(value.slotId, value.optionId));
}

function tupleKey(...values: Array<string | boolean>): string {
  return JSON.stringify(values);
}

function isForbiddenRenderKey(key: string): boolean {
  return [
    'html',
    'svg',
    'rawSvg',
    'mermaid',
    'markdown',
    'widget',
    'component',
    'renderPayload',
    'style',
    'css',
    'script',
    'formula',
    'expression',
    'rawFormula',
    'calculationCode',
    'javascript',
    'python',
    'imageUrl',
    'assetUrl',
    'url',
    'remoteUrl',
    'src',
    'href',
    'storagePath',
    'bucketPath',
    'cdnUrl',
    'base64',
    'dataUri',
    'blob',
    'rawImage',
    'assetPath',
    'canvas',
    'code',
    'markup',
  ].includes(key);
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
