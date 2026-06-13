export interface StudentProfileDto {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
}

export const STUDENTS_REPOSITORY = Symbol('STUDENTS_REPOSITORY');

export interface StudentsRepository {
  findByFirebaseUid(firebaseUid: string): Promise<StudentProfileDto | null>;
  createFromFirebaseUser(input: {
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
  }): Promise<StudentProfileDto>;
}
