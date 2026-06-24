# PLUS-03A - Evidence pack API

Ce pack capture le diff complet des fichiers produit/test API pour PLUS-03A. Les documents V3 du lot sont exclus pour eviter un artefact auto-recursif ; ils sont listes dans le rapport.

## Diff stat produit/test

```text
 src/modules/courses/courses.module.ts              |  3 +
 .../courses/interfaces/courses.controller.spec.ts  | 67 ++++++++++++++++++++++
 .../courses/interfaces/courses.controller.ts       | 15 +++++
 3 files changed, 85 insertions(+)

Fichiers nouveaux non suivis hors docs :
src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts
src/modules/courses/application/get-course-exam-preparation-options.use-case.ts
```

## Diff complet des fichiers suivis produit/test

```diff
diff --git a/src/modules/courses/courses.module.ts b/src/modules/courses/courses.module.ts
index 0f0d74e..5c82698 100644
--- a/src/modules/courses/courses.module.ts
+++ b/src/modules/courses/courses.module.ts
@@ -31,6 +31,7 @@ import { DeleteCourseDocumentUseCase } from './application/delete-course-documen
 import { DeleteCourseUseCase } from './application/delete-course.use-case';
 import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
 import { GetCourseLifecycleUseCase } from './application/get-course-lifecycle.use-case';
+import { GetCourseExamPreparationOptionsUseCase } from './application/get-course-exam-preparation-options.use-case';
 import { GetCourseUseCase } from './application/get-course.use-case';
 import { ListSubjectCoursesWithStatsUseCase } from './application/list-subject-courses-with-stats.use-case';
 import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
@@ -59,6 +60,7 @@ import { CoursesController } from './interfaces/courses.controller';
     GetCourseUseCase,
     GetCourseDetailUseCase,
     GetCourseLifecycleUseCase,
+    GetCourseExamPreparationOptionsUseCase,
     UpdateCourseUseCase,
     ArchiveCourseUseCase,
     DeleteCourseUseCase,
@@ -90,6 +92,7 @@ import { CoursesController } from './interfaces/courses.controller';
     GetCourseUseCase,
     GetCourseDetailUseCase,
     GetCourseLifecycleUseCase,
+    GetCourseExamPreparationOptionsUseCase,
     UpdateCourseUseCase,
     ArchiveCourseUseCase,
     DeleteCourseUseCase,
diff --git a/src/modules/courses/interfaces/courses.controller.spec.ts b/src/modules/courses/interfaces/courses.controller.spec.ts
index 5209ce1..0acd993 100644
--- a/src/modules/courses/interfaces/courses.controller.spec.ts
+++ b/src/modules/courses/interfaces/courses.controller.spec.ts
@@ -29,6 +29,7 @@ import {
   GetCourseQuestionBankReadinessUseCase,
   PrepareCourseQuestionBankUseCase,
 } from '../application/course-question-bank-readiness.use-case';
+import { GetCourseExamPreparationOptionsUseCase } from '../application/get-course-exam-preparation-options.use-case';
 import {
   ArchiveCourseSourceUseCase,
   GetCourseSourceLifecycleUseCase,
@@ -698,6 +699,69 @@ describe('CoursesController', () => {
     });
   });

+  it('returns exam preparation options for the current student and course', async () => {
+    const { controller, getCourseExamPreparationOptions } = createController();
+    getCourseExamPreparationOptions.execute.mockResolvedValue({
+      course: {
+        id: 'course-1',
+        title: 'Droit constitutionnel',
+        subjectId: 'subject-1',
+      },
+      readiness: {
+        canPrepare: true,
+        state: 'READY',
+        userMessage: 'Ton cours est prêt pour une préparation examen.',
+        blockers: [],
+        readySourceCount: 1,
+        readyKnowledgeUnitCount: 2,
+        availableQuestionCount: 20,
+      },
+      scopeOptions: [
+        {
+          kind: 'course',
+          id: 'course-1',
+          label: 'Tout le cours',
+          readyQuestionCount: 20,
+          readyKnowledgeUnitCount: 2,
+          canSelect: true,
+        },
+      ],
+      questionCountOptions: [10, 20],
+      defaultQuestionCount: 20,
+      supportedQuestionKinds: ['single_choice', 'multiple_choice'],
+      defaultConfig: {
+        scopeKind: 'course',
+        scopeId: 'course-1',
+        questionCount: 20,
+        complexityProfile: 'exam',
+      },
+      nextStep: {
+        kind: 'configuration_ready',
+        userMessage: 'Configuration prête. La session complète arrive ensuite.',
+      },
+    });
+
+    await expect(
+      controller.getExamPreparationOptions(currentStudent, ' course-1 '),
+    ).resolves.toMatchObject({
+      course: {
+        id: 'course-1',
+        title: 'Droit constitutionnel',
+      },
+      readiness: {
+        state: 'READY',
+      },
+      defaultConfig: {
+        complexityProfile: 'exam',
+      },
+    });
+
+    expect(getCourseExamPreparationOptions.execute).toHaveBeenCalledWith({
+      studentId: 'student-1',
+      courseId: 'course-1',
+    });
+  });
+
   it('defaults course quick revision questionCount when omitted', async () => {
     const { controller, startCourseQuickRevisionSession } = createController();
     startCourseQuickRevisionSession.execute.mockResolvedValue(
@@ -832,6 +896,7 @@ function createController() {
   const generateCourseRevisionSheet = { execute: jest.fn() };
   const getCourseQuestionBankReadiness = { execute: jest.fn() };
   const prepareCourseQuestionBank = { execute: jest.fn() };
+  const getCourseExamPreparationOptions = { execute: jest.fn() };
   const startCourseQuickRevisionSession = { execute: jest.fn() };
   const getResumableCourseRevisionSession = { execute: jest.fn() };
   const listCourseRevisionSessionHistory = { execute: jest.fn() };
@@ -856,6 +921,7 @@ function createController() {
       generateCourseRevisionSheet as unknown as GenerateCourseRevisionSheetUseCase,
       getCourseQuestionBankReadiness as unknown as GetCourseQuestionBankReadinessUseCase,
       prepareCourseQuestionBank as unknown as PrepareCourseQuestionBankUseCase,
+      getCourseExamPreparationOptions as unknown as GetCourseExamPreparationOptionsUseCase,
       startCourseQuickRevisionSession as unknown as StartCourseQuickRevisionSessionUseCase,
       getResumableCourseRevisionSession as unknown as GetResumableCourseRevisionSessionUseCase,
       listCourseRevisionSessionHistory as unknown as ListCourseRevisionSessionHistoryUseCase,
@@ -878,6 +944,7 @@ function createController() {
     generateCourseRevisionSheet,
     getCourseQuestionBankReadiness,
     prepareCourseQuestionBank,
+    getCourseExamPreparationOptions,
     startCourseQuickRevisionSession,
     getResumableCourseRevisionSession,
     listCourseRevisionSessionHistory,
diff --git a/src/modules/courses/interfaces/courses.controller.ts b/src/modules/courses/interfaces/courses.controller.ts
index 91e88b5..480fbf4 100644
--- a/src/modules/courses/interfaces/courses.controller.ts
+++ b/src/modules/courses/interfaces/courses.controller.ts
@@ -62,6 +62,7 @@ import { ArchiveCourseUseCase } from '../application/archive-course.use-case';
 import { DeleteCourseDocumentUseCase } from '../application/delete-course-document.use-case';
 import { DeleteCourseUseCase } from '../application/delete-course.use-case';
 import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
+import { GetCourseExamPreparationOptionsUseCase } from '../application/get-course-exam-preparation-options.use-case';
 import { GetCourseLifecycleUseCase } from '../application/get-course-lifecycle.use-case';
 import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
 import { UpdateCourseUseCase } from '../application/update-course.use-case';
@@ -106,6 +107,7 @@ export class CoursesController {
     private readonly generateCourseRevisionSheetUseCase: GenerateCourseRevisionSheetUseCase,
     private readonly getCourseQuestionBankReadinessUseCase: GetCourseQuestionBankReadinessUseCase,
     private readonly prepareCourseQuestionBankUseCase: PrepareCourseQuestionBankUseCase,
+    private readonly getCourseExamPreparationOptionsUseCase: GetCourseExamPreparationOptionsUseCase,
     private readonly startCourseQuickRevisionSessionUseCase: StartCourseQuickRevisionSessionUseCase,
     private readonly getResumableCourseRevisionSessionUseCase: GetResumableCourseRevisionSessionUseCase,
     private readonly listCourseRevisionSessionHistoryUseCase: ListCourseRevisionSessionHistoryUseCase,
@@ -237,6 +239,19 @@ export class CoursesController {
       .catch(normalizeCourseError);
   }

+  @Get('courses/:courseId/exam-preparation/options')
+  getExamPreparationOptions(
+    @CurrentStudent() student: AuthenticatedStudent,
+    @Param('courseId') courseId: string,
+  ) {
+    return this.getCourseExamPreparationOptionsUseCase
+      .execute({
+        studentId: student.id,
+        courseId: trimRequiredString(courseId, 'Course id is required'),
+      })
+      .catch(normalizeCourseError);
+  }
+
   @Get('subjects/:subjectId/progress')
   getSubjectProgress(
     @CurrentStudent() student: AuthenticatedStudent,
```

## Diff complet des fichiers nouveaux produit/test

### `src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts`

```diff
diff --git a/src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts b/src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts
new file mode 100644
index 0000000..44b5a1f
--- /dev/null
+++ b/src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts
@@ -0,0 +1,285 @@
+import type { QuestionBankService } from '../../activities/application/question-bank.service';
+import { GetCourseExamPreparationOptionsUseCase } from './get-course-exam-preparation-options.use-case';
+import type {
+  CourseDetailDto,
+  CourseDocumentDto,
+  CourseQuickRevisionKnowledgeUnitDto,
+  CoursesRepository,
+} from './courses.repository';
+
+describe('GetCourseExamPreparationOptionsUseCase', () => {
+  it('returns bounded exam options for a ready course without answers or corrections', async () => {
+    const { coursesRepository, questionBank, useCase } = createHarness();
+    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
+      courseDetail({
+        sources: [
+          courseDocument({ id: 'document-1', fileName: 'CM.pdf' }),
+          courseDocument({
+            id: 'document-2',
+            documentId: 'document-2',
+            fileName: 'TD.pdf',
+          }),
+        ],
+      }),
+    );
+    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
+      [
+        knowledgeUnit({ id: 'ku-1', documentId: 'document-1' }),
+        knowledgeUnit({ id: 'ku-2', documentId: 'document-1' }),
+        knowledgeUnit({ id: 'ku-3', documentId: 'document-2' }),
+      ],
+    );
+    questionBank.countActiveCourseQuickQuestions.mockImplementation(
+      (input: { knowledgeUnitIds?: string[] }) => {
+        if (!input.knowledgeUnitIds || input.knowledgeUnitIds.length === 3) {
+          return Promise.resolve(24);
+        }
+
+        return Promise.resolve(
+          input.knowledgeUnitIds.includes('ku-3') ? 8 : 16,
+        );
+      },
+    );
+
+    const options = await useCase.execute({
+      studentId: 'student-1',
+      courseId: 'course-1',
+    });
+
+    expect(options).toEqual({
+      course: {
+        id: 'course-1',
+        title: 'Droit constitutionnel',
+        subjectId: 'subject-1',
+      },
+      readiness: {
+        canPrepare: true,
+        state: 'READY',
+        userMessage: 'Ton cours est prêt pour une préparation examen.',
+        blockers: [],
+        readySourceCount: 2,
+        readyKnowledgeUnitCount: 3,
+        availableQuestionCount: 24,
+      },
+      scopeOptions: [
+        {
+          kind: 'course',
+          id: 'course-1',
+          label: 'Tout le cours',
+          readyQuestionCount: 24,
+          readyKnowledgeUnitCount: 3,
+          canSelect: true,
+        },
+        {
+          kind: 'source',
+          id: 'document-1',
+          label: 'CM.pdf',
+          readyQuestionCount: 16,
+          readyKnowledgeUnitCount: 2,
+          canSelect: true,
+        },
+        {
+          kind: 'source',
+          id: 'document-2',
+          label: 'TD.pdf',
+          readyQuestionCount: 8,
+          readyKnowledgeUnitCount: 1,
+          canSelect: false,
+        },
+      ],
+      questionCountOptions: [10, 20],
+      defaultQuestionCount: 20,
+      supportedQuestionKinds: ['single_choice', 'multiple_choice'],
+      defaultConfig: {
+        scopeKind: 'course',
+        scopeId: 'course-1',
+        questionCount: 20,
+        complexityProfile: 'exam',
+      },
+      nextStep: {
+        kind: 'configuration_ready',
+        userMessage: 'Configuration prête. La session complète arrive ensuite.',
+      },
+    });
+    expect(JSON.stringify(options)).not.toMatch(/correct|correction|answer/i);
+  });
+
+  it('blocks exam preparation when the course has no ready source', async () => {
+    const { coursesRepository, questionBank, useCase } = createHarness();
+    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
+      courseDetail({
+        sources: [courseDocument({ status: 'PROCESSING' })],
+      }),
+    );
+    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
+      [],
+    );
+
+    await expect(
+      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
+    ).resolves.toMatchObject({
+      readiness: {
+        canPrepare: false,
+        state: 'BLOCKED',
+        blockers: ['NO_READY_SOURCE'],
+        readySourceCount: 0,
+        readyKnowledgeUnitCount: 0,
+        availableQuestionCount: 0,
+      },
+      scopeOptions: [],
+      questionCountOptions: [],
+      defaultQuestionCount: null,
+      defaultConfig: null,
+    });
+    expect(questionBank.countActiveCourseQuickQuestions).not.toHaveBeenCalled();
+  });
+
+  it('blocks exam preparation when ready sources have no usable knowledge units', async () => {
+    const { coursesRepository, questionBank, useCase } = createHarness();
+    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
+      courseDetail({
+        sources: [courseDocument({ id: 'document-1' })],
+      }),
+    );
+    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
+      [],
+    );
+
+    await expect(
+      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
+    ).resolves.toMatchObject({
+      readiness: {
+        canPrepare: false,
+        state: 'BLOCKED',
+        blockers: ['NO_KNOWLEDGE_UNITS'],
+        readySourceCount: 1,
+        readyKnowledgeUnitCount: 0,
+        availableQuestionCount: 0,
+      },
+      scopeOptions: [],
+      questionCountOptions: [],
+      defaultQuestionCount: null,
+      defaultConfig: null,
+    });
+    expect(questionBank.countActiveCourseQuickQuestions).not.toHaveBeenCalled();
+  });
+
+  it('reports partially ready when only a small bounded configuration is possible', async () => {
+    const { coursesRepository, questionBank, useCase } = createHarness();
+    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
+      courseDetail({
+        sources: [courseDocument({ id: 'document-1' })],
+      }),
+    );
+    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
+      [knowledgeUnit({ documentId: 'document-1' })],
+    );
+    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(12);
+
+    await expect(
+      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
+    ).resolves.toMatchObject({
+      readiness: {
+        canPrepare: true,
+        state: 'PARTIALLY_READY',
+        availableQuestionCount: 12,
+      },
+      questionCountOptions: [10],
+      defaultQuestionCount: 10,
+      defaultConfig: {
+        scopeKind: 'course',
+        scopeId: 'course-1',
+        questionCount: 10,
+        complexityProfile: 'exam',
+      },
+    });
+  });
+
+  it('refuses courses outside the current student ownership scope', async () => {
+    const { coursesRepository, useCase } = createHarness();
+    coursesRepository.findDetailByIdForStudent.mockResolvedValue(null);
+
+    await expect(
+      useCase.execute({ studentId: 'student-1', courseId: 'missing-course' }),
+    ).rejects.toThrow('Course not found');
+  });
+});
+
+function createHarness() {
+  const coursesRepository = {
+    findDetailByIdForStudent: jest.fn(),
+    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
+  };
+  const questionBank = {
+    countActiveCourseQuickQuestions: jest.fn(),
+  };
+
+  return {
+    coursesRepository,
+    questionBank,
+    useCase: new GetCourseExamPreparationOptionsUseCase(
+      coursesRepository as unknown as CoursesRepository,
+      questionBank as unknown as QuestionBankService,
+    ),
+  };
+}
+
+function courseDetail(
+  overrides: Partial<CourseDetailDto> = {},
+): CourseDetailDto {
+  return {
+    course: {
+      id: 'course-1',
+      studentId: 'student-1',
+      subjectId: 'subject-1',
+      title: 'Droit constitutionnel',
+      description: null,
+      chapterLabel: null,
+      estimatedMinutes: null,
+      displayOrder: 0,
+      createdAt: new Date('2026-06-18T10:00:00.000Z'),
+      updatedAt: new Date('2026-06-18T10:00:00.000Z'),
+      sourceCount: overrides.sources?.length ?? 0,
+      readySourceCount:
+        overrides.sources?.filter((source) => source.status === 'READY')
+          .length ?? 0,
+      processingSourceCount: 0,
+      failedSourceCount: 0,
+    },
+    subject: {
+      id: 'subject-1',
+      name: 'Droit public',
+    },
+    sources: [],
+    ...overrides,
+  };
+}
+
+function courseDocument(
+  overrides: Partial<CourseDocumentDto> = {},
+): CourseDocumentDto {
+  return {
+    id: 'document-1',
+    courseId: 'course-1',
+    documentId: 'document-1',
+    fileName: 'CM.pdf',
+    kind: 'COURSE_PDF',
+    status: 'READY',
+    errorCode: null,
+    createdAt: new Date('2026-06-18T10:00:00.000Z'),
+    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
+    ...overrides,
+  };
+}
+
+function knowledgeUnit(
+  overrides: Partial<CourseQuickRevisionKnowledgeUnitDto> = {},
+): CourseQuickRevisionKnowledgeUnitDto {
+  return {
+    id: 'ku-1',
+    subjectId: 'subject-1',
+    documentId: 'document-1',
+    title: 'Séparation des pouvoirs',
+    ...overrides,
+  };
+}
```

### `src/modules/courses/application/get-course-exam-preparation-options.use-case.ts`

```diff
diff --git a/src/modules/courses/application/get-course-exam-preparation-options.use-case.ts b/src/modules/courses/application/get-course-exam-preparation-options.use-case.ts
new file mode 100644
index 0000000..f80964a
--- /dev/null
+++ b/src/modules/courses/application/get-course-exam-preparation-options.use-case.ts
@@ -0,0 +1,310 @@
+import { Inject, Injectable } from '@nestjs/common';
+import { QuestionBankService } from '../../activities/application/question-bank.service';
+import {
+  COURSES_REPOSITORY,
+  type CourseDetailDto,
+  type CourseDocumentDto,
+  type CourseQuickRevisionKnowledgeUnitDto,
+  type CoursesRepository,
+} from './courses.repository';
+
+export type CourseExamPreparationReadinessState =
+  | 'READY'
+  | 'PARTIALLY_READY'
+  | 'NOT_READY'
+  | 'BLOCKED';
+
+export type CourseExamPreparationBlocker =
+  | 'NO_READY_SOURCE'
+  | 'NO_KNOWLEDGE_UNITS'
+  | 'INSUFFICIENT_QUESTIONS';
+
+export type CourseExamPreparationScopeKind = 'course' | 'source';
+
+export interface CourseExamPreparationOptions {
+  course: {
+    id: string;
+    title: string;
+    subjectId: string;
+  };
+  readiness: {
+    canPrepare: boolean;
+    state: CourseExamPreparationReadinessState;
+    userMessage: string;
+    blockers: CourseExamPreparationBlocker[];
+    readySourceCount: number;
+    readyKnowledgeUnitCount: number;
+    availableQuestionCount: number;
+  };
+  scopeOptions: CourseExamPreparationScopeOption[];
+  questionCountOptions: number[];
+  defaultQuestionCount: number | null;
+  supportedQuestionKinds: string[];
+  defaultConfig: CourseExamPreparationConfig | null;
+  nextStep: {
+    kind: 'configuration_ready' | 'needs_questions' | 'blocked';
+    userMessage: string;
+  };
+}
+
+export interface CourseExamPreparationScopeOption {
+  kind: CourseExamPreparationScopeKind;
+  id: string;
+  label: string;
+  readyQuestionCount: number;
+  readyKnowledgeUnitCount: number;
+  canSelect: boolean;
+}
+
+export interface CourseExamPreparationConfig {
+  scopeKind: CourseExamPreparationScopeKind;
+  scopeId: string;
+  questionCount: number;
+  complexityProfile: 'exam';
+}
+
+const QUESTION_COUNT_OPTIONS = [10, 20, 30] as const;
+const READY_DEFAULT_QUESTION_COUNT = 20;
+const SUPPORTED_EXAM_QUESTION_KINDS = [
+  'single_choice',
+  'multiple_choice',
+] as const;
+
+@Injectable()
+export class GetCourseExamPreparationOptionsUseCase {
+  constructor(
+    @Inject(COURSES_REPOSITORY)
+    private readonly coursesRepository: CoursesRepository,
+    private readonly questionBank: QuestionBankService,
+  ) {}
+
+  async execute(input: {
+    studentId: string;
+    courseId: string;
+  }): Promise<CourseExamPreparationOptions> {
+    const detail = await this.coursesRepository.findDetailByIdForStudent(input);
+
+    if (!detail) {
+      throw new Error('Course not found');
+    }
+
+    const readySources = detail.sources.filter(isReadyCoursePdfSource);
+    if (readySources.length === 0) {
+      return buildBlockedOptions({
+        detail,
+        blocker: 'NO_READY_SOURCE',
+        userMessage:
+          'Ajoute une source prête avant de configurer une préparation examen.',
+        readySourceCount: 0,
+        readyKnowledgeUnitCount: 0,
+      });
+    }
+
+    const knowledgeUnits =
+      await this.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
+        {
+          studentId: input.studentId,
+          courseId: detail.course.id,
+          subjectId: detail.course.subjectId,
+        },
+      );
+
+    if (knowledgeUnits.length === 0) {
+      return buildBlockedOptions({
+        detail,
+        blocker: 'NO_KNOWLEDGE_UNITS',
+        userMessage:
+          "Aucune notion exploitable n'a encore été trouvée pour ce cours.",
+        readySourceCount: readySources.length,
+        readyKnowledgeUnitCount: 0,
+      });
+    }
+
+    const availableQuestionCount =
+      await this.questionBank.countActiveCourseQuickQuestions({
+        studentId: input.studentId,
+        subjectId: detail.course.subjectId,
+        courseId: detail.course.id,
+        knowledgeUnitIds: knowledgeUnits.map((unit) => unit.id),
+      });
+    const sourceOptions = await this.buildSourceOptions({
+      studentId: input.studentId,
+      detail,
+      readySources,
+      knowledgeUnits,
+    });
+    const questionCountOptions = QUESTION_COUNT_OPTIONS.filter(
+      (count) => count <= availableQuestionCount,
+    );
+    const defaultQuestionCount =
+      resolveDefaultQuestionCount(questionCountOptions);
+    const state = resolveReadinessState(availableQuestionCount);
+    const canPrepare = defaultQuestionCount !== null;
+
+    return {
+      course: toCourseSummary(detail),
+      readiness: {
+        canPrepare,
+        state,
+        userMessage: readinessMessage(state),
+        blockers: state === 'NOT_READY' ? ['INSUFFICIENT_QUESTIONS'] : [],
+        readySourceCount: readySources.length,
+        readyKnowledgeUnitCount: knowledgeUnits.length,
+        availableQuestionCount,
+      },
+      scopeOptions: [
+        {
+          kind: 'course',
+          id: detail.course.id,
+          label: 'Tout le cours',
+          readyQuestionCount: availableQuestionCount,
+          readyKnowledgeUnitCount: knowledgeUnits.length,
+          canSelect: canPrepare,
+        },
+        ...sourceOptions,
+      ],
+      questionCountOptions,
+      defaultQuestionCount,
+      supportedQuestionKinds: [...SUPPORTED_EXAM_QUESTION_KINDS],
+      defaultConfig: defaultQuestionCount
+        ? {
+            scopeKind: 'course',
+            scopeId: detail.course.id,
+            questionCount: defaultQuestionCount,
+            complexityProfile: 'exam',
+          }
+        : null,
+      nextStep: nextStepForState(state),
+    };
+  }
+
+  private async buildSourceOptions(input: {
+    studentId: string;
+    detail: CourseDetailDto;
+    readySources: CourseDocumentDto[];
+    knowledgeUnits: CourseQuickRevisionKnowledgeUnitDto[];
+  }): Promise<CourseExamPreparationScopeOption[]> {
+    const options: CourseExamPreparationScopeOption[] = [];
+
+    for (const source of input.readySources) {
+      const sourceKnowledgeUnits = input.knowledgeUnits.filter(
+        (unit) => unit.documentId === source.documentId,
+      );
+      const readyQuestionCount =
+        sourceKnowledgeUnits.length === 0
+          ? 0
+          : await this.questionBank.countActiveCourseQuickQuestions({
+              studentId: input.studentId,
+              subjectId: input.detail.course.subjectId,
+              courseId: input.detail.course.id,
+              knowledgeUnitIds: sourceKnowledgeUnits.map((unit) => unit.id),
+            });
+
+      options.push({
+        kind: 'source',
+        id: source.documentId,
+        label: source.fileName,
+        readyQuestionCount,
+        readyKnowledgeUnitCount: sourceKnowledgeUnits.length,
+        canSelect: readyQuestionCount >= QUESTION_COUNT_OPTIONS[0],
+      });
+    }
+
+    return options;
+  }
+}
+
+function buildBlockedOptions(input: {
+  detail: CourseDetailDto;
+  blocker: CourseExamPreparationBlocker;
+  userMessage: string;
+  readySourceCount: number;
+  readyKnowledgeUnitCount: number;
+}): CourseExamPreparationOptions {
+  return {
+    course: toCourseSummary(input.detail),
+    readiness: {
+      canPrepare: false,
+      state: 'BLOCKED',
+      userMessage: input.userMessage,
+      blockers: [input.blocker],
+      readySourceCount: input.readySourceCount,
+      readyKnowledgeUnitCount: input.readyKnowledgeUnitCount,
+      availableQuestionCount: 0,
+    },
+    scopeOptions: [],
+    questionCountOptions: [],
+    defaultQuestionCount: null,
+    supportedQuestionKinds: [...SUPPORTED_EXAM_QUESTION_KINDS],
+    defaultConfig: null,
+    nextStep: {
+      kind: 'blocked',
+      userMessage: input.userMessage,
+    },
+  };
+}
+
+function isReadyCoursePdfSource(source: CourseDocumentDto): boolean {
+  return source.kind === 'COURSE_PDF' && source.status === 'READY';
+}
+
+function toCourseSummary(detail: CourseDetailDto) {
+  return {
+    id: detail.course.id,
+    title: detail.course.title,
+    subjectId: detail.course.subjectId,
+  };
+}
+
+function resolveDefaultQuestionCount(
+  options: readonly number[],
+): number | null {
+  if (options.length === 0) {
+    return null;
+  }
+
+  return options.includes(READY_DEFAULT_QUESTION_COUNT)
+    ? READY_DEFAULT_QUESTION_COUNT
+    : options[options.length - 1];
+}
+
+function resolveReadinessState(
+  availableQuestionCount: number,
+): CourseExamPreparationReadinessState {
+  if (availableQuestionCount >= READY_DEFAULT_QUESTION_COUNT) {
+    return 'READY';
+  }
+
+  if (availableQuestionCount >= QUESTION_COUNT_OPTIONS[0]) {
+    return 'PARTIALLY_READY';
+  }
+
+  return 'NOT_READY';
+}
+
+function readinessMessage(state: CourseExamPreparationReadinessState): string {
+  if (state === 'READY') {
+    return 'Ton cours est prêt pour une préparation examen.';
+  }
+
+  if (state === 'PARTIALLY_READY') {
+    return 'Ton cours permet une préparation courte.';
+  }
+
+  return 'Prépare plus de questions avant de configurer ce mode.';
+}
+
+function nextStepForState(state: CourseExamPreparationReadinessState) {
+  if (state === 'NOT_READY') {
+    return {
+      kind: 'needs_questions' as const,
+      userMessage:
+        'Prépare davantage de questions avant de valider une configuration.',
+    };
+  }
+
+  return {
+    kind: 'configuration_ready' as const,
+    userMessage: 'Configuration prête. La session complète arrive ensuite.',
+  };
+}
```
