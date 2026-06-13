import { BadRequestException } from '@nestjs/common';
import { CreateSubjectUseCase } from '../application/create-subject.use-case';
import { GetSubjectUseCase } from '../application/get-subject.use-case';
import { ListSubjectsUseCase } from '../application/list-subjects.use-case';
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

    return {
      controller: new SubjectsController(
        createSubject,
        listSubjects,
        getSubject,
      ),
      executeCreate,
      executeGet,
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
});
