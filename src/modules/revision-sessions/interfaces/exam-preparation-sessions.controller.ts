import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import {
  GetExamPreparationSessionResultUseCase,
  GetExamPreparationSessionUseCase,
  SubmitExamPreparationSessionUseCase,
  type ExamPreparationAnswerInput,
} from '../application/exam-preparation-sessions.use-cases';

interface SubmitExamPreparationSessionBody {
  answers?: unknown;
}

@Controller('exam-preparation/sessions')
@UseGuards(FirebaseAuthGuard)
export class ExamPreparationSessionsController {
  constructor(
    private readonly getExamPreparationSession: GetExamPreparationSessionUseCase,
    private readonly submitExamPreparationSession: SubmitExamPreparationSessionUseCase,
    private readonly getExamPreparationSessionResult: GetExamPreparationSessionResultUseCase,
  ) {}

  @Get(':sessionId')
  get(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.getExamPreparationSession
      .execute({
        studentId: student.id,
        sessionId: validateRequiredId(sessionId, 'Revision session id'),
      })
      .catch(normalizeExamPreparationSessionError);
  }

  @Post(':sessionId/submit')
  submit(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitExamPreparationSessionBody | undefined,
  ) {
    return this.submitExamPreparationSession
      .execute({
        studentId: student.id,
        sessionId: validateRequiredId(sessionId, 'Revision session id'),
        answers: validateSubmitExamPreparationSessionBody(body),
      })
      .catch(normalizeExamPreparationSessionError);
  }

  @Get(':sessionId/result')
  result(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.getExamPreparationSessionResult
      .execute({
        studentId: student.id,
        sessionId: validateRequiredId(sessionId, 'Revision session id'),
      })
      .catch(normalizeExamPreparationSessionError);
  }
}

function validateSubmitExamPreparationSessionBody(
  input: SubmitExamPreparationSessionBody | undefined,
): ExamPreparationAnswerInput[] {
  if (!input || !Array.isArray(input.answers)) {
    throw new BadRequestException(
      'Exam preparation answers must be provided as an array',
    );
  }

  const unknownField = Object.keys(input).find((field) => field !== 'answers');
  if (unknownField) {
    throw new BadRequestException(
      'Exam preparation submit only accepts answers',
    );
  }

  return input.answers.map(validateAnswer);
}

function validateAnswer(input: unknown): ExamPreparationAnswerInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException('Exam preparation answer invalid');
  }

  const record = input as Record<string, unknown>;
  const unknownField = Object.keys(record).find(
    (field) =>
      field !== 'questionId' && field !== 'choiceId' && field !== 'choiceIds',
  );
  if (unknownField) {
    throw new BadRequestException('Exam preparation answer invalid');
  }

  const questionId = validateRequiredId(record.questionId, 'Question id');
  const hasChoiceId = record.choiceId !== undefined;
  const hasChoiceIds = record.choiceIds !== undefined;

  if (hasChoiceId === hasChoiceIds) {
    throw new BadRequestException('Exam preparation answer invalid');
  }

  if (hasChoiceId) {
    return {
      questionId,
      choiceId: validateRequiredId(record.choiceId, 'Choice id'),
    };
  }

  if (!Array.isArray(record.choiceIds)) {
    throw new BadRequestException('Exam preparation answer invalid');
  }

  return {
    questionId,
    choiceIds: record.choiceIds.map((choiceId) =>
      validateRequiredId(choiceId, 'Choice id'),
    ),
  };
}

function validateRequiredId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }

  return input.trim();
}

function normalizeExamPreparationSessionError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (
    error instanceof Error &&
    (error.message === 'Exam preparation session not found' ||
      error.message === 'Revision session not found')
  ) {
    throw new NotFoundException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'Revision session not completed' ||
      error.message === 'Revision session result not found' ||
      error.message === 'Exam preparation session not ready' ||
      error.message === 'Exam preparation session already completed' ||
      error.message === 'Activity session already completed' ||
      error.message === 'Revision session activity not submitted' ||
      error.message === 'Revision session completion unsupported')
  ) {
    throw new ConflictException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'Duplicate answers are not allowed' ||
      error.message === 'Question does not belong to activity session' ||
      error.message === 'Missing answers are not allowed' ||
      error.message === 'Answer shape does not match question selection mode' ||
      error.message === 'Choice does not belong to question' ||
      error.message === 'Duplicate choices are not allowed' ||
      error.message === 'Selection count is invalid for question')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
