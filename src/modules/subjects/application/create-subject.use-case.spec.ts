import { CreateSubjectUseCase } from './create-subject.use-case';
import type { SubjectsRepository } from './subjects.repository';

describe('CreateSubjectUseCase', () => {
  it('creates a subject for the current student', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'subject-1',
      studentId: 'student-1',
      name: 'Physiologie',
      priority: 4,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    });

    const repository: SubjectsRepository = {
      create,
      findByStudent: jest.fn(),
      findByIdForStudent: jest.fn(),
    };

    const subject = await new CreateSubjectUseCase(repository).execute({
      studentId: 'student-1',
      name: ' Physiologie ',
      priority: 4,
    });

    expect(subject.name).toBe('Physiologie');
    expect(create).toHaveBeenCalledWith({
      studentId: 'student-1',
      name: 'Physiologie',
      priority: 4,
    });
  });
});
