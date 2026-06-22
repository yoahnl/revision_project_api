import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { SubjectsRepository } from '../application/subjects.repository';
import {
  buildSubjectLifecycleDecision,
  SubjectArchiveBlockedError,
  SubjectDeleteBlockedError,
  type SubjectLifecycleDecision,
} from '../domain/subject-lifecycle.entity';
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
      where: { studentId, archivedAt: null },
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
        archivedAt: null,
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
    return this.prisma.$transaction(async (tx) => {
      const decision = await getSubjectLifecycleDecision(tx, input);

      if (!decision) {
        return false;
      }

      if (!decision.canDelete) {
        throw new SubjectDeleteBlockedError(decision);
      }

      await tx.subject.delete({
        where: { id: input.subjectId },
      });

      return true;
    });
  }

  getLifecycleDecisionForStudent(input: {
    subjectId: string;
    studentId: string;
  }): Promise<SubjectLifecycleDecision | null> {
    return getSubjectLifecycleDecision(this.prisma, input);
  }

  async updateForStudent(input: {
    subjectId: string;
    studentId: string;
    name?: string;
    priority?: 1 | 2 | 3 | 4 | 5;
  }): Promise<Subject | null> {
    if (input.name !== undefined || input.priority !== undefined) {
      new Subject({
        id: 'validation-subject',
        studentId: input.studentId,
        name: input.name ?? 'Matiere',
        priority: input.priority ?? 3,
        createdAt: new Date(0),
      });
    }

    const existing = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const record = await this.prisma.subject.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
      },
    });

    return this.toSubject(record);
  }

  async archiveForStudent(input: {
    subjectId: string;
    studentId: string;
    reason: string;
  }): Promise<SubjectLifecycleDecision | null> {
    return this.prisma.$transaction(async (tx) => {
      const decision = await getSubjectLifecycleDecision(tx, input);

      if (!decision) {
        return null;
      }

      if (!decision.canArchive) {
        throw new SubjectArchiveBlockedError(decision);
      }

      const archivedAt = new Date();
      await tx.subject.update({
        where: { id: input.subjectId },
        data: {
          archivedAt,
          archivedReason: input.reason,
        },
      });

      return buildSubjectLifecycleDecision({
        subjectId: input.subjectId,
        archivedAt,
        dependencyCounts: {
          courses: 0,
          documents: 0,
          processingDocuments: 0,
          knowledgeUnits: 0,
          masteryStates: 0,
          activitySessions: 0,
          revisionSessions: 0,
          summaries: 0,
          revisionSheets: 0,
          openQuestions: 0,
          openAnswerEvaluations: 0,
          questionBankItems: 0,
        },
      });
    });
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

type SubjectLifecycleClient = {
  subject: {
    findFirst(
      input: object,
    ): Promise<{ id: string; archivedAt: Date | null } | null>;
  };
  course: { count(input: object): Promise<number> };
  document: { count(input: object): Promise<number> };
  knowledgeUnit: { count(input: object): Promise<number> };
  masteryState: { count(input: object): Promise<number> };
  activitySession: { count(input: object): Promise<number> };
  revisionSession: { count(input: object): Promise<number> };
  summary: { count(input: object): Promise<number> };
  revisionSheet: { count(input: object): Promise<number> };
  openQuestion: { count(input: object): Promise<number> };
  openAnswerEvaluation: { count(input: object): Promise<number> };
  questionBankItem: { count(input: object): Promise<number> };
};

async function getSubjectLifecycleDecision(
  client: SubjectLifecycleClient,
  input: { subjectId: string; studentId: string },
): Promise<SubjectLifecycleDecision | null> {
  const subject = await client.subject.findFirst({
    where: {
      id: input.subjectId,
      studentId: input.studentId,
    },
    select: {
      id: true,
      archivedAt: true,
    },
  });

  if (!subject) {
    return null;
  }

  const [
    courses,
    documents,
    processingDocuments,
    knowledgeUnits,
    masteryStates,
    activitySessions,
    revisionSessions,
    summaries,
    revisionSheets,
    openQuestions,
    openAnswerEvaluations,
    questionBankItems,
  ] = await Promise.all([
    client.course.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.document.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.document.count({
      where: {
        subjectId: subject.id,
        studentId: input.studentId,
        status: { in: ['UPLOADED', 'PROCESSING'] },
      },
    }),
    client.knowledgeUnit.count({ where: { subjectId: subject.id } }),
    client.masteryState.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.activitySession.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.revisionSession.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.summary.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.revisionSheet.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.openQuestion.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.openAnswerEvaluation.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
    client.questionBankItem.count({
      where: { subjectId: subject.id, studentId: input.studentId },
    }),
  ]);

  return buildSubjectLifecycleDecision({
    subjectId: subject.id,
    archivedAt: subject.archivedAt,
    dependencyCounts: {
      courses,
      documents,
      processingDocuments,
      knowledgeUnits,
      masteryStates,
      activitySessions,
      revisionSessions,
      summaries,
      revisionSheets,
      openQuestions,
      openAnswerEvaluations,
      questionBankItems,
    },
  });
}
