import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  QuestionBankService,
  resolveQuickQuestionBankQuestionCount,
} from '../../activities/application/question-bank.service';
import {
  COURSE_QUESTION_BANK_PREPARATION_QUEUE,
  type CourseQuestionBankPreparationQueue,
} from '../../jobs/application/course-question-bank-preparation.queue';
import {
  buildCourseQuestionBankReadiness,
  type CourseQuestionBankReadiness,
} from '../domain/course-question-bank-readiness.entity';
import {
  COURSE_QUESTION_BANK_PREPARATION_REPOSITORY,
  type CourseQuestionBankPreparationJobDto,
  type CourseQuestionBankPreparationRepository,
  resolveCourseQuestionBankPreparationStaleAfterMs,
} from './course-question-bank-preparation.repository';
import {
  COURSES_REPOSITORY,
  type CourseDocumentDto,
  type CourseQuickRevisionKnowledgeUnitDto,
  type CoursesRepository,
} from './courses.repository';

const QUICK_QUESTION_BANK_PREPARATION_MIN_PER_KU = 5;

@Injectable()
export class GetCourseQuestionBankReadinessUseCase {
  private readonly logger = new Logger(
    GetCourseQuestionBankReadinessUseCase.name,
  );

  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(COURSE_QUESTION_BANK_PREPARATION_REPOSITORY)
    private readonly preparationRepository: CourseQuestionBankPreparationRepository,
    private readonly questionBank: QuestionBankService,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    questionCount?: number;
  }): Promise<CourseQuestionBankReadiness> {
    const targetQuestionCount = resolveQuickQuestionBankQuestionCount(
      input.questionCount,
    );
    const context = await this.resolveContext({
      ...input,
      targetQuestionCount,
    });

    return context.readiness;
  }

  async resolveContext(input: {
    studentId: string;
    courseId: string;
    targetQuestionCount: number;
  }): Promise<{
    readiness: CourseQuestionBankReadiness;
    subjectId: string | null;
    document: CourseDocumentDto | null;
    knowledgeUnits: CourseQuickRevisionKnowledgeUnitDto[];
  }> {
    const course =
      await this.coursesRepository.findCourseOwnershipContext(input);

    if (!course) {
      throw new Error('Course not found');
    }

    const document =
      await this.coursesRepository.findFirstReadyCoursePdfDocumentForCourse(
        input,
      );

    if (!document) {
      this.logReadiness({
        studentId: input.studentId,
        courseId: input.courseId,
        targetQuestionCount: input.targetQuestionCount,
        readyQuestionCount: 0,
        activeJobCount: 0,
        failedJobCount: 0,
        staleJobCount: 0,
        status: 'NO_READY_SOURCE',
      });
      return {
        readiness: buildCourseQuestionBankReadiness({
          courseId: input.courseId,
          status: 'NO_READY_SOURCE',
          readyQuestionCount: 0,
          targetQuestionCount: input.targetQuestionCount,
        }),
        subjectId: course.subjectId,
        document: null,
        knowledgeUnits: [],
      };
    }

    const knowledgeUnits =
      await this.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
        {
          studentId: input.studentId,
          courseId: course.courseId,
          subjectId: course.subjectId,
        },
      );

    if (knowledgeUnits.length === 0) {
      this.logReadiness({
        studentId: input.studentId,
        courseId: input.courseId,
        targetQuestionCount: input.targetQuestionCount,
        readyQuestionCount: 0,
        activeJobCount: 0,
        failedJobCount: 0,
        staleJobCount: 0,
        status: 'NO_KNOWLEDGE_UNITS',
      });
      return {
        readiness: buildCourseQuestionBankReadiness({
          courseId: input.courseId,
          status: 'NO_KNOWLEDGE_UNITS',
          readyQuestionCount: 0,
          targetQuestionCount: input.targetQuestionCount,
        }),
        subjectId: course.subjectId,
        document,
        knowledgeUnits: [],
      };
    }

    const readyQuestionCount =
      await this.questionBank.countActiveCourseQuickQuestions({
        studentId: input.studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        knowledgeUnitIds: knowledgeUnits.map((unit) => unit.id),
      });

    if (readyQuestionCount >= input.targetQuestionCount) {
      this.logReadiness({
        studentId: input.studentId,
        courseId: course.courseId,
        targetQuestionCount: input.targetQuestionCount,
        readyQuestionCount,
        activeJobCount: 0,
        failedJobCount: 0,
        staleJobCount: 0,
        status: 'READY',
      });
      return {
        readiness: buildCourseQuestionBankReadiness({
          courseId: input.courseId,
          status: 'READY',
          readyQuestionCount,
          targetQuestionCount: input.targetQuestionCount,
        }),
        subjectId: course.subjectId,
        document,
        knowledgeUnits,
      };
    }

    const jobs = await this.preparationRepository.findRecentForCourse({
      studentId: input.studentId,
      courseId: course.courseId,
    });
    const staleAfterMs = resolveCourseQuestionBankPreparationStaleAfterMs();
    const jobSummary = summarizePreparationJobs({
      jobs,
      now: new Date(),
      staleAfterMs,
      targetQuestionCount: input.targetQuestionCount,
      knowledgeUnitCount: knowledgeUnits.length,
    });

    this.logReadiness({
      studentId: input.studentId,
      courseId: course.courseId,
      targetQuestionCount: input.targetQuestionCount,
      readyQuestionCount,
      activeJobCount: jobSummary.activeJobCount,
      failedJobCount: jobSummary.failedJobCount,
      staleJobCount: jobSummary.staleJobCount,
      status: jobSummary.status,
    });

    return {
      readiness: buildCourseQuestionBankReadiness({
        courseId: input.courseId,
        status: jobSummary.status,
        readyQuestionCount,
        targetQuestionCount: input.targetQuestionCount,
      }),
      subjectId: course.subjectId,
      document,
      knowledgeUnits,
    };
  }

  private logReadiness(input: {
    studentId: string;
    courseId: string;
    targetQuestionCount: number;
    readyQuestionCount: number;
    activeJobCount: number;
    failedJobCount: number;
    staleJobCount: number;
    status: string;
  }) {
    this.logger.log({
      event: 'course_question_bank_readiness_resolved',
      courseId: input.courseId,
      studentRef: safeStudentRef(input.studentId),
      targetQuestionCount: input.targetQuestionCount,
      readyQuestionCount: input.readyQuestionCount,
      activeJobCount: input.activeJobCount,
      failedJobCount: input.failedJobCount,
      staleJobCount: input.staleJobCount,
      status: input.status,
    });
  }
}

@Injectable()
export class PrepareCourseQuestionBankUseCase {
  private readonly logger = new Logger(PrepareCourseQuestionBankUseCase.name);

  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(COURSE_QUESTION_BANK_PREPARATION_REPOSITORY)
    private readonly preparationRepository: CourseQuestionBankPreparationRepository,
    private readonly questionBank: QuestionBankService,
    @Inject(COURSE_QUESTION_BANK_PREPARATION_QUEUE)
    private readonly preparationQueue: CourseQuestionBankPreparationQueue,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    questionCount?: number;
  }): Promise<CourseQuestionBankReadiness> {
    const targetQuestionCount = resolveQuickQuestionBankQuestionCount(
      input.questionCount,
    );
    const readinessUseCase = new GetCourseQuestionBankReadinessUseCase(
      this.coursesRepository,
      this.preparationRepository,
      this.questionBank,
    );
    const context = await readinessUseCase.resolveContext({
      studentId: input.studentId,
      courseId: input.courseId,
      targetQuestionCount,
    });

    if (!context.readiness.canPrepare) {
      return context.readiness;
    }

    if (!context.subjectId || context.knowledgeUnits.length === 0) {
      return context.readiness;
    }

    const targetQuestionCountPerKnowledgeUnit = Math.max(
      QUICK_QUESTION_BANK_PREPARATION_MIN_PER_KU,
      Math.ceil(targetQuestionCount / context.knowledgeUnits.length),
    );
    const ensuredJobs: Array<{ id: string; created: boolean }> = [];

    for (const knowledgeUnit of context.knowledgeUnits) {
      const ensured =
        await this.preparationRepository.ensurePendingForCourseContext({
          studentId: input.studentId,
          subjectId: context.subjectId,
          courseId: input.courseId,
          documentId: knowledgeUnit.documentId,
          knowledgeUnitId: knowledgeUnit.id,
          targetQuestionCount: targetQuestionCountPerKnowledgeUnit,
        });

      ensuredJobs.push({
        id: ensured.job.id,
        created: ensured.created,
      });
      await this.preparationQueue.enqueue({
        preparationJobId: ensured.job.id,
      });
    }

    this.logger.log({
      event: 'course_question_bank_prepare_requested',
      courseId: input.courseId,
      studentRef: safeStudentRef(input.studentId),
      questionCount: targetQuestionCount,
      readyQuestionCount: context.readiness.readyQuestionCount,
      candidateKnowledgeUnitCount: context.knowledgeUnits.length,
      createdJobCount: ensuredJobs.filter((job) => job.created).length,
      reusedJobCount: ensuredJobs.filter((job) => !job.created).length,
      preparationJobIds: ensuredJobs.map((job) => job.id),
      status: 'PREPARING',
    });

    return buildCourseQuestionBankReadiness({
      courseId: input.courseId,
      status: 'PREPARING',
      readyQuestionCount: context.readiness.readyQuestionCount,
      targetQuestionCount,
    });
  }
}

function summarizePreparationJobs(input: {
  jobs: CourseQuestionBankPreparationJobDto[];
  now: Date;
  staleAfterMs: number;
  targetQuestionCount: number;
  knowledgeUnitCount: number;
}) {
  let activeJobCount = 0;
  let failedJobCount = 0;
  let staleJobCount = 0;
  const expectedJobTargetQuestionCount = Math.max(
    QUICK_QUESTION_BANK_PREPARATION_MIN_PER_KU,
    Math.ceil(
      input.targetQuestionCount / Math.max(input.knowledgeUnitCount, 1),
    ),
  );

  for (const job of input.jobs) {
    if (job.targetQuestionCount < expectedJobTargetQuestionCount) {
      continue;
    }

    if (isStalePreparationJob(job, input.now, input.staleAfterMs)) {
      staleJobCount += 1;
      continue;
    }

    if (isActivePreparationJob(job)) {
      activeJobCount += 1;
      continue;
    }

    if (job.status === 'FAILED') {
      failedJobCount += 1;
    }
  }

  return {
    activeJobCount,
    failedJobCount,
    staleJobCount,
    status:
      activeJobCount > 0
        ? 'PREPARING'
        : failedJobCount > 0
          ? 'FAILED'
          : 'NOT_PREPARED',
  } as const;
}

function isActivePreparationJob(job: CourseQuestionBankPreparationJobDto) {
  return job.status === 'PENDING' || job.status === 'RUNNING';
}

function isStalePreparationJob(
  job: CourseQuestionBankPreparationJobDto,
  now: Date,
  staleAfterMs: number,
) {
  if (job.status === 'COMPLETED') {
    return false;
  }

  const reference = job.status === 'RUNNING' ? job.lockedAt : job.updatedAt;

  if (!reference) {
    return false;
  }

  return now.getTime() - reference.getTime() >= staleAfterMs;
}

function safeStudentRef(studentId: string) {
  return createHash('sha256').update(studentId).digest('hex').slice(0, 12);
}
