import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RevisionRepository } from '../application/revision.repository';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';

type RevisionGoalRecord = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
  createdAt: Date;
};

type KnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  summary: string;
};

type MasteryStateRecord = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
};

@Injectable()
export class PrismaRevisionRepository implements RevisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveGoal(studentId: string): Promise<RevisionGoal | null> {
    const record = await this.prisma.revisionGoal.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    return record ? this.toRevisionGoal(record) : null;
  }

  async saveGoal(input: {
    studentId: string;
    targetDate: Date;
    weeklyMinutes: number;
  }): Promise<RevisionGoal> {
    const goal = new RevisionGoal({
      id: 'validation-goal',
      studentId: input.studentId,
      targetDate: input.targetDate,
      weeklyMinutes: input.weeklyMinutes,
      createdAt: new Date(0),
    });

    const record = await this.prisma.revisionGoal.create({
      data: {
        studentId: goal.studentId,
        targetDate: goal.targetDate,
        weeklyMinutes: goal.weeklyMinutes,
      },
    });

    return this.toRevisionGoal(record);
  }

  async findKnowledgeUnits(studentId: string): Promise<KnowledgeUnit[]> {
    const records = await this.prisma.knowledgeUnit.findMany({
      where: {
        subject: {
          studentId,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toKnowledgeUnit(record));
  }

  async findMasteryStates(studentId: string): Promise<MasteryState[]> {
    const records = await this.prisma.masteryState.findMany({
      where: { studentId },
      orderBy: { updatedAt: 'asc' },
    });

    return records.map((record) => this.toMasteryState(record));
  }

  async upsertMastery(input: {
    studentId: string;
    knowledgeUnitId: string;
    score: number;
    lastPracticedAt: Date;
  }): Promise<MasteryState> {
    const mastery = new MasteryState({
      studentId: input.studentId,
      knowledgeUnitId: input.knowledgeUnitId,
      score: input.score,
      lastPracticedAt: input.lastPracticedAt,
    });

    const knowledgeUnit = await this.prisma.knowledgeUnit.findFirst({
      where: {
        id: mastery.knowledgeUnitId,
        subject: {
          studentId: mastery.studentId,
        },
      },
    });

    if (!knowledgeUnit) {
      throw new Error('Knowledge unit does not belong to student');
    }

    const record = await this.prisma.masteryState.upsert({
      where: {
        studentId_knowledgeUnitId: {
          studentId: mastery.studentId,
          knowledgeUnitId: mastery.knowledgeUnitId,
        },
      },
      create: {
        studentId: mastery.studentId,
        subjectId: knowledgeUnit.subjectId,
        knowledgeUnitId: mastery.knowledgeUnitId,
        score: mastery.score,
        lastPracticedAt: mastery.lastPracticedAt,
      },
      update: {
        subjectId: knowledgeUnit.subjectId,
        score: mastery.score,
        lastPracticedAt: mastery.lastPracticedAt,
      },
    });

    return this.toMasteryState(record);
  }

  private toRevisionGoal(record: RevisionGoalRecord): RevisionGoal {
    return new RevisionGoal({
      id: record.id,
      studentId: record.studentId,
      targetDate: record.targetDate,
      weeklyMinutes: record.weeklyMinutes,
      createdAt: record.createdAt,
    });
  }

  private toKnowledgeUnit(record: KnowledgeUnitRecord): KnowledgeUnit {
    return new KnowledgeUnit({
      id: record.id,
      subjectId: record.subjectId,
      documentId: record.documentId,
      title: record.title,
      summary: record.summary,
    });
  }

  private toMasteryState(record: MasteryStateRecord): MasteryState {
    return new MasteryState({
      studentId: record.studentId,
      knowledgeUnitId: record.knowledgeUnitId,
      score: record.score,
      lastPracticedAt: record.lastPracticedAt,
    });
  }
}
