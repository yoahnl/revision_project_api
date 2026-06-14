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

class StartActivityDto {
  subjectId!: string;
  knowledgeUnitId?: string;
  questionCount?: number;
}

class SubmitActivityDto {
  answers!: Array<{ questionId: string; choiceId: string }>;
}

interface ValidatedActivityAnswer {
  questionId: string;
  choiceId: string;
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

function validateStartActivityBody(input: StartActivityDto): StartActivityDto {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    knowledgeUnitId:
      input?.knowledgeUnitId === undefined
        ? undefined
        : validateRequiredId(input.knowledgeUnitId, 'Knowledge unit id'),
    questionCount: validateQuestionCount(input?.questionCount),
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
    const choiceId = validateRequiredId(answer?.choiceId, 'Choice id');

    if (seenQuestionIds.has(questionId)) {
      throw new BadRequestException('Duplicate answers are not allowed');
    }

    seenQuestionIds.add(questionId);

    return {
      questionId,
      choiceId,
    };
  });

  return { answers };
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
      error.message === 'Choice does not belong to question'
    ) {
      throw new BadRequestException(error.message);
    }

    if (
      error.message === 'Generated diagnostic quiz is invalid' ||
      error.message === 'Question source chunk not found'
    ) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}
