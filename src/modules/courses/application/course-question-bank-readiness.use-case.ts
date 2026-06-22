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
    knowledgeUnit: CourseQuickRevisionKnowledgeUnitDto | null;
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
        knowledgeUnit: null,
      };
    }

    const knowledgeUnit =
      await this.coursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument(
        {
          studentId: input.studentId,
          courseId: course.courseId,
          subjectId: course.subjectId,
          documentId: document.documentId,
        },
      );

    if (!knowledgeUnit) {
      return {
        readiness: buildCourseQuestionBankReadiness({
          courseId: input.courseId,
          status: 'NO_KNOWLEDGE_UNITS',
          readyQuestionCount: 0,
          targetQuestionCount: input.targetQuestionCount,
        }),
        subjectId: course.subjectId,
        document,
        knowledgeUnit: null,
      };
    }

    const readyQuestionCount =
      await this.questionBank.countActiveCourseQuickQuestions({
        studentId: input.studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        knowledgeUnitId: knowledgeUnit.id,
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
        knowledgeUnit,
      };
    }

    const job = await this.preparationRepository.findLatestForCourseContext({
      studentId: input.studentId,
      courseId: course.courseId,
      documentId: document.documentId,
      knowledgeUnitId: knowledgeUnit.id,
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
      knowledgeUnit,
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

    if (!context.subjectId || !context.document || !context.knowledgeUnit) {
      return context.readiness;
    }

    const job = await this.preparationRepository.ensurePendingForCourseContext({
      studentId: input.studentId,
      subjectId: context.subjectId,
      courseId: input.courseId,
      documentId: context.document.documentId,
      knowledgeUnitId: context.knowledgeUnit.id,
      targetQuestionCount,
    });

    await this.preparationQueue.enqueue({ preparationJobId: job.id });

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
