import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import {
  DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID,
  resolveDiagnosticQuizMaxQuestionCount,
  resolveDiagnosticQuizQuestionCount,
} from '../application/diagnostic-quiz-question-count';
import { StartOpenQuestionActivityUseCase } from '../application/start-open-question-activity.use-case';
import { StartNextActivityUseCase } from '../application/start-next-activity.use-case';
import { SubmitOpenAnswerUseCase } from '../application/submit-open-answer.use-case';
import { SubmitActivityResultUseCase } from '../application/submit-activity-result.use-case';
import {
  RICH_CLOSED_GENERATION_CONTRACT_INVALID,
  RICH_CLOSED_GENERATION_FAILED,
  RICH_CLOSED_GENERATION_QUALITY_REJECTED,
  RICH_CLOSED_GENERATION_SCHEMA_INVALID,
  RICH_CLOSED_GENERATION_SOURCE_INVALID,
  RICH_CLOSED_SESSION_ALREADY_COMPLETED,
  RICH_CLOSED_SESSION_NOT_COMPLETED,
  RICH_CLOSED_SESSION_NOT_FOUND,
  RICH_CLOSED_SOURCE_CONTEXT_EMPTY,
  RICH_CLOSED_START_INVALID_INPUT,
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
} from '../application/rich-closed-questions/rich-closed-question-errors';
import { GetRichClosedExerciseResultUseCase } from '../application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from '../application/rich-closed-questions/get-rich-closed-exercise.use-case';
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedAnswer,
  type RichClosedQuestionKind,
} from '../application/rich-closed-questions/rich-closed-question.types';
import {
  assertRichClosedQuestionTypeMix,
  StartRichClosedExerciseUseCase,
} from '../application/rich-closed-questions/start-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from '../application/rich-closed-questions/submit-rich-closed-exercise.use-case';
import type {
  DiagnosticQuizSelectionMode,
  DiagnosticQuizVisualType,
} from '../application/diagnostic-quiz-generator';

class StartActivityDto {
  subjectId!: string;
  knowledgeUnitId?: string;
  questionCount?: number;
  visualsEnabled?: boolean;
  visualTypes?: string[];
  selectionModes?: string[];
}

class SubmitActivityDto {
  answers!: Array<{
    questionId: string;
    choiceId?: string;
    choiceIds?: string[];
  }>;
}

class StartOpenQuestionDto {
  subjectId!: string;
  knowledgeUnitId!: string;
}

class SubmitOpenAnswerDto {
  answerText!: string;
}

class StartRichClosedExerciseDto {
  subjectId!: string;
  documentId?: string | null;
  knowledgeUnitId!: string;
  questionCount?: number;
  complexityProfile?: string;
  questionTypeMix?: Record<string, unknown>;
}

class SubmitRichClosedExerciseDto {
  answers!: unknown[];
}

interface ValidatedActivityAnswer {
  questionId: string;
  choiceId?: string;
  choiceIds?: string[];
}

interface ValidatedStartActivityBody {
  subjectId: string;
  knowledgeUnitId?: string;
  questionCount?: number;
  visualsEnabled?: boolean;
  visualTypes?: DiagnosticQuizVisualType[];
  selectionModes?: DiagnosticQuizSelectionMode[];
}

interface ValidatedStartRichClosedBody {
  subjectId: string;
  documentId?: string | null;
  knowledgeUnitId: string;
  questionCount: number;
  complexityProfile: 'standard' | 'exam' | 'advanced';
  questionTypeMix?: Partial<Record<RichClosedQuestionKind, number>>;
}

@Controller('activities')
@UseGuards(FirebaseAuthGuard)
export class ActivitiesController {
  constructor(
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
    private readonly submitActivityResult: SubmitActivityResultUseCase,
    private readonly submitOpenAnswer: SubmitOpenAnswerUseCase,
    private readonly startRichClosedExercise: StartRichClosedExerciseUseCase,
    private readonly getRichClosedExercise: GetRichClosedExerciseUseCase,
    private readonly submitRichClosedExercise: SubmitRichClosedExerciseUseCase,
    private readonly getRichClosedExerciseResult: GetRichClosedExerciseResultUseCase,
  ) {}

  @Post('next')
  start(
    @CurrentStudent() student: { id: string },
    @Body() body: StartActivityDto,
  ) {
    const validatedBody = validateStartActivityBody(body);

    return this.startNextActivity
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        questionCount: validatedBody.questionCount,
        visualsEnabled: validatedBody.visualsEnabled,
        visualTypes: validatedBody.visualTypes,
        selectionModes: validatedBody.selectionModes,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post('open-question')
  startOpenQuestion(
    @CurrentStudent() student: { id: string },
    @Body() body: StartOpenQuestionDto,
  ) {
    const validatedBody = validateStartOpenQuestionBody(body);

    return this.startOpenQuestionActivity
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post('rich-closed/start')
  startRichClosed(
    @CurrentStudent() student: { id: string },
    @Body() body: StartRichClosedExerciseDto,
  ) {
    const validatedBody = validateStartRichClosedBody(body);

    return this.startRichClosedExercise
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        documentId: validatedBody.documentId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        questionCount: validatedBody.questionCount,
        complexityProfile: validatedBody.complexityProfile,
        questionTypeMix: validatedBody.questionTypeMix,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Get('rich-closed/:sessionId')
  getRichClosed(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );

    return this.getRichClosedExercise
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post('rich-closed/:sessionId/submit')
  submitRichClosed(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitRichClosedExerciseDto,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );
    const validatedBody = validateSubmitRichClosedBody(body);

    return this.submitRichClosedExercise
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        answers: validatedBody.answers,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Get('rich-closed/:sessionId/result')
  getRichClosedResult(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );

    return this.getRichClosedExerciseResult
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post(':sessionId/result')
  submit(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitActivityDto,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );
    const validatedBody = validateSubmitActivityBody(body);

    return this.submitActivityResult
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        answers: validatedBody.answers,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post(':sessionId/open-answer')
  submitOpenQuestionAnswer(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitOpenAnswerDto,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );
    const validatedBody = validateSubmitOpenAnswerBody(body);

    return this.submitOpenAnswer
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        answerText: validatedBody.answerText,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }
}

function validateStartActivityBody(
  input: StartActivityDto,
): ValidatedStartActivityBody {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    knowledgeUnitId:
      input?.knowledgeUnitId === undefined
        ? undefined
        : validateRequiredId(input.knowledgeUnitId, 'Knowledge unit id'),
    questionCount: validateQuestionCount(input?.questionCount),
    visualsEnabled: validateOptionalBoolean(
      input?.visualsEnabled,
      'Visuals enabled',
    ),
    visualTypes: validateVisualTypes(input?.visualTypes),
    selectionModes: validateSelectionModes(input?.selectionModes),
  };
}

function validateSubmitActivityBody(input: SubmitActivityDto): {
  answers: ValidatedActivityAnswer[];
} {
  if (!Array.isArray(input?.answers)) {
    throw new BadRequestException('Activity answers must be an array');
  }

  const seenQuestionIds = new Set<string>();
  const answers = input.answers.map((answer) => {
    const questionId = validateRequiredId(answer?.questionId, 'Question id');
    const choiceId =
      answer?.choiceId === undefined
        ? undefined
        : validateRequiredId(answer.choiceId, 'Choice id');
    const choiceIds =
      answer?.choiceIds === undefined
        ? undefined
        : validateChoiceIds(answer.choiceIds);

    if ((choiceId === undefined) === (choiceIds === undefined)) {
      throw new BadRequestException(
        'Exactly one of choiceId or choiceIds is required',
      );
    }

    if (seenQuestionIds.has(questionId)) {
      throw new BadRequestException('Duplicate answers are not allowed');
    }

    seenQuestionIds.add(questionId);

    return {
      questionId,
      ...(choiceId === undefined ? {} : { choiceId }),
      ...(choiceIds === undefined ? {} : { choiceIds }),
    };
  });

  return { answers };
}

function validateStartOpenQuestionBody(input: StartOpenQuestionDto): {
  subjectId: string;
  knowledgeUnitId: string;
} {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    knowledgeUnitId: validateRequiredId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
  };
}

function validateSubmitOpenAnswerBody(input: SubmitOpenAnswerDto): {
  answerText: string;
} {
  if (typeof input?.answerText !== 'string') {
    throw new BadRequestException('Open answer text is required');
  }

  const answerText = input.answerText.trim();

  if (answerText.length === 0) {
    throw new BadRequestException('Open answer text is required');
  }

  return { answerText };
}

function validateStartRichClosedBody(
  input: StartRichClosedExerciseDto,
): ValidatedStartRichClosedBody {
  const questionCount = validateRichClosedQuestionCount(input?.questionCount);
  const questionTypeMix =
    input?.questionTypeMix === undefined
      ? undefined
      : validateRichClosedQuestionTypeMix(input.questionTypeMix, questionCount);

  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    documentId: validateOptionalId(input?.documentId, 'Document id'),
    knowledgeUnitId: validateRequiredId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
    questionCount,
    complexityProfile: validateRichClosedComplexityProfile(
      input?.complexityProfile,
    ),
    ...(questionTypeMix === undefined ? {} : { questionTypeMix }),
  };
}

function validateSubmitRichClosedBody(input: SubmitRichClosedExerciseDto): {
  answers: RichClosedAnswer[];
} {
  if (!Array.isArray(input?.answers) || input.answers.length === 0) {
    throw new BadRequestException(
      'Rich closed answers must be a non-empty array',
    );
  }

  const seenQuestionIds = new Set<string>();
  const answers = input.answers.map((answer) => {
    const validatedAnswer = validateRichClosedAnswer(answer);

    if (seenQuestionIds.has(validatedAnswer.questionId)) {
      throw new BadRequestException('Duplicate answers are not allowed');
    }

    seenQuestionIds.add(validatedAnswer.questionId);

    return validatedAnswer;
  });

  return { answers };
}

function validateOptionalBoolean(input: unknown, label: string) {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'boolean') {
    throw new BadRequestException(`${label} must be a boolean`);
  }

  return input;
}

function validateVisualTypes(
  input: unknown,
): DiagnosticQuizVisualType[] | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    throw new BadRequestException(
      'Diagnostic quiz visualTypes must be an array',
    );
  }

  const visualTypes = input.map((value) => {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Diagnostic quiz visualTypes must contain strings',
      );
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === 'IMAGE') {
      throw new BadRequestException(
        'Diagnostic quiz IMAGE visuals are not supported yet',
      );
    }

    if (normalized !== 'CHART' && normalized !== 'DIAGRAM') {
      throw new BadRequestException('Diagnostic quiz visual type is invalid');
    }

    return normalized;
  });

  return Array.from(new Set(visualTypes));
}

function validateSelectionModes(
  input: unknown,
): DiagnosticQuizSelectionMode[] | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    throw new BadRequestException(
      'Diagnostic quiz selectionModes must be an array',
    );
  }

  const selectionModes = input.map((value) => {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Diagnostic quiz selectionModes must contain strings',
      );
    }

    const normalized = value.trim();

    if (normalized !== 'single' && normalized !== 'multiple') {
      throw new BadRequestException(
        'Diagnostic quiz selection mode is invalid',
      );
    }

    return normalized;
  });

  return Array.from(new Set(selectionModes));
}

function validateChoiceIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Choice ids must be a non-empty array');
  }

  return input.map((choiceId) => validateRequiredId(choiceId, 'Choice id'));
}

function validateOptionalId(
  input: unknown,
  label: string,
): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  return validateRequiredId(input, label);
}

function validateRequiredId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }

  return input.trim();
}

function validateQuestionCount(input: unknown): number | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'number') {
    throw questionCountBadRequest();
  }

  try {
    return resolveDiagnosticQuizQuestionCount(input);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID
    ) {
      throw questionCountBadRequest();
    }

    throw error;
  }
}

function validateRichClosedQuestionCount(input: unknown): number {
  if (input === undefined) {
    return 6;
  }

  if (
    typeof input !== 'number' ||
    !Number.isInteger(input) ||
    input < 6 ||
    input > 20
  ) {
    throw new BadRequestException(
      'Rich closed question count must be an integer between 6 and 20',
    );
  }

  return input;
}

function validateRichClosedComplexityProfile(
  input: unknown,
): 'standard' | 'exam' | 'advanced' {
  if (input === undefined) {
    return 'exam';
  }

  if (input === 'standard' || input === 'exam' || input === 'advanced') {
    return input;
  }

  throw new BadRequestException('Rich closed complexity profile is invalid');
}

function validateRichClosedQuestionTypeMix(
  input: unknown,
  questionCount: number,
): Partial<Record<RichClosedQuestionKind, number>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException(
      'Rich closed questionTypeMix must be an object',
    );
  }

  const mix: Partial<Record<RichClosedQuestionKind, number>> = {};

  for (const [key, value] of Object.entries(input)) {
    if (
      !isRichClosedQuestionKind(key) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new BadRequestException('Rich closed questionTypeMix is invalid');
    }

    mix[key] = Number(value);
  }

  try {
    assertRichClosedQuestionTypeMix({
      questionCount,
      questionTypeMix: mix,
    });
  } catch {
    throw new BadRequestException('Rich closed questionTypeMix is invalid');
  }

  return mix;
}

function validateRichClosedAnswer(input: unknown): RichClosedAnswer {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    containsForbiddenRichClosedSubmitField(input)
  ) {
    throw new BadRequestException('Rich closed answer is invalid');
  }

  const answer = input as Record<string, unknown>;
  const questionId = validateRequiredId(answer.questionId, 'Question id');
  const questionKind = answer.questionKind;

  if (!isRichClosedQuestionKind(questionKind)) {
    throw new BadRequestException('Rich closed question kind is invalid');
  }

  switch (questionKind) {
    case 'single_choice':
    case 'case_qualification':
      return {
        questionId,
        questionKind,
        choiceId: validateRequiredId(answer.choiceId, 'Choice id'),
      };
    case 'multiple_choice':
      return {
        questionId,
        questionKind,
        choiceIds: validateChoiceIds(answer.choiceIds),
      };
    case 'matching':
      return {
        questionId,
        questionKind,
        pairs: validateRichClosedPairs(answer.pairs),
      };
    case 'ordering':
      return {
        questionId,
        questionKind,
        orderedIds: validateChoiceIds(answer.orderedIds),
      };
    case 'timeline':
      return {
        questionId,
        questionKind,
        orderedEventIds: validateChoiceIds(answer.orderedEventIds),
      };
    case 'date_slider':
      return {
        questionId,
        questionKind,
        year: validateRichClosedYear(answer.year),
      };
    case 'true_false_grid':
      return {
        questionId,
        questionKind,
        values: validateRichClosedTrueFalseValues(answer.values),
      };
    case 'cause_consequence':
      return {
        questionId,
        questionKind,
        pairs: validateRichClosedCauseConsequencePairs(answer.pairs),
      };
    case 'institution_matrix':
      return {
        questionId,
        questionKind,
        values: validateRichClosedInstitutionMatrixValues(answer.values),
      };
    case 'diagram_labeling':
      return {
        questionId,
        questionKind,
        values: validateRichClosedDiagramLabelingValues(answer.values),
      };
    case 'calculation_mcq':
      return {
        questionId,
        questionKind,
        choiceId: validateRequiredId(answer.choiceId, 'Choice id'),
      };
    case 'error_detection':
      return {
        questionId,
        questionKind,
        errorId: validateRequiredId(answer.errorId, 'Error id'),
      };
  }
}

function validateRichClosedPairs(input: unknown): Array<{
  leftId: string;
  rightId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Rich closed matching pairs are required');
  }

  return input.map((pair) => {
    if (typeof pair !== 'object' || pair === null || Array.isArray(pair)) {
      throw new BadRequestException('Rich closed matching pair is invalid');
    }

    const record = pair as Record<string, unknown>;

    return {
      leftId: validateRequiredId(record.leftId, 'Left id'),
      rightId: validateRequiredId(record.rightId, 'Right id'),
    };
  });
}

function validateRichClosedTrueFalseValues(input: unknown): Array<{
  rowId: string;
  value: boolean;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Rich closed true/false values are required');
  }

  return input.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException('Rich closed true/false value is invalid');
    }

    const record = value as Record<string, unknown>;
    if (typeof record.value !== 'boolean') {
      throw new BadRequestException('Rich closed true/false value is invalid');
    }

    return {
      rowId: validateRequiredId(record.rowId, 'Row id'),
      value: record.value,
    };
  });
}

function validateRichClosedCauseConsequencePairs(input: unknown): Array<{
  causeId: string;
  consequenceId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException(
      'Rich closed cause/consequence pairs are required',
    );
  }

  return input.map((pair) => {
    if (typeof pair !== 'object' || pair === null || Array.isArray(pair)) {
      throw new BadRequestException(
        'Rich closed cause/consequence pair is invalid',
      );
    }

    const record = pair as Record<string, unknown>;

    return {
      causeId: validateRequiredId(record.causeId, 'Cause id'),
      consequenceId: validateRequiredId(record.consequenceId, 'Consequence id'),
    };
  });
}

function validateRichClosedInstitutionMatrixValues(input: unknown): Array<{
  cellId: string;
  optionId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException(
      'Rich closed institution matrix values are required',
    );
  }

  return input.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Rich closed institution matrix value is invalid',
      );
    }

    const record = value as Record<string, unknown>;

    return {
      cellId: validateRequiredId(record.cellId, 'Cell id'),
      optionId: validateRequiredId(record.optionId, 'Option id'),
    };
  });
}

function validateRichClosedDiagramLabelingValues(input: unknown): Array<{
  slotId: string;
  optionId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException(
      'Rich closed diagram labeling values are required',
    );
  }

  return input.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Rich closed diagram labeling value is invalid',
      );
    }

    const record = value as Record<string, unknown>;

    return {
      slotId: validateRequiredId(record.slotId, 'Slot id'),
      optionId: validateRequiredId(record.optionId, 'Option id'),
    };
  });
}

function validateRichClosedYear(input: unknown): number {
  if (!Number.isInteger(input)) {
    throw new BadRequestException('Rich closed year must be an integer');
  }

  return input as number;
}

function containsForbiddenRichClosedSubmitField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenRichClosedSubmitField);
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.entries(value).some(([key, nested]) => {
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
      isForbiddenRichClosedRenderKey(key)
    ) {
      return true;
    }

    return containsForbiddenRichClosedSubmitField(nested);
  });
}

function isForbiddenRichClosedRenderKey(key: string): boolean {
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
    'canvas',
    'code',
    'markup',
  ].includes(key);
}

function isRichClosedQuestionKind(
  value: unknown,
): value is RichClosedQuestionKind {
  return (
    typeof value === 'string' &&
    RICH_CLOSED_QUESTION_KINDS.includes(value as RichClosedQuestionKind)
  );
}

function questionCountBadRequest(): BadRequestException {
  return new BadRequestException(
    `Diagnostic quiz question count must be an integer between 1 and ${resolveDiagnosticQuizMaxQuestionCount()}`,
  );
}

function normalizeActivityError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === 'Activity session not found') {
      throw new NotFoundException(error.message);
    }

    if (error.message === RICH_CLOSED_SESSION_NOT_FOUND) {
      throw new NotFoundException(error.message);
    }

    if (error.message === 'Activity session already completed') {
      throw new ConflictException(error.message);
    }

    if (error.message === 'Activity session already submitted') {
      throw new ConflictException(error.message);
    }

    if (
      error.message === RICH_CLOSED_SESSION_ALREADY_COMPLETED ||
      error.message === RICH_CLOSED_SESSION_NOT_COMPLETED
    ) {
      throw new ConflictException(error.message);
    }

    if (
      error.message === 'Knowledge unit does not belong to student subject' ||
      error.message === 'No knowledge unit available for subject' ||
      error.message === 'Activity session is not an open question' ||
      error.message === 'Open answer is too short' ||
      error.message === 'Open answer is too long' ||
      error.message === 'Duplicate answers are not allowed' ||
      error.message === 'Missing answers are not allowed' ||
      error.message === 'Question does not belong to activity session' ||
      error.message === 'Choice does not belong to question' ||
      error.message === 'Answer shape does not match question selection mode' ||
      error.message === 'Selection count is invalid for question' ||
      error.message === RICH_CLOSED_START_INVALID_INPUT ||
      error.message === RICH_CLOSED_SUBMIT_INVALID_INPUT
    ) {
      throw new BadRequestException(error.message);
    }

    if (
      error.message === 'Generated diagnostic quiz is invalid' ||
      error.message === 'Question source chunk not found' ||
      error.message === 'Question visual source chunk not found' ||
      error.message === 'Open question source chunk not found' ||
      error.message === 'OPEN_QUESTION_SOURCE_INVALID' ||
      error.message === 'OPEN_QUESTION_GENERATION_INVALID' ||
      error.message === 'OPEN_QUESTION_EMPTY_OUTPUT' ||
      error.message === 'OPEN_ANSWER_EVALUATION_SOURCE_INVALID' ||
      error.message === 'OPEN_ANSWER_EVALUATION_INVALID' ||
      error.message === 'OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT' ||
      error.message === 'OPEN_ANSWER_EVALUATION_FAILED' ||
      error.message === RICH_CLOSED_SOURCE_CONTEXT_EMPTY ||
      error.message === RICH_CLOSED_GENERATION_FAILED ||
      error.message === RICH_CLOSED_GENERATION_SCHEMA_INVALID ||
      error.message === RICH_CLOSED_GENERATION_CONTRACT_INVALID ||
      error.message === RICH_CLOSED_GENERATION_QUALITY_REJECTED ||
      error.message === RICH_CLOSED_GENERATION_SOURCE_INVALID
    ) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}
