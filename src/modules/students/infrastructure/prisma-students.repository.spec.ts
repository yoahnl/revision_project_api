import { PrismaStudentsRepository } from './prisma-students.repository';

type StudentProfileRecord = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

describe('PrismaStudentsRepository', () => {
  const createRepository = () => {
    const prisma = {
      studentProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    return {
      prisma,
      repository: new PrismaStudentsRepository(prisma as never),
    };
  };

  const record = (
    input: Partial<StudentProfileRecord> = {},
  ): StudentProfileRecord => ({
    id: 'student-1',
    firebaseUid: 'firebase-123',
    email: 'student@example.com',
    displayName: 'Karim',
    ...input,
  });

  it('finds a student profile by Firebase UID', async () => {
    const { prisma, repository } = createRepository();
    prisma.studentProfile.findUnique.mockResolvedValue(record());

    const profile = await repository.findByFirebaseUid('firebase-123');

    expect(prisma.studentProfile.findUnique).toHaveBeenCalledWith({
      where: { firebaseUid: 'firebase-123' },
    });
    expect(profile).toEqual({
      id: 'student-1',
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });
  });

  it('upserts a student profile by Firebase UID when creating from Firebase user', async () => {
    const { prisma, repository } = createRepository();
    prisma.studentProfile.upsert.mockResolvedValue(record());

    const profile = await repository.createFromFirebaseUser({
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });

    expect(prisma.studentProfile.upsert).toHaveBeenCalledWith({
      where: { firebaseUid: 'firebase-123' },
      create: {
        firebaseUid: 'firebase-123',
        email: 'student@example.com',
        displayName: 'Karim',
      },
      update: {},
    });
    expect(profile).toEqual({
      id: 'student-1',
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });
  });
});
