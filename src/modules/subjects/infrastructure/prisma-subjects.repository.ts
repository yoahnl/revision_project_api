import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { SubjectsRepository } from '../application/subjects.repository';
import { Subject } from '../domain/subject.entity';

type SubjectRecord = {
  id: string;
  studentId: string;
  name: string;
  priority: number;
  createdAt: Date;
};

@Injectable()
export class PrismaSubjectsRepository implements SubjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    studentId: string;
    name: string;
    priority: 1 | 2 | 3 | 4 | 5;
  }): Promise<Subject> {
    const subject = new Subject({
      id: 'validation-subject',
      studentId: input.studentId,
      name: input.name,
      priority: input.priority,
      createdAt: new Date(0),
    });

    const record = await this.prisma.subject.create({
      data: {
        studentId: subject.studentId,
        name: subject.name,
        priority: subject.priority,
      },
    });

    return this.toSubject(record);
  }

  async findByStudent(studentId: string): Promise<Subject[]> {
    const records = await this.prisma.subject.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toSubject(record));
  }

  async findByIdForStudent(input: {
    subjectId: string;
    studentId: string;
  }): Promise<Subject | null> {
    const record = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
    });

    if (!record) {
      return null;
    }

    return this.toSubject(record);
  }

  async deleteForStudent(input: {
    subjectId: string;
    studentId: string;
  }): Promise<boolean> {
    const result = await this.prisma.subject.deleteMany({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
    });

    return result.count === 1;
  }

  private toSubject(record: SubjectRecord): Subject {
    return new Subject({
      id: record.id,
      studentId: record.studentId,
      name: record.name,
      priority: record.priority as 1 | 2 | 3 | 4 | 5,
      createdAt: record.createdAt,
    });
  }
}
