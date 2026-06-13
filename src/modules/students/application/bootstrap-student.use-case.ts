import { Inject, Injectable } from '@nestjs/common';
import { STUDENTS_REPOSITORY } from './students.repository';
import type {
  StudentProfileDto,
  StudentsRepository,
} from './students.repository';

@Injectable()
export class BootstrapStudentUseCase {
  constructor(
    @Inject(STUDENTS_REPOSITORY)
    private readonly studentsRepository: StudentsRepository,
  ) {}

  async execute(input: {
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
  }): Promise<StudentProfileDto> {
    const existing = await this.studentsRepository.findByFirebaseUid(
      input.firebaseUid,
    );

    if (existing) {
      return existing;
    }

    return this.studentsRepository.createFromFirebaseUser(input);
  }
}
