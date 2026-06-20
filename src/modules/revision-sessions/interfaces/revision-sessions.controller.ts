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
import type { RevisionSessionPreferredAction } from '../domain/revision-session.entity';
import { CompleteQuickRevisionSessionUseCase } from '../application/complete-quick-revision-session.use-case';
import { FlagRevisionSessionQuestionUseCase } from '../application/flag-revision-session-question.use-case';
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from '../application/get-revision-session-result.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';

class StartRevisionSessionDto {
  subjectId!: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: string;
}

class FlagRevisionSessionQuestionDto {
  reason?: string;
}

interface ValidatedStartRevisionSessionBody {
  subjectId: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: RevisionSessionPreferredAction;
}

@Controller('revision-sessions')
@UseGuards(FirebaseAuthGuard)
export class RevisionSessionsController {
  constructor(
    private readonly startRevisionSession: StartRevisionSessionUseCase,
    private readonly getRevisionSession: GetRevisionSessionUseCase,
    private readonly requestNextAction: RequestNextRevisionSessionActionUseCase,
    private readonly completeQuickRevisionSession: CompleteQuickRevisionSessionUseCase,
    private readonly getRevisionSessionResult: GetRevisionSessionResultUseCase,
    private readonly flagRevisionSessionQuestion: FlagRevisionSessionQuestionUseCase,
  ) {}

  @Post()
  start(
    @CurrentStudent() student: { id: string },
    @Body() body: StartRevisionSessionDto,
  ) {
    const validatedBody = validateStartRevisionSessionBody(body);

    return this.startRevisionSession
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        documentId: validatedBody.documentId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        preferredAction: validatedBody.preferredAction,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Get(':sessionId')
  get(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.getRevisionSession
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Post(':sessionId/next-action')
  nextAction(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.requestNextAction
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Post(':sessionId/complete')
  complete(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );
    validateEmptyBody(body);

    return this.completeQuickRevisionSession
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Get(':sessionId/result')
  result(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.getRevisionSessionResult
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Post(':sessionId/questions/:questionId/flag')
  flagQuestion(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() body: FlagRevisionSessionQuestionDto | undefined,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );
    const validatedQuestionId = validateRequiredId(questionId, 'Question id');
    const reason = validateFlagQuestionBody(body);

    return this.flagRevisionSessionQuestion
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        questionId: validatedQuestionId,
        reason,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }
}

function validateStartRevisionSessionBody(
  input: StartRevisionSessionDto,
): ValidatedStartRevisionSessionBody {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    documentId: validateOptionalId(input?.documentId, 'Document id'),
    knowledgeUnitId: validateOptionalId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
    preferredAction: validatePreferredAction(input?.preferredAction),
  };
}

function validateRequiredId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }

  return input.trim();
}

function validateOptionalId(input: unknown, label: string): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  return validateRequiredId(input, label);
}

function validatePreferredAction(
  input: unknown,
): RevisionSessionPreferredAction | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'string') {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  const normalized = input.trim();

  if (
    normalized !== 'diagnostic_quiz' &&
    normalized !== 'open_question' &&
    normalized !== 'rich_closed_exercise'
  ) {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  return normalized;
}

function validateEmptyBody(input: Record<string, unknown> | undefined): void {
  if (input && Object.keys(input).length > 0) {
    throw new BadRequestException(
      'Revision session complete body must be empty',
    );
  }
}

function validateFlagQuestionBody(
  input: FlagRevisionSessionQuestionDto | undefined,
): string | null {
  if (!input) {
    return null;
  }

  const unknownField = Object.keys(input).find((field) => field !== 'reason');

  if (unknownField) {
    throw new BadRequestException(
      'Revision session flag body only accepts reason',
    );
  }

  if (input.reason === undefined || input.reason === null) {
    return null;
  }

  if (typeof input.reason !== 'string') {
    throw new BadRequestException('Revision session flag reason invalid');
  }

  const trimmed = input.reason.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 240) {
    throw new BadRequestException('Revision session flag reason too long');
  }

  return trimmed;
}

function normalizeRevisionSessionError(error: unknown): never {
  if (error instanceof Error) {
    if (
      error.message === 'Revision subject not found' ||
      error.message === 'Revision document not found' ||
      error.message === 'Revision knowledge unit not found' ||
      error.message === 'Revision session not found' ||
      error.message === 'Revision session question not found'
    ) {
      throw new NotFoundException(error.message);
    }

    if (
      error.message ===
        'Open question revision session requires a knowledge unit' ||
      error.message === 'Rich closed revision session requires a knowledge unit'
    ) {
      throw new UnprocessableEntityException(error.message);
    }

    if (error.message === 'Revision coach no action available') {
      throw new UnprocessableEntityException(error.message);
    }

    if (
      error.message === 'Revision session is not started' ||
      error.message ===
        'Quick course revision sessions do not support next actions'
    ) {
      throw new ConflictException(error.message);
    }

    if (
      error.message === 'Revision session not ready to complete' ||
      error.message === 'Revision session activity not found' ||
      error.message === 'Revision session activity not submitted' ||
      error.message === 'Revision session result not found' ||
      error.message === 'Revision session not completed' ||
      error.message === 'Revision session question cannot be flagged'
    ) {
      throw new ConflictException(error.message);
    }

    if (error.message === 'Revision session completion unsupported') {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}
