import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  StudentProfileDto,
  StudentsRepository,
} from '../application/students.repository';

type StudentProfileRecord = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

@Injectable()
export class PrismaStudentsRepository implements StudentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(
    firebaseUid: string,
  ): Promise<StudentProfileDto | null> {
    const record = await this.prisma.studentProfile.findUnique({
      where: { firebaseUid },
    });

    return record ? this.toDto(record) : null;
  }

  async createFromFirebaseUser(input: {
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
  }): Promise<StudentProfileDto> {
    const record = await this.prisma.studentProfile.upsert({
      where: { firebaseUid: input.firebaseUid },
      create: {
        firebaseUid: input.firebaseUid,
        email: input.email,
        displayName: input.displayName,
      },
      update: {},
    });

    return this.toDto(record);
  }

  private toDto(record: StudentProfileRecord): StudentProfileDto {
    return {
      id: record.id,
      firebaseUid: record.firebaseUid,
      email: record.email,
      displayName: record.displayName,
    };
  }
}
