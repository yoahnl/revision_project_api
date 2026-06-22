import { Inject, Injectable } from '@nestjs/common';
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

    const job = await this.preparationRepository.findLatestForCourse({
      studentId: input.studentId,
      courseId: course.courseId,
      targetQuestionCount: input.targetQuestionCount,
    });

    return {
      readiness: buildCourseQuestionBankReadiness({
        courseId: input.courseId,
        status: readinessStatusFromJob(job),
        readyQuestionCount,
        targetQuestionCount: input.targetQuestionCount,
      }),
      subjectId: course.subjectId,
      document,
      knowledgeUnits,
    };
  }
}

@Injectable()
export class PrepareCourseQuestionBankUseCase {
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

    for (const knowledgeUnit of context.knowledgeUnits) {
      const job =
        await this.preparationRepository.ensurePendingForCourseContext({
          studentId: input.studentId,
          subjectId: context.subjectId,
          courseId: input.courseId,
          documentId: knowledgeUnit.documentId,
          knowledgeUnitId: knowledgeUnit.id,
          targetQuestionCount: targetQuestionCountPerKnowledgeUnit,
        });

      await this.preparationQueue.enqueue({ preparationJobId: job.id });
    }

    return buildCourseQuestionBankReadiness({
      courseId: input.courseId,
      status: 'PREPARING',
      readyQuestionCount: context.readiness.readyQuestionCount,
      targetQuestionCount,
    });
  }
}

function readinessStatusFromJob(
  job: CourseQuestionBankPreparationJobDto | null,
) {
  if (!job) {
    return 'NOT_PREPARED';
  }

  if (job.status === 'FAILED') {
    return 'FAILED';
  }

  if (job.status === 'PENDING' || job.status === 'RUNNING') {
    return 'PREPARING';
  }

  return 'NOT_PREPARED';
}
