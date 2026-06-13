import { BootstrapStudentUseCase } from './bootstrap-student.use-case';
import type { StudentsRepository } from './students.repository';

describe('BootstrapStudentUseCase', () => {
  it('creates a student profile when the Firebase UID is new', async () => {
    const createFromFirebaseUser = jest.fn().mockResolvedValue({
      id: 'student-1',
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });
    const repository: StudentsRepository = {
      findByFirebaseUid: jest.fn().mockResolvedValue(null),
      createFromFirebaseUser,
    };

    const result = await new BootstrapStudentUseCase(repository).execute({
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });

    expect(result.id).toBe('student-1');
    expect(createFromFirebaseUser).toHaveBeenCalledWith({
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });
  });

  it('returns an existing student profile without creating a new one', async () => {
    const existingProfile = {
      id: 'student-1',
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    };
    const createFromFirebaseUser = jest.fn();
    const repository: StudentsRepository = {
      findByFirebaseUid: jest.fn().mockResolvedValue(existingProfile),
      createFromFirebaseUser,
    };

    const result = await new BootstrapStudentUseCase(repository).execute({
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });

    expect(result).toBe(existingProfile);
    expect(createFromFirebaseUser).not.toHaveBeenCalled();
  });
});
