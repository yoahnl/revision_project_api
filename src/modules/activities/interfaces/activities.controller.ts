import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
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
import { StartNextActivityUseCase } from '../application/start-next-activity.use-case';
import { SubmitActivityResultUseCase } from '../application/submit-activity-result.use-case';
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

@Controller('activities')
@UseGuards(FirebaseAuthGuard)
export class ActivitiesController {
  constructor(
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly submitActivityResult: SubmitActivityResultUseCase,
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

    if (error.message === 'Activity session already completed') {
      throw new ConflictException(error.message);
    }

    if (
      error.message === 'Knowledge unit does not belong to student subject' ||
      error.message === 'No knowledge unit available for subject' ||
      error.message === 'Duplicate answers are not allowed' ||
      error.message === 'Missing answers are not allowed' ||
      error.message === 'Question does not belong to activity session' ||
      error.message === 'Choice does not belong to question' ||
      error.message === 'Answer shape does not match question selection mode' ||
      error.message === 'Selection count is invalid for question'
    ) {
      throw new BadRequestException(error.message);
    }

    if (
      error.message === 'Generated diagnostic quiz is invalid' ||
      error.message === 'Question source chunk not found' ||
      error.message === 'Question visual source chunk not found'
    ) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}
