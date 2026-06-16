import {
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
  RICH_CLOSED_SESSION_NOT_FOUND,
} from './rich-closed-question-errors';
import {
  type RichClosedAnswer,
  type RichClosedCorrectionItem,
  type RichClosedCorrectionPayload,
  type RichClosedExercise,
  type RichClosedExerciseResult,
  type RichClosedPair,
  type RichClosedQuestion,
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
  }
}

function assertKnownId(submittedId: string, knownIds: string[]) {
  if (!knownIds.includes(submittedId)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
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

function readRequiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.trim();
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
      key === 'workedSteps' ||
      key === 'expectedAnswer' ||
      key === 'expectedAnswers'
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
    case 'error_detection':
      return { ...answer };
  }
}

function clonePairs(pairs: RichClosedPair[]): RichClosedPair[] {
  return pairs.map((pair) => ({ ...pair }));
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

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function pairKeys(pairs: RichClosedPair[]): string[] {
  return pairs.map((pair) => `${pair.leftId}:${pair.rightId}`);
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
