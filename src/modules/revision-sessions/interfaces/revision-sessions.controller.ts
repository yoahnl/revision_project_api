import {
  BadRequestException,
  Body,
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
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';

class StartRevisionSessionDto {
  subjectId!: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: string;
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

  if (normalized !== 'diagnostic_quiz' && normalized !== 'open_question') {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  return normalized;
}

function normalizeRevisionSessionError(error: unknown): never {
  if (error instanceof Error) {
    if (
      error.message === 'Revision subject not found' ||
      error.message === 'Revision document not found' ||
      error.message === 'Revision knowledge unit not found' ||
      error.message === 'Revision session not found'
    ) {
      throw new NotFoundException(error.message);
    }

    if (
      error.message ===
      'Open question revision session requires a knowledge unit'
    ) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}
