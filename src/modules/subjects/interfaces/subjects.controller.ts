import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { CreateSubjectUseCase } from '../application/create-subject.use-case';
import { ArchiveSubjectUseCase } from '../application/archive-subject.use-case';
import { DeleteSubjectUseCase } from '../application/delete-subject.use-case';
import { GetSubjectLifecycleUseCase } from '../application/get-subject-lifecycle.use-case';
import { GetSubjectUseCase } from '../application/get-subject.use-case';
import { ListSubjectsUseCase } from '../application/list-subjects.use-case';
import { UpdateSubjectUseCase } from '../application/update-subject.use-case';
import {
  SubjectArchiveBlockedError,
  SubjectDeleteBlockedError,
} from '../domain/subject-lifecycle.entity';

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
    private readonly getSubjectLifecycle: GetSubjectLifecycleUseCase,
    private readonly updateSubject: UpdateSubjectUseCase,
    private readonly archiveSubject: ArchiveSubjectUseCase,
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

  @Get(':id/lifecycle')
  lifecycle(
    @CurrentStudent() student: { id: string },
    @Param('id') id: string,
  ) {
    return this.getSubjectLifecycle
      .execute({
        studentId: student.id,
        subjectId: trimRequiredSubjectId(id),
      })
      .catch(normalizeSubjectValidationError);
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

  @Patch(':id')
  update(
    @CurrentStudent() student: { id: string },
    @Param('id') id: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateUpdateSubjectBody(body);

    return this.updateSubject
      .execute({
        studentId: student.id,
        subjectId: trimRequiredSubjectId(id),
        ...validatedBody,
      })
      .catch(normalizeSubjectValidationError);
  }

  @Post(':id/archive')
  archive(@CurrentStudent() student: { id: string }, @Param('id') id: string) {
    return this.archiveSubject
      .execute({
        studentId: student.id,
        subjectId: trimRequiredSubjectId(id),
      })
      .catch(normalizeSubjectValidationError);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentStudent() student: { id: string }, @Param('id') id: string) {
    return this.deleteSubject
      .execute({
        studentId: student.id,
        subjectId: trimRequiredSubjectId(id),
      })
      .catch(normalizeSubjectValidationError);
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

function validateUpdateSubjectBody(body: Record<string, unknown>): {
  name?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
} {
  const allowedFields = new Set(['name', 'priority']);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException('Subject update contains unsupported fields');
  }

  const update: { name?: string; priority?: 1 | 2 | 3 | 4 | 5 } = {};

  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      throw new BadRequestException(
        'Subject name must contain at least 2 characters',
      );
    }

    update.name = body.name.trim();
  }

  if ('priority' in body) {
    if (
      !Number.isInteger(body.priority) ||
      (body.priority as number) < 1 ||
      (body.priority as number) > 5
    ) {
      throw new BadRequestException('Subject priority must be between 1 and 5');
    }

    update.priority = body.priority as 1 | 2 | 3 | 4 | 5;
  }

  if (Object.keys(update).length === 0) {
    throw new BadRequestException('Subject update requires at least one field');
  }

  return update;
}

function normalizeSubjectValidationError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (
    error instanceof SubjectDeleteBlockedError ||
    error instanceof SubjectArchiveBlockedError
  ) {
    throw new ConflictException({
      code: error.code,
      message: error.message,
      decision: error.decision,
    });
  }

  if (
    error instanceof Error &&
    (error.message === 'Subject name must contain at least 2 characters' ||
      error.message === 'Subject priority must be between 1 and 5')
  ) {
    throw new BadRequestException(error.message);
  }

  if (error instanceof Error && error.message === 'Subject not found') {
    throw new NotFoundException(error.message);
  }

  throw error;
}
