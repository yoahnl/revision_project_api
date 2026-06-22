import { Injectable } from '@nestjs/common';
import { DocumentKind } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  CourseBackfillDryRunResult,
  CourseDetailDto,
  CourseDocumentStatus,
  CourseDto,
  CourseProgressDto,
  CourseProgressState,
  CourseQuickRevisionKnowledgeUnitDto,
  CourseOwnershipContext,
  CourseDocumentDto,
  CourseWithSourceStatsDto,
  CoursesRepository,
  CreateCourseRepositoryInput,
  SubjectProgressDto,
} from '../application/courses.repository';
import type { CourseDocumentAttachment } from '../domain/course.entity';
import {
  buildCourseLifecycleDecision,
  CourseArchiveBlockedError,
  CourseDeleteBlockedError,
  type CourseLifecycleDecision,
} from '../domain/course-lifecycle.entity';

type CourseRecord = CourseDto;

type CourseDetailRecord = CourseRecord & {
  subject: {
    id: string;
    name: string;
  };
  documents: Array<{
    id: string;
    courseId: string | null;
    fileName: string;
    kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
    status: CourseDocumentStatus;
    errorCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

type DocumentAttachmentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  fileName: string;
};

type QuickRevisionKnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  displayOrder: number | null;
  createdAt: Date;
  mastery: Array<{
    score: number;
    lastPracticedAt: Date | null;
  }>;
};

type ProgressCourseRecord = CourseRecord & {
  title: string;
};

type ProgressDocumentRecord = {
  id: string;
  courseId: string | null;
  status: CourseDocumentStatus;
};

type ProgressKnowledgeUnitRecord = {
  id: string;
  documentId: string | null;
  mastery: Array<{
    score: number;
    lastPracticedAt: Date | null;
  }>;
};

@Injectable()
export class PrismaCoursesRepository implements CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCourseRepositoryInput): Promise<CourseDto> {
    return this.prisma.$transaction(async (tx) => {
      await ensureSubjectForStudent(tx, {
        studentId: input.studentId,
        subjectId: input.subjectId,
      });

      const maxOrder = await tx.course.aggregate({
        where: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          archivedAt: null,
        },
        _max: { displayOrder: true },
      });
      const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      const course = await tx.course.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          title: input.title,
          description: input.description ?? null,
          chapterLabel: input.chapterLabel ?? null,
          estimatedMinutes: input.estimatedMinutes ?? null,
          displayOrder,
        },
      });

      return toCourseDto(course);
    });
  }

  async findByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
        archivedAt: null,
      },
    });

    return course ? toCourseDto(course) : null;
  }

  async listBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseDto[]> {
    await ensureSubjectForStudent(this.prisma, input);

    const courses = await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        archivedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return courses.map(toCourseDto);
  }

  async listBySubjectForStudentWithStats(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]> {
    await ensureSubjectForStudent(this.prisma, input);

    const courses = (await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        archivedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })) as CourseRecord[];

    if (courses.length === 0) {
      return [];
    }

    const documents = await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        courseId: { in: courses.map((course) => course.id) },
        archivedAt: null,
      },
      select: {
        courseId: true,
        status: true,
      },
    });

    const statsByCourseId = new Map<string, CourseDocumentStats>();

    for (const course of courses) {
      statsByCourseId.set(course.id, emptySourceStats());
    }

    for (const document of documents) {
      if (!document.courseId) {
        continue;
      }

      const stats = statsByCourseId.get(document.courseId);
      if (!stats) {
        continue;
      }

      applyDocumentStatus(stats, document.status);
    }

    return courses.map((course) =>
      toCourseWithStatsDto(course, statsByCourseId.get(course.id)),
    );
  }

  async findDetailByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
        archivedAt: null,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: {
          where: {
            studentId: input.studentId,
            archivedAt: null,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            courseId: true,
            fileName: true,
            kind: true,
            status: true,
            errorCode: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    const stats = emptySourceStats();
    const sources = course.documents.map((document) => {
      applyDocumentStatus(stats, document.status);
      return toCourseDocumentDto(document);
    });

    return {
      course: toCourseWithStatsDto(course, stats),
      subject: {
        id: course.subject.id,
        name: course.subject.name,
      },
      sources,
    };
  }

  async findCourseProgressByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseProgressDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
        archivedAt: null,
      },
    });

    if (!course) {
      return null;
    }

    const documents = (await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        kind: DocumentKind.COURSE_PDF,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    })) as ProgressDocumentRecord[];

    const readyDocumentIds = documents
      .filter((document) => document.status === 'READY')
      .map((document) => document.id);

    const knowledgeUnits =
      readyDocumentIds.length === 0
        ? []
        : ((await this.prisma.knowledgeUnit.findMany({
            where: {
              subjectId: course.subjectId,
              documentId: { in: readyDocumentIds },
              subject: { studentId: input.studentId },
              // Progress is intentionally course-level: legacy documents
              // without courseId and non-READY/non-COURSE_PDF docs cannot
              // contribute to the available KnowledgeUnit count.
              document: {
                studentId: input.studentId,
                subjectId: course.subjectId,
                courseId: course.id,
                kind: DocumentKind.COURSE_PDF,
                status: 'READY',
                archivedAt: null,
              },
            },
            select: {
              id: true,
              documentId: true,
              mastery: {
                where: { studentId: input.studentId },
                select: { score: true, lastPracticedAt: true },
                take: 1,
              },
            },
          })) as ProgressKnowledgeUnitRecord[]);

    return buildCourseProgressDto(course, documents, knowledgeUnits);
  }

  async findSubjectProgressForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<SubjectProgressDto | null> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!subject) {
      return null;
    }

    const courses = (await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        archivedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })) as ProgressCourseRecord[];

    if (courses.length === 0) {
      return emptySubjectProgress(input.subjectId);
    }

    const courseIds = courses.map((course) => course.id);
    const documents = (await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: { in: courseIds },
        kind: DocumentKind.COURSE_PDF,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    })) as ProgressDocumentRecord[];
    const readyDocumentIds = documents
      .filter((document) => document.status === 'READY')
      .map((document) => document.id);
    const documentCourseIdByDocumentId = new Map(
      documents
        .filter((document) => document.courseId)
        .map((document) => [document.id, document.courseId as string]),
    );

    const knowledgeUnits =
      readyDocumentIds.length === 0
        ? []
        : ((await this.prisma.knowledgeUnit.findMany({
            where: {
              subjectId: input.subjectId,
              documentId: { in: readyDocumentIds },
              subject: { studentId: input.studentId },
              document: {
                studentId: input.studentId,
                subjectId: input.subjectId,
                courseId: { in: courseIds },
                kind: DocumentKind.COURSE_PDF,
                status: 'READY',
                archivedAt: null,
              },
            },
            select: {
              id: true,
              documentId: true,
              mastery: {
                where: { studentId: input.studentId },
                select: { score: true, lastPracticedAt: true },
                take: 1,
              },
            },
          })) as ProgressKnowledgeUnitRecord[]);

    const documentsByCourseId = groupByCourseId(documents);
    const knowledgeUnitsByCourseId = groupKnowledgeUnitsByCourseId(
      knowledgeUnits,
      documentCourseIdByDocumentId,
    );
    const courseProgresses = courses.map((course) =>
      buildCourseProgressDto(
        course,
        documentsByCourseId.get(course.id) ?? [],
        knowledgeUnitsByCourseId.get(course.id) ?? [],
      ),
    );

    return buildSubjectProgressDto(input.subjectId, courses, courseProgresses);
  }

  async deleteIfEmpty(input: {
    studentId: string;
    courseId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const decision = await getCourseLifecycleDecision(tx, input);

      if (!decision) {
        return false;
      }

      if (!decision.canDelete) {
        throw new CourseDeleteBlockedError(decision);
      }

      await tx.course.delete({
        where: { id: input.courseId },
      });

      return true;
    });
  }

  async getLifecycleDecisionForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseLifecycleDecision | null> {
    return getCourseLifecycleDecision(this.prisma, input);
  }

  async updateForStudent(input: {
    studentId: string;
    courseId: string;
    title?: string;
    description?: string | null;
    chapterLabel?: string | null;
    estimatedMinutes?: number | null;
  }): Promise<CourseDto | null> {
    const existing = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const updated = await this.prisma.course.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.chapterLabel !== undefined
          ? { chapterLabel: input.chapterLabel }
          : {}),
        ...(input.estimatedMinutes !== undefined
          ? { estimatedMinutes: input.estimatedMinutes }
          : {}),
      },
    });

    return toCourseDto(updated);
  }

  async archiveForStudent(input: {
    studentId: string;
    courseId: string;
    reason: string;
  }): Promise<CourseLifecycleDecision | null> {
    return this.prisma.$transaction(async (tx) => {
      const decision = await getCourseLifecycleDecision(tx, input);

      if (!decision) {
        return null;
      }

      if (!decision.canArchive) {
        throw new CourseArchiveBlockedError(decision);
      }

      const archivedAt = new Date();
      await tx.course.update({
        where: { id: input.courseId },
        data: {
          archivedAt,
          archivedReason: input.reason,
        },
      });

      return buildCourseLifecycleDecision({
        courseId: input.courseId,
        archivedAt,
        dependencyCounts: {
          documents: 0,
          processingDocuments: 0,
          revisionSessions: 0,
          questionBankItems: 0,
        },
      });
    });
  }

  async findCourseOwnershipContext(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseOwnershipContext | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
        archivedAt: null,
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
      },
    });

    return course
      ? {
          courseId: course.id,
          studentId: course.studentId,
          subjectId: course.subjectId,
        }
      : null;
  }

  async findFirstReadyCoursePdfDocumentForCourse(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDocumentDto | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        kind: DocumentKind.COURSE_PDF,
        status: 'READY',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        fileName: true,
        kind: true,
        status: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return document ? toCourseDocumentDto(document) : null;
  }

  async findFirstQuickRevisionKnowledgeUnitForCourseDocument(input: {
    studentId: string;
    courseId: string;
    subjectId: string;
    documentId: string;
  }): Promise<CourseQuickRevisionKnowledgeUnitDto | null> {
    const knowledgeUnits = (await this.prisma.knowledgeUnit.findMany({
      where: {
        subjectId: input.subjectId,
        documentId: input.documentId,
        subject: { studentId: input.studentId },
        document: {
          id: input.documentId,
          studentId: input.studentId,
          subjectId: input.subjectId,
          courseId: input.courseId,
          kind: DocumentKind.COURSE_PDF,
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        subjectId: true,
        documentId: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        mastery: {
          where: { studentId: input.studentId },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    })) as QuickRevisionKnowledgeUnitRecord[];

    const [selected] = knowledgeUnits.sort(compareQuickRevisionKnowledgeUnits);

    return selected ? toCourseQuickRevisionKnowledgeUnitDto(selected) : null;
  }

  async attachDocumentToCourse(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<CourseDocumentAttachment> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: {
          id: input.courseId,
          studentId: input.studentId,
          archivedAt: null,
        },
      });

      if (!course) {
        throw new Error('Course not found');
      }

      const document = await tx.document.findFirst({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          courseId: true,
          fileName: true,
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // The database relation is intentionally simple (`courseId -> Course.id`).
      // Course/document subject coherence is therefore enforced here before any
      // attachment write can happen.
      if (document.subjectId !== course.subjectId) {
        throw new Error('Document subject does not match course');
      }

      const updated = (await tx.document.update({
        where: { id: document.id },
        data: { courseId: course.id },
      })) as DocumentAttachmentRecord;

      return toDocumentAttachment(updated);
    });
  }

  async backfillFromExistingDocumentsDryRun(): Promise<CourseBackfillDryRunResult> {
    const documents = (await this.prisma.document.findMany({
      where: {
        kind: DocumentKind.COURSE_PDF,
        courseId: null,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        fileName: true,
      },
    })) as Array<{
      id: string;
      studentId: string;
      subjectId: string;
      fileName: string;
    }>;

    const items = documents.map((document) => ({
      documentId: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
      proposedTitle: titleFromFileName(document.fileName),
    }));

    return {
      documentsWithoutCourseCount: items.length,
      coursesToCreateCount: items.length,
      documentsToAttachCount: items.length,
      items,
    };
  }

  backfillFromExistingDocuments(): Promise<CourseBackfillDryRunResult> {
    return Promise.reject(
      new Error('Backfill apply is disabled in CORE-01; use dry-run only'),
    );
  }
}

type CourseLifecycleClient = {
  course: {
    findFirst(input: {
      where: { id: string; studentId: string };
      select: { id: true; archivedAt: true };
    }): Promise<{ id: string; archivedAt: Date | null } | null>;
  };
  document: {
    count(input: {
      where: {
        courseId: string;
        studentId: string;
        status?: { in: Array<'UPLOADED' | 'PROCESSING'> };
      };
    }): Promise<number>;
  };
  revisionSession: {
    count(input: {
      where: { courseId: string; studentId: string };
    }): Promise<number>;
  };
  questionBankItem: {
    count(input: {
      where: { courseId: string; studentId: string };
    }): Promise<number>;
  };
};

async function getCourseLifecycleDecision(
  client: CourseLifecycleClient,
  input: { studentId: string; courseId: string },
): Promise<CourseLifecycleDecision | null> {
  const course = await client.course.findFirst({
    where: {
      id: input.courseId,
      studentId: input.studentId,
    },
    select: {
      id: true,
      archivedAt: true,
    },
  });

  if (!course) {
    return null;
  }

  const [documents, processingDocuments, revisionSessions, questionBankItems] =
    await Promise.all([
      client.document.count({
        where: {
          courseId: course.id,
          studentId: input.studentId,
        },
      }),
      client.document.count({
        where: {
          courseId: course.id,
          studentId: input.studentId,
          status: { in: ['UPLOADED', 'PROCESSING'] },
        },
      }),
      client.revisionSession.count({
        where: {
          courseId: course.id,
          studentId: input.studentId,
        },
      }),
      client.questionBankItem.count({
        where: {
          courseId: course.id,
          studentId: input.studentId,
        },
      }),
    ]);

  return buildCourseLifecycleDecision({
    courseId: course.id,
    archivedAt: course.archivedAt,
    dependencyCounts: {
      documents,
      processingDocuments,
      revisionSessions,
      questionBankItems,
    },
  });
}

type SubjectOwnershipClient = {
  subject: {
    findFirst(input: {
      where: { id: string; studentId: string; archivedAt: null };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

async function ensureSubjectForStudent(
  client: SubjectOwnershipClient,
  input: { studentId: string; subjectId: string },
) {
  const subject = await client.subject.findFirst({
    where: {
      id: input.subjectId,
      studentId: input.studentId,
      archivedAt: null,
    },
    select: { id: true },
  });

  if (!subject) {
    throw new Error('Course subject not found');
  }
}

function toCourseDto(course: CourseRecord): CourseDto {
  return {
    id: course.id,
    studentId: course.studentId,
    subjectId: course.subjectId,
    title: course.title,
    description: course.description,
    chapterLabel: course.chapterLabel,
    estimatedMinutes: course.estimatedMinutes,
    displayOrder: course.displayOrder,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

type CourseDocumentStats = {
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
};

function emptySourceStats(): CourseDocumentStats {
  return {
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
  };
}

function applyDocumentStatus(
  stats: CourseDocumentStats,
  status: CourseDocumentStatus,
) {
  stats.sourceCount += 1;

  if (status === 'READY') {
    stats.readySourceCount += 1;
  } else if (status === 'PROCESSING') {
    stats.processingSourceCount += 1;
  } else if (status === 'FAILED') {
    stats.failedSourceCount += 1;
  }
}

function groupByCourseId(documents: ProgressDocumentRecord[]) {
  const byCourseId = new Map<string, ProgressDocumentRecord[]>();

  for (const document of documents) {
    if (!document.courseId) {
      continue;
    }

    const documentsForCourse = byCourseId.get(document.courseId) ?? [];
    documentsForCourse.push(document);
    byCourseId.set(document.courseId, documentsForCourse);
  }

  return byCourseId;
}

function groupKnowledgeUnitsByCourseId(
  knowledgeUnits: ProgressKnowledgeUnitRecord[],
  documentCourseIdByDocumentId: Map<string, string>,
) {
  const byCourseId = new Map<string, ProgressKnowledgeUnitRecord[]>();

  for (const unit of knowledgeUnits) {
    if (!unit.documentId) {
      continue;
    }

    const courseId = documentCourseIdByDocumentId.get(unit.documentId);
    if (!courseId) {
      continue;
    }

    const unitsForCourse = byCourseId.get(courseId) ?? [];
    unitsForCourse.push(unit);
    byCourseId.set(courseId, unitsForCourse);
  }

  return byCourseId;
}

function buildCourseProgressDto(
  course: ProgressCourseRecord,
  documents: ProgressDocumentRecord[],
  knowledgeUnits: ProgressKnowledgeUnitRecord[],
): CourseProgressDto {
  const sourceStats = progressSourceStats(documents);
  const practicedMastery = knowledgeUnits
    .map((unit) => unit.mastery[0])
    .filter((mastery): mastery is NonNullable<typeof mastery> =>
      Boolean(mastery),
    );
  const knowledgeUnitCount = knowledgeUnits.length;
  const practicedKnowledgeUnitCount = practicedMastery.length;
  const coverage =
    knowledgeUnitCount === 0
      ? 0
      : safeRatio(practicedKnowledgeUnitCount, knowledgeUnitCount);
  const mastery =
    practicedMastery.length === 0
      ? null
      : roundRatio(
          practicedMastery.reduce((sum, item) => sum + item.score, 0) /
            practicedMastery.length,
        );
  const estimatedGlobalMastery =
    mastery == null ? 0 : roundRatio(coverage * mastery);

  return {
    courseId: course.id,
    subjectId: course.subjectId,
    knowledgeUnitCount,
    practicedKnowledgeUnitCount,
    coverage,
    mastery,
    estimatedGlobalMastery,
    readySourceCount: sourceStats.readySourceCount,
    processingSourceCount: sourceStats.processingSourceCount,
    failedSourceCount: sourceStats.failedSourceCount,
    lastPracticedAt: latestPracticedAt(practicedMastery),
    state: progressState(sourceStats, knowledgeUnitCount, practicedMastery),
  };
}

function buildSubjectProgressDto(
  subjectId: string,
  courses: ProgressCourseRecord[],
  courseProgresses: CourseProgressDto[],
): SubjectProgressDto {
  const knowledgeUnitCount = courseProgresses.reduce(
    (sum, progress) => sum + progress.knowledgeUnitCount,
    0,
  );
  const practicedKnowledgeUnitCount = courseProgresses.reduce(
    (sum, progress) => sum + progress.practicedKnowledgeUnitCount,
    0,
  );
  const practicedMasteryValues = courseProgresses.flatMap(
    (progress): number[] => {
      if (
        progress.mastery == null ||
        progress.practicedKnowledgeUnitCount === 0
      ) {
        return [];
      }

      return Array<number>(progress.practicedKnowledgeUnitCount).fill(
        progress.mastery,
      );
    },
  );
  const coverage =
    knowledgeUnitCount === 0
      ? 0
      : safeRatio(practicedKnowledgeUnitCount, knowledgeUnitCount);
  const mastery =
    practicedMasteryValues.length === 0
      ? null
      : roundRatio(
          practicedMasteryValues.reduce((sum, score) => sum + score, 0) /
            practicedMasteryValues.length,
        );
  const estimatedGlobalMastery =
    mastery == null ? 0 : roundRatio(coverage * mastery);
  const latest = latestDate(
    courseProgresses.map((item) => item.lastPracticedAt),
  );
  const titleByCourseId = new Map(
    courses.map((course) => [course.id, course.title]),
  );

  return {
    subjectId,
    knowledgeUnitCount,
    practicedKnowledgeUnitCount,
    coverage,
    mastery,
    estimatedGlobalMastery,
    courseCount: courses.length,
    readyCourseCount: courseProgresses.filter(
      (progress) => progress.readySourceCount > 0,
    ).length,
    lastPracticedAt: latest,
    courses: courseProgresses.map((progress) => ({
      courseId: progress.courseId,
      title: titleByCourseId.get(progress.courseId) ?? 'Cours',
      knowledgeUnitCount: progress.knowledgeUnitCount,
      practicedKnowledgeUnitCount: progress.practicedKnowledgeUnitCount,
      coverage: progress.coverage,
      mastery: progress.mastery,
      estimatedGlobalMastery: progress.estimatedGlobalMastery,
      state: progress.state,
    })),
  };
}

function emptySubjectProgress(subjectId: string): SubjectProgressDto {
  return {
    subjectId,
    knowledgeUnitCount: 0,
    practicedKnowledgeUnitCount: 0,
    coverage: 0,
    mastery: null,
    estimatedGlobalMastery: 0,
    courseCount: 0,
    readyCourseCount: 0,
    lastPracticedAt: null,
    courses: [],
  };
}

function progressSourceStats(documents: ProgressDocumentRecord[]) {
  let readySourceCount = 0;
  let processingSourceCount = 0;
  let failedSourceCount = 0;

  for (const document of documents) {
    if (document.status === 'READY') {
      readySourceCount += 1;
    } else if (
      document.status === 'UPLOADED' ||
      document.status === 'PROCESSING'
    ) {
      processingSourceCount += 1;
    } else if (document.status === 'FAILED') {
      failedSourceCount += 1;
    }
  }

  return {
    sourceCount: documents.length,
    readySourceCount,
    processingSourceCount,
    failedSourceCount,
  };
}

function progressState(
  sourceStats: ReturnType<typeof progressSourceStats>,
  knowledgeUnitCount: number,
  practicedMastery: Array<{ score: number; lastPracticedAt: Date | null }>,
): CourseProgressState {
  if (sourceStats.sourceCount === 0) {
    return 'NO_SOURCE';
  }

  if (
    sourceStats.readySourceCount === 0 &&
    sourceStats.processingSourceCount > 0
  ) {
    return 'PROCESSING';
  }

  if (sourceStats.readySourceCount === 0 && sourceStats.failedSourceCount > 0) {
    return 'FAILED_ONLY';
  }

  if (knowledgeUnitCount === 0) {
    return 'NO_KNOWLEDGE_UNITS';
  }

  if (practicedMastery.length === 0) {
    return 'READY_NOT_PRACTICED';
  }

  return 'PRACTICED';
}

function safeRatio(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return roundRatio(numerator / denominator);
}

function roundRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(3));
}

function latestPracticedAt(
  mastery: Array<{ score: number; lastPracticedAt: Date | null }>,
) {
  return latestDate(mastery.map((item) => item.lastPracticedAt));
}

function latestDate(dates: Array<Date | null>) {
  const timestamps = dates
    .filter((date): date is Date => date instanceof Date)
    .map((date) => date.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

function toCourseWithStatsDto(
  course: CourseRecord,
  stats: CourseDocumentStats = emptySourceStats(),
): CourseWithSourceStatsDto {
  return {
    ...toCourseDto(course),
    sourceCount: stats.sourceCount,
    readySourceCount: stats.readySourceCount,
    processingSourceCount: stats.processingSourceCount,
    failedSourceCount: stats.failedSourceCount,
  };
}

function toCourseDocumentDto(
  document: CourseDetailRecord['documents'][number],
): CourseDocumentDto {
  if (!document.courseId) {
    throw new Error('Attached course document is missing courseId');
  }

  return {
    id: document.id,
    courseId: document.courseId,
    documentId: document.id,
    fileName: document.fileName,
    kind: document.kind,
    status: document.status,
    errorCode: document.errorCode,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toDocumentAttachment(
  document: DocumentAttachmentRecord,
): CourseDocumentAttachment {
  return {
    id: document.id,
    studentId: document.studentId,
    subjectId: document.subjectId,
    courseId: document.courseId,
    fileName: document.fileName,
  };
}

function compareQuickRevisionKnowledgeUnits(
  left: QuickRevisionKnowledgeUnitRecord,
  right: QuickRevisionKnowledgeUnitRecord,
) {
  const leftMastery = left.mastery[0];
  const rightMastery = right.mastery[0];
  const scoreDelta = (leftMastery?.score ?? 0) - (rightMastery?.score ?? 0);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const leftPracticedAt = leftMastery?.lastPracticedAt?.getTime() ?? 0;
  const rightPracticedAt = rightMastery?.lastPracticedAt?.getTime() ?? 0;
  const practiceDelta = leftPracticedAt - rightPracticedAt;

  if (practiceDelta !== 0) {
    return practiceDelta;
  }

  const orderDelta =
    (left.displayOrder ?? Number.MAX_SAFE_INTEGER) -
    (right.displayOrder ?? Number.MAX_SAFE_INTEGER);

  if (orderDelta !== 0) {
    return orderDelta;
  }

  const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.id.localeCompare(right.id);
}

function toCourseQuickRevisionKnowledgeUnitDto(
  unit: QuickRevisionKnowledgeUnitRecord,
): CourseQuickRevisionKnowledgeUnitDto {
  if (!unit.documentId) {
    throw new Error(
      'Course quick revision knowledge unit is missing documentId',
    );
  }

  return {
    id: unit.id,
    subjectId: unit.subjectId,
    documentId: unit.documentId,
    title: unit.title,
  };
}

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'Cours sans titre';
}
