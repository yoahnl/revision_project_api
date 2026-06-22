import { BadRequestException } from '@nestjs/common';
import { ArchiveSubjectUseCase } from '../application/archive-subject.use-case';
import { CreateSubjectUseCase } from '../application/create-subject.use-case';
import { DeleteSubjectUseCase } from '../application/delete-subject.use-case';
import { GetSubjectLifecycleUseCase } from '../application/get-subject-lifecycle.use-case';
import { GetSubjectUseCase } from '../application/get-subject.use-case';
import { ListSubjectsUseCase } from '../application/list-subjects.use-case';
import { UpdateSubjectUseCase } from '../application/update-subject.use-case';
import { SubjectsController } from './subjects.controller';

describe('SubjectsController', () => {
  const student = { id: 'student-1' };

  function createController() {
    const executeCreate = jest.fn().mockResolvedValue({
      id: 'subject-1',
      studentId: 'student-1',
      name: 'Physiologie',
      priority: 4,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const createSubject = {
      execute: executeCreate,
    } as unknown as CreateSubjectUseCase;

    const listSubjects = {
      execute: jest.fn(),
    } as unknown as ListSubjectsUseCase;

    const executeGet = jest.fn().mockResolvedValue({
      id: 'subject-1',
      studentId: 'student-1',
      name: 'Physiologie',
      priority: 4,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const getSubject = {
      execute: executeGet,
    } as unknown as GetSubjectUseCase;

    const executeLifecycle = jest.fn().mockResolvedValue({
      subjectId: 'subject-1',
      status: 'ACTIVE',
      recommendedAction: 'DELETE',
      canDelete: true,
      canArchive: false,
      canUpdate: true,
      blockingReasons: [],
      userMessage: 'Cette matière peut être supprimée.',
    });

    const getSubjectLifecycle = {
      execute: executeLifecycle,
    } as unknown as GetSubjectLifecycleUseCase;

    const executeUpdate = jest.fn().mockResolvedValue({
      id: 'subject-1',
      studentId: 'student-1',
      name: 'Droit public',
      priority: 2,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const updateSubject = {
      execute: executeUpdate,
    } as unknown as UpdateSubjectUseCase;

    const executeArchive = jest.fn().mockResolvedValue({
      subjectId: 'subject-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      canUpdate: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
      userMessage: 'Cette matière est archivée.',
    });

    const archiveSubject = {
      execute: executeArchive,
    } as unknown as ArchiveSubjectUseCase;

    const executeDelete = jest.fn().mockResolvedValue(undefined);

    const deleteSubject = {
      execute: executeDelete,
    } as unknown as DeleteSubjectUseCase;

    return {
      controller: new SubjectsController(
        createSubject,
        listSubjects,
        getSubject,
        getSubjectLifecycle,
        updateSubject,
        archiveSubject,
        deleteSubject,
      ),
      executeCreate,
      executeGet,
      executeLifecycle,
      executeUpdate,
      executeArchive,
      executeDelete,
    };
  }

  it('creates subjects for the current student and ignores body studentId', async () => {
    const { controller, executeCreate } = createController();

    await controller.create(student, {
      studentId: 'attacker-student',
      name: ' Physiologie ',
      priority: 4,
    } as never);

    expect(executeCreate).toHaveBeenCalledWith({
      studentId: 'student-1',
      name: ' Physiologie ',
      priority: 4,
    });
  });

  it('rejects invalid subject payloads with 400', () => {
    const invalidBodies = [
      { name: ' A ', priority: 4 },
      { name: 42, priority: 4 },
      { name: 'Physiologie', priority: 0 },
      { name: 'Physiologie', priority: 6 },
      { name: 'Physiologie', priority: 3.5 },
      { name: 'Physiologie', priority: '4' },
    ];

    for (const body of invalidBodies) {
      const { controller } = createController();

      expect(() => controller.create(student, body as never)).toThrow(
        BadRequestException,
      );
    }
  });

  it('gets a subject for the current student', async () => {
    const { controller, executeGet } = createController();

    await controller.get(student, 'subject-1');

    expect(executeGet).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('deletes a subject owned by the current student', async () => {
    const { controller, executeDelete } = createController();

    await controller.delete(student, ' subject-1 ');

    expect(executeDelete).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('returns a lifecycle decision for the current student subject', async () => {
    const { controller, executeLifecycle } = createController();

    await controller.lifecycle(student, ' subject-1 ');

    expect(executeLifecycle).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('updates a subject with trimmed fields', async () => {
    const { controller, executeUpdate } = createController();

    await controller.update(student, ' subject-1 ', {
      name: ' Droit public ',
      priority: 2,
    });

    expect(executeUpdate).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      name: 'Droit public',
      priority: 2,
    });
  });

  it('archives a subject through the lifecycle use case', async () => {
    const { controller, executeArchive } = createController();

    await controller.archive(student, ' subject-1 ');

    expect(executeArchive).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('rejects empty subject ids while deleting', () => {
    const { controller } = createController();

    expect(() => controller.delete(student, '  ')).toThrow(BadRequestException);
  });
});
