import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { CreateSubjectUseCase } from '../application/create-subject.use-case';
import { DeleteSubjectUseCase } from '../application/delete-subject.use-case';
import { GetSubjectUseCase } from '../application/get-subject.use-case';
import { ListSubjectsUseCase } from '../application/list-subjects.use-case';

class CreateSubjectDto {
  name!: string;
  priority!: 1 | 2 | 3 | 4 | 5;
}

@Controller('subjects')
@UseGuards(FirebaseAuthGuard)
export class SubjectsController {
  constructor(
    private readonly createSubject: CreateSubjectUseCase,
    private readonly listSubjects: ListSubjectsUseCase,
    private readonly getSubject: GetSubjectUseCase,
    private readonly deleteSubject: DeleteSubjectUseCase,
  ) {}

  @Get()
  list(@CurrentStudent() student: { id: string }) {
    return this.listSubjects.execute(student.id);
  }

  @Get(':id')
  get(@CurrentStudent() student: { id: string }, @Param('id') id: string) {
    return this.getSubject.execute({
      studentId: student.id,
      subjectId: id,
    });
  }

  @Post()
  create(
    @CurrentStudent() student: { id: string },
    @Body() body: CreateSubjectDto,
  ) {
    const validatedBody = validateCreateSubjectBody(body);

    return this.createSubject
      .execute({
        studentId: student.id,
        name: validatedBody.name,
        priority: validatedBody.priority,
      })
      .catch((error: unknown) => {
        normalizeSubjectValidationError(error);
      });
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentStudent() student: { id: string }, @Param('id') id: string) {
    return this.deleteSubject.execute({
      studentId: student.id,
      subjectId: trimRequiredSubjectId(id),
    });
  }
}

function trimRequiredSubjectId(id: string): string {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new BadRequestException('Subject id is required');
  }

  return id.trim();
}

function validateCreateSubjectBody(body: CreateSubjectDto): CreateSubjectDto {
  if (typeof body?.name !== 'string' || body.name.trim().length < 2) {
    throw new BadRequestException(
      'Subject name must contain at least 2 characters',
    );
  }

  if (
    !Number.isInteger(body.priority) ||
    body.priority < 1 ||
    body.priority > 5
  ) {
    throw new BadRequestException('Subject priority must be between 1 and 5');
  }

  return body;
}

function normalizeSubjectValidationError(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message === 'Subject name must contain at least 2 characters' ||
      error.message === 'Subject priority must be between 1 and 5')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
