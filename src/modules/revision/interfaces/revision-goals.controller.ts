import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { SaveRevisionGoalUseCase } from '../application/save-revision-goal.use-case';

class SaveRevisionGoalDto {
  targetDate!: string;
  weeklyMinutes!: number;
}

@Controller('revision-goals')
@UseGuards(FirebaseAuthGuard)
export class RevisionGoalsController {
  constructor(private readonly saveRevisionGoal: SaveRevisionGoalUseCase) {}

  @Post()
  save(
    @CurrentStudent() student: { id: string },
    @Body() body: SaveRevisionGoalDto,
  ) {
    const validatedBody = validateSaveRevisionGoalBody(body);

    return this.saveRevisionGoal
      .execute({
        studentId: student.id,
        targetDate: validatedBody.targetDate,
        weeklyMinutes: validatedBody.weeklyMinutes,
      })
      .catch((error: unknown) => {
        normalizeRevisionGoalValidationError(error);
      });
  }
}

function validateSaveRevisionGoalBody(input: SaveRevisionGoalDto): {
  targetDate: Date;
  weeklyMinutes: number;
} {
  const targetDate =
    typeof input?.targetDate === 'string'
      ? new Date(input.targetDate)
      : new Date(Number.NaN);

  if (Number.isNaN(targetDate.getTime())) {
    throw new BadRequestException('Revision goal target date must be valid');
  }

  if (!Number.isInteger(input.weeklyMinutes) || input.weeklyMinutes < 30) {
    throw new BadRequestException(
      'Weekly revision time must be at least 30 minutes',
    );
  }

  return {
    targetDate,
    weeklyMinutes: input.weeklyMinutes,
  };
}

function normalizeRevisionGoalValidationError(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message === 'Revision goal target date must be valid' ||
      error.message === 'Weekly revision time must be at least 30 minutes')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
