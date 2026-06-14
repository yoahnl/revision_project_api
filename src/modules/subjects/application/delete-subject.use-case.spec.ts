import { NotFoundException } from '@nestjs/common';
import { DeleteSubjectUseCase } from './delete-subject.use-case';
import type { SubjectsRepository } from './subjects.repository';

describe('DeleteSubjectUseCase', () => {
  function createUseCase(deleted: boolean) {
    const deleteForStudent = jest.fn().mockResolvedValue(deleted);
    const repository = {
      deleteForStudent,
    } as unknown as SubjectsRepository;

    return {
      deleteForStudent,
      repository,
      useCase: new DeleteSubjectUseCase(repository),
    };
  }

  it('deletes a subject owned by the student', async () => {
    const { deleteForStudent, useCase } = createUseCase(true);

    await expect(
      useCase.execute({ studentId: 'student-1', subjectId: 'subject-1' }),
    ).resolves.toBeUndefined();

    expect(deleteForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('throws 404 for unknown or cross-student subjects', async () => {
    const { useCase } = createUseCase(false);

    await expect(
      useCase.execute({ studentId: 'student-1', subjectId: 'subject-2' }),
    ).rejects.toThrow(NotFoundException);
  });
});
