import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import {
  CourseQuickRevisionGenerationFailedError,
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionQuestionCountInvalidError,
  CourseQuickRevisionQuestionsPreparingError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from '../application/start-course-quick-revision-session.use-case';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { ArchiveCourseUseCase } from '../application/archive-course.use-case';
import { DeleteCourseDocumentUseCase } from '../application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from '../application/course-progress.use-case';
import {
  GetCourseQuestionBankReadinessUseCase,
  PrepareCourseQuestionBankUseCase,
} from '../application/course-question-bank-readiness.use-case';
import { GetCourseExamPreparationOptionsUseCase } from '../application/get-course-exam-preparation-options.use-case';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from '../application/course-source-lifecycle.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { GetCourseLifecycleUseCase } from '../application/get-course-lifecycle.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UpdateCourseUseCase } from '../application/update-course.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
import { CoursesController } from './courses.controller';
import { SourceDeleteBlockedError } from '../../documents/domain/source-lifecycle.entity';
import { GetResumableCourseRevisionSessionUseCase } from '../../revision-sessions/application/get-resumable-course-revision-session.use-case';
import { ListCourseExamPreparationSessionHistoryUseCase } from '../../revision-sessions/application/exam-preparation-sessions.use-cases';
import { ListCourseRevisionSessionHistoryUseCase } from '../../revision-sessions/application/list-revision-session-history.use-case';
import { ListCourseRichClosedExerciseHistoryUseCase } from '../../activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case';
import { StartCourseExamPreparationSessionUseCase } from '../application/start-course-exam-preparation-session.use-case';

describe('CoursesController', () => {
  it('lists courses for the current student and subject', async () => {
    const { controller, listCourses } = createController();
    listCourses.execute.mockResolvedValue([courseWithStats()]);

    await expect(
      controller.listForSubject(currentStudent, 'subject-1'),
    ).resolves.toEqual([publicCourse()]);

    expect(listCourses.execute.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
  });

  it('creates a course with validated trimmed input', async () => {
    const { controller, createCourse } = createController();
    createCourse.execute.mockResolvedValue(courseWithStats());

    await expect(
      controller.createForSubject(currentStudent, ' subject-1 ', {
        title: ' Droit constitutionnel ',
        description: ' Institutions ',
        chapterLabel: ' Chapitre 1 ',
        estimatedMinutes: 30,
      }),
    ).resolves.toEqual(publicCourse());

    expect(createCourse.execute.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        description: 'Institutions',
        chapterLabel: 'Chapitre 1',
        estimatedMinutes: 30,
      },
    ]);
  });

  it('rejects invalid course creation body as 400', () => {
    const { controller, createCourse } = createController();

    expect(() =>
      controller.createForSubject(currentStudent, 'subject-1', {
        title: 'x',
      }),
    ).toThrow(BadRequestException);
    expect(createCourse.execute.mock.calls).toHaveLength(0);
  });

  it('returns a complete course list item after patching a course', async () => {
    const { controller, updateCourse } = createController();
    updateCourse.execute.mockResolvedValue(
      courseWithStats({
        title: 'Droit public',
        sourceCount: 3,
        readySourceCount: 1,
        processingSourceCount: 1,
        failedSourceCount: 1,
      }),
    );

    await expect(
      controller.updateCourse(currentStudent, ' course-1 ', {
        title: ' Droit public ',
      }),
    ).resolves.toEqual(
      publicCourse({
        title: 'Droit public',
        sourceCount: 3,
        readySourceCount: 1,
        processingSourceCount: 1,
        failedSourceCount: 1,
      }),
    );

    expect(updateCourse.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      title: 'Droit public',
    });
  });

  it('returns detail with subject and sources', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockResolvedValue({
      course: courseWithStats({ sourceCount: 1, readySourceCount: 1 }),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z'),
        },
      ],
    });

    await expect(
      controller.getCourse(currentStudent, 'course-1'),
    ).resolves.toEqual({
      course: publicCourse({ sourceCount: 1, readySourceCount: 1 }),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: '2026-06-18T10:00:00.000Z',
          updatedAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
  });

  it('returns course progress without exposing mastery internals', async () => {
    const { controller, getCourseProgress } = createController();
    getCourseProgress.execute.mockResolvedValue(courseProgress());

    await expect(
      controller.getCourseProgress(currentStudent, ' course-1 '),
    ).resolves.toEqual(publicCourseProgress());

    expect(getCourseProgress.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      JSON.stringify(
        await controller.getCourseProgress(currentStudent, 'course-1'),
      ),
    ).not.toContain('storagePath');
  });

  it('returns subject progress with per-course summaries', async () => {
    const { controller, getSubjectProgress } = createController();
    getSubjectProgress.execute.mockResolvedValue(subjectProgress());

    await expect(
      controller.getSubjectProgress(currentStudent, ' subject-1 '),
    ).resolves.toEqual(publicSubjectProgress());

    expect(getSubjectProgress.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('maps course and subject progress not found to 404', async () => {
    const { controller, getCourseProgress, getSubjectProgress } =
      createController();
    getCourseProgress.execute.mockRejectedValueOnce(
      new Error('Course not found'),
    );
    getSubjectProgress.execute.mockRejectedValueOnce(
      new Error('Course subject not found'),
    );

    await expect(
      controller.getCourseProgress(currentStudent, 'missing-course'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.getSubjectProgress(currentStudent, 'missing-subject'),
    ).rejects.toThrow(NotFoundException);
  });

  it('maps course not found to 404', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockRejectedValue(new Error('Course not found'));

    await expect(
      controller.getCourse(currentStudent, 'other-student-course'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes empty courses and maps document conflicts to 409', async () => {
    const { controller, deleteCourse } = createController();
    deleteCourse.execute.mockResolvedValueOnce({ deleted: true });

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).resolves.toEqual(undefined);

    deleteCourse.execute.mockRejectedValueOnce(
      new CourseContainsDocumentsError(),
    );

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('deletes a course source for the current student', async () => {
    const { controller, deleteCourseDocument } = createController();
    deleteCourseDocument.execute.mockResolvedValue(undefined);

    await expect(
      controller.deleteCourseDocument(
        currentStudent,
        ' course-1 ',
        ' document-1 ',
      ),
    ).resolves.toBeUndefined();

    expect(deleteCourseDocument.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('maps missing course sources to 404', async () => {
    const { controller, deleteCourseDocument } = createController();
    deleteCourseDocument.execute.mockRejectedValue(
      new NotFoundException('Course source not found'),
    );

    await expect(
      controller.deleteCourseDocument(
        currentStudent,
        'course-1',
        'document-other',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('loads source lifecycle for a course source', async () => {
    const { controller, getCourseSourceLifecycle } = createController();
    getCourseSourceLifecycle.execute.mockResolvedValue(
      sourceLifecycleDecision(),
    );

    await expect(
      controller.getCourseSourceLifecycle(
        currentStudent,
        ' course-1 ',
        ' document-1 ',
      ),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      recommendedAction: 'ARCHIVE',
    });

    expect(getCourseSourceLifecycle.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('archives a course source', async () => {
    const { controller, archiveCourseSource } = createController();
    archiveCourseSource.execute.mockResolvedValue(
      sourceLifecycleDecision({
        status: 'ARCHIVED',
        recommendedAction: 'BLOCK',
        canArchive: false,
      }),
    );

    await expect(
      controller.archiveCourseSource(
        currentStudent,
        ' course-1 ',
        ' document-1 ',
      ),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
    });

    expect(archiveCourseSource.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('maps lifecycle delete conflicts to 409', async () => {
    const { controller, deleteCourseDocument } = createController();
    deleteCourseDocument.execute.mockRejectedValue(
      new SourceDeleteBlockedError(sourceLifecycleDecision()),
    );

    await expect(
      controller.deleteCourseDocument(currentStudent, 'course-1', 'document-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('uploads a course PDF with course-derived context only', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockResolvedValue(courseDocument());

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        ' course-1 ',
        uploadedPdf(),
      ),
    ).resolves.toEqual(publicCourseDocument());

    expect(uploadCoursePdfForCourse.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      courseId: 'course-1',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
  });

  it('rejects missing and invalid course PDF uploads before the use case', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        undefined,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        originalname: 'notes.txt',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        mimetype: 'text/plain',
      }),
    ).toThrow(BadRequestException);
    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('rejects client-provided course upload ownership fields', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        uploadedPdf(),
        { subjectId: 'subject-1' },
      ),
    ).toThrow(BadRequestException);

    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('maps unknown course uploads to 404', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockRejectedValue(
      new Error('Course not found'),
    );

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'other-student-course',
        uploadedPdf(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('gets a course-level revision sheet without exposing internal metadata', async () => {
    const { controller, getCourseRevisionSheet } = createController();
    getCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.getCourseRevisionSheet(currentStudent, ' course-1 '),
    ).resolves.toEqual(publicRevisionSheet());

    expect(getCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      JSON.stringify(
        await controller.getCourseRevisionSheet(currentStudent, 'course-1'),
      ),
    ).not.toContain('promptVersion');
  });

  it('generates a course-level revision sheet via the backend-selected source', async () => {
    const { controller, generateCourseRevisionSheet } = createController();
    generateCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
    ).resolves.toEqual(publicRevisionSheet());

    expect(generateCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
  });

  it('maps course-level revision sheet errors to 404 and 409', async () => {
    const { controller, getCourseRevisionSheet, generateCourseRevisionSheet } =
      createController();
    getCourseRevisionSheet.execute.mockResolvedValueOnce(null);

    await expect(
      controller.getCourseRevisionSheet(currentStudent, 'course-1'),
    ).rejects.toThrow(NotFoundException);

    generateCourseRevisionSheet.execute.mockRejectedValueOnce(
      new CourseRevisionSheetSourceNotReadyError(),
    );

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('starts a course quick revision session with an optional questionCount', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();
    startCourseQuickRevisionSession.execute.mockResolvedValue(
      revisionSessionResponse(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, ' course-1 ', {
        questionCount: 20,
      }),
    ).resolves.toMatchObject({
      session: {
        id: 'session-1',
        courseId: 'course-1',
        mode: 'QUICK',
      },
      currentAction: {
        kind: 'DIAGNOSTIC_QUIZ',
      },
    });

    expect(startCourseQuickRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: 20,
    });
  });

  it('returns a resumable course quick revision session', async () => {
    const { controller, getResumableCourseRevisionSession } =
      createController();
    getResumableCourseRevisionSession.execute.mockResolvedValue({
      session: {
        id: 'session-1',
        status: 'STARTED',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        mode: 'QUICK',
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        completedAt: null,
      },
      currentAction: {
        id: 'action-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
      progress: {
        answeredQuestionCount: 2,
        totalQuestionCount: 5,
      },
      userMessage: 'Tu as une session en cours.',
    });

    await expect(
      controller.getResumableRevisionSession(currentStudent, ' course-1 '),
    ).resolves.toMatchObject({
      session: {
        id: 'session-1',
        courseId: 'course-1',
      },
      progress: {
        answeredQuestionCount: 2,
        totalQuestionCount: 5,
      },
    });

    expect(getResumableCourseRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
  });

  it('returns completed revision session history for a course', async () => {
    const { controller, listCourseRevisionSessionHistory } = createController();
    listCourseRevisionSessionHistory.execute.mockResolvedValue(
      revisionSessionHistory(),
    );

    await expect(
      controller.getCourseRevisionSessionHistory(
        currentStudent,
        ' course-1 ',
        '5',
      ),
    ).resolves.toMatchObject({
      items: [
        {
          session: {
            id: 'revision-session-1',
            courseId: 'course-1',
            status: 'COMPLETED',
          },
          summary: {
            correctAnswers: 4,
            totalQuestions: 6,
          },
        },
      ],
    });

    expect(listCourseRevisionSessionHistory.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      limit: 5,
    });
  });

  it('returns completed exam preparation history for a course', async () => {
    const { controller, listCourseExamPreparationSessionHistory } =
      createController();
    listCourseExamPreparationSessionHistory.execute.mockResolvedValue(
      revisionSessionHistory('EXAM'),
    );

    await expect(
      controller.getCourseExamPreparationSessionHistory(
        currentStudent,
        ' course-1 ',
        '5',
      ),
    ).resolves.toMatchObject({
      items: [
        {
          session: {
            id: 'revision-session-1',
            courseId: 'course-1',
            mode: 'EXAM',
          },
        },
      ],
    });

    expect(
      listCourseExamPreparationSessionHistory.execute,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      limit: 5,
    });
  });

  it('rejects invalid course history limits before use case access', () => {
    const { controller, listCourseRevisionSessionHistory } = createController();

    expect(() =>
      controller.getCourseRevisionSessionHistory(
        currentStudent,
        'course-1',
        '0',
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.getCourseRevisionSessionHistory(
        currentStudent,
        'course-1',
        '51',
      ),
    ).toThrow(BadRequestException);

    expect(listCourseRevisionSessionHistory.execute).not.toHaveBeenCalled();
  });

  it('returns completed rich closed history for a course', async () => {
    const { controller, listCourseRichClosedExerciseHistory } =
      createController();
    listCourseRichClosedExerciseHistory.execute.mockResolvedValue({
      items: [
        {
          id: 'rich-session-1',
          sessionId: 'rich-session-1',
          type: 'rich_closed_exercise',
          status: 'completed',
          title: 'Questions riches',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnit: {
            id: 'unit-1',
            title: 'Séparation des pouvoirs',
          },
          course: {
            id: 'course-1',
            title: 'Droit constitutionnel',
          },
          correctAnswers: 5,
          totalQuestions: 6,
          score: 0.833,
          completedAt: new Date('2026-06-18T10:07:00.000Z'),
          resultPath: '/activities/rich-closed/rich-session-1/result',
        },
      ],
    });

    await expect(
      controller.getCourseRichClosedHistory(currentStudent, ' course-1 ', '5'),
    ).resolves.toMatchObject({
      items: [
        {
          sessionId: 'rich-session-1',
          type: 'rich_closed_exercise',
          correctAnswers: 5,
          totalQuestions: 6,
          resultPath: '/activities/rich-closed/rich-session-1/result',
        },
      ],
    });

    expect(listCourseRichClosedExerciseHistory.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      limit: 5,
    });
  });

  it('returns course question bank readiness and starts async preparation', async () => {
    const {
      controller,
      getCourseQuestionBankReadiness,
      prepareCourseQuestionBank,
    } = createController();
    getCourseQuestionBankReadiness.execute.mockResolvedValue(
      questionBankReadiness({ status: 'NOT_PREPARED' }),
    );
    prepareCourseQuestionBank.execute.mockResolvedValue(
      questionBankReadiness({ status: 'PREPARING' }),
    );

    await expect(
      controller.getQuestionBankReadiness(currentStudent, ' course-1 ', '5'),
    ).resolves.toMatchObject({
      courseId: 'course-1',
      status: 'NOT_PREPARED',
      targetQuestionCount: 5,
    });
    await expect(
      controller.prepareQuestionBank(currentStudent, ' course-1 ', {
        questionCount: 5,
      }),
    ).resolves.toMatchObject({
      courseId: 'course-1',
      status: 'PREPARING',
      targetQuestionCount: 5,
    });

    expect(getCourseQuestionBankReadiness.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: 5,
    });
    expect(prepareCourseQuestionBank.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: 5,
    });
  });

  it('returns exam preparation options for the current student and course', async () => {
    const { controller, getCourseExamPreparationOptions } = createController();
    getCourseExamPreparationOptions.execute.mockResolvedValue({
      course: {
        id: 'course-1',
        title: 'Droit constitutionnel',
        subjectId: 'subject-1',
      },
      readiness: {
        canPrepare: true,
        state: 'READY',
        userMessage: 'Ton cours est prêt pour une préparation examen.',
        blockers: [],
        readySourceCount: 1,
        readyKnowledgeUnitCount: 2,
        availableQuestionCount: 20,
      },
      scopeOptions: [
        {
          kind: 'course',
          id: 'course-1',
          label: 'Tout le cours',
          readyQuestionCount: 20,
          readyKnowledgeUnitCount: 2,
          canSelect: true,
        },
      ],
      questionCountOptions: [10, 20],
      defaultQuestionCount: 20,
      supportedQuestionKinds: ['single_choice', 'multiple_choice'],
      defaultConfig: {
        scopeKind: 'course',
        scopeId: 'course-1',
        questionCount: 20,
        complexityProfile: 'exam',
      },
      nextStep: {
        kind: 'configuration_ready',
        userMessage:
          'Configuration prête. Tu peux démarrer un entraînement examen.',
      },
    });

    await expect(
      controller.getExamPreparationOptions(currentStudent, ' course-1 '),
    ).resolves.toMatchObject({
      course: {
        id: 'course-1',
        title: 'Droit constitutionnel',
      },
      readiness: {
        state: 'READY',
      },
      defaultConfig: {
        complexityProfile: 'exam',
      },
    });

    expect(getCourseExamPreparationOptions.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
  });

  it('starts an exam preparation session from a validated configuration', async () => {
    const { controller, startCourseExamPreparationSession } =
      createController();
    startCourseExamPreparationSession.execute.mockResolvedValue(
      examRevisionSessionResponse(),
    );

    await expect(
      controller.startExamPreparationSession(currentStudent, ' course-1 ', {
        scopeKind: 'course',
        scopeId: 'course-1',
        questionCount: 20,
        complexityProfile: 'exam',
      }),
    ).resolves.toMatchObject({
      session: {
        id: 'exam-session-1',
        mode: 'EXAM',
      },
      currentAction: {
        kind: 'DIAGNOSTIC_QUIZ',
      },
    });

    expect(startCourseExamPreparationSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      scopeKind: 'course',
      scopeId: 'course-1',
      questionCount: 20,
      complexityProfile: 'exam',
    });
  });

  it('defaults course quick revision questionCount when omitted', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();
    startCourseQuickRevisionSession.execute.mockResolvedValue(
      revisionSessionResponse(),
    );

    await controller.startQuickRevisionSession(currentStudent, 'course-1');

    expect(startCourseQuickRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: undefined,
    });
  });

  it('rejects client-owned or unsupported course quick revision fields', () => {
    const { controller, startCourseQuickRevisionSession } = createController();

    expect(() =>
      controller.startQuickRevisionSession(currentStudent, 'course-1', {
        subjectId: 'subject-1',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.startQuickRevisionSession(currentStudent, 'course-1', {
        questionCount: 10,
        documentId: 'document-1',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.startQuickRevisionSession(currentStudent, 'course-1', {
        unexpected: true,
      }),
    ).toThrow(BadRequestException);

    for (const questionCount of [4, 31, 10.5, '10']) {
      expect(() =>
        controller.startQuickRevisionSession(currentStudent, 'course-1', {
          questionCount,
        }),
      ).toThrow(BadRequestException);
    }

    expect(startCourseQuickRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps course quick revision unavailability to 409', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionSourceNotReadyError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionKnowledgeUnitNotReadyError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionQuestionsPreparingError(
        questionBankReadiness({
          status: 'PREPARING',
          userMessage:
            'Les questions sont en préparation. Réessaie dans un instant.',
        }),
      ),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'COURSE_QUICK_REVISION_QUESTIONS_PREPARING',
        message: 'Les questions sont en préparation. Réessaie dans un instant.',
        readiness: {
          status: 'PREPARING',
        },
      },
    });

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionQuestionCountInvalidError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps course quick revision generation failures to 409', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionGenerationFailedError(
        new Error('provider failed'),
      ),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });
});

const currentStudent = {
  id: 'student-1',
  firebaseUid: 'firebase-1',
  email: 'student@example.test',
  displayName: 'Student',
};

function createController() {
  const createCourse = { execute: jest.fn() };
  const listCourses = { execute: jest.fn() };
  const getCourseDetail = { execute: jest.fn() };
  const getCourseLifecycle = { execute: jest.fn() };
  const updateCourse = { execute: jest.fn() };
  const archiveCourse = { execute: jest.fn() };
  const deleteCourse = { execute: jest.fn() };
  const deleteCourseDocument = { execute: jest.fn() };
  const uploadCoursePdfForCourse = { execute: jest.fn() };
  const getCourseRevisionSheet = { execute: jest.fn() };
  const generateCourseRevisionSheet = { execute: jest.fn() };
  const getCourseQuestionBankReadiness = { execute: jest.fn() };
  const prepareCourseQuestionBank = { execute: jest.fn() };
  const getCourseExamPreparationOptions = { execute: jest.fn() };
  const startCourseExamPreparationSession = { execute: jest.fn() };
  const startCourseQuickRevisionSession = { execute: jest.fn() };
  const getResumableCourseRevisionSession = { execute: jest.fn() };
  const listCourseRevisionSessionHistory = { execute: jest.fn() };
  const listCourseExamPreparationSessionHistory = { execute: jest.fn() };
  const listCourseRichClosedExerciseHistory = { execute: jest.fn() };
  const getCourseProgress = { execute: jest.fn() };
  const getSubjectProgress = { execute: jest.fn() };
  const getCourseSourceLifecycle = { execute: jest.fn() };
  const archiveCourseSource = { execute: jest.fn() };

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      getCourseLifecycle as unknown as GetCourseLifecycleUseCase,
      updateCourse as unknown as UpdateCourseUseCase,
      archiveCourse as unknown as ArchiveCourseUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
      deleteCourseDocument as unknown as DeleteCourseDocumentUseCase,
      uploadCoursePdfForCourse as unknown as UploadCoursePdfForCourseUseCase,
      getCourseRevisionSheet as unknown as GetCourseRevisionSheetUseCase,
      generateCourseRevisionSheet as unknown as GenerateCourseRevisionSheetUseCase,
      getCourseQuestionBankReadiness as unknown as GetCourseQuestionBankReadinessUseCase,
      prepareCourseQuestionBank as unknown as PrepareCourseQuestionBankUseCase,
      getCourseExamPreparationOptions as unknown as GetCourseExamPreparationOptionsUseCase,
      startCourseExamPreparationSession as unknown as StartCourseExamPreparationSessionUseCase,
      startCourseQuickRevisionSession as unknown as StartCourseQuickRevisionSessionUseCase,
      getResumableCourseRevisionSession as unknown as GetResumableCourseRevisionSessionUseCase,
      listCourseRevisionSessionHistory as unknown as ListCourseRevisionSessionHistoryUseCase,
      listCourseExamPreparationSessionHistory as unknown as ListCourseExamPreparationSessionHistoryUseCase,
      listCourseRichClosedExerciseHistory as unknown as ListCourseRichClosedExerciseHistoryUseCase,
      getCourseProgress as unknown as GetCourseProgressUseCase,
      getSubjectProgress as unknown as GetSubjectProgressUseCase,
      getCourseSourceLifecycle as unknown as GetCourseSourceLifecycleUseCase,
      archiveCourseSource as unknown as ArchiveCourseSourceUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    getCourseLifecycle,
    updateCourse,
    archiveCourse,
    deleteCourse,
    deleteCourseDocument,
    uploadCoursePdfForCourse,
    getCourseRevisionSheet,
    generateCourseRevisionSheet,
    getCourseQuestionBankReadiness,
    prepareCourseQuestionBank,
    getCourseExamPreparationOptions,
    startCourseExamPreparationSession,
    startCourseQuickRevisionSession,
    getResumableCourseRevisionSession,
    listCourseRevisionSessionHistory,
    listCourseExamPreparationSessionHistory,
    listCourseRichClosedExerciseHistory,
    getCourseProgress,
    getSubjectProgress,
    getCourseSourceLifecycle,
    archiveCourseSource,
  };
}

function questionBankReadiness(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    status: 'NOT_PREPARED',
    readyQuestionCount: 0,
    targetQuestionCount: 5,
    canStartQuickRevision: false,
    canPrepare: true,
    userMessage: 'Les questions doivent être préparées avant de commencer.',
    ...overrides,
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function publicCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function courseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    state: 'PRACTICED',
    ...overrides,
  };
}

function publicCourseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: '2026-06-18T12:00:00.000Z',
    state: 'PRACTICED',
    ...overrides,
  };
}

function sourceLifecycleDecision(overrides: Record<string, unknown> = {}) {
  return {
    documentId: 'document-1',
    courseId: 'course-1',
    status: 'ACTIVE',
    recommendedAction: 'ARCHIVE',
    canDelete: false,
    canArchive: true,
    blockingReasons: ['HAS_KNOWLEDGE_UNITS'],
    userMessage: 'Cette source peut etre archivee.',
    ...overrides,
  };
}

function subjectProgress(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    courses: [
      {
        courseId: 'course-1',
        title: 'Institutions',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
      },
    ],
    ...overrides,
  };
}

function publicSubjectProgress(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: '2026-06-18T12:00:00.000Z',
    courses: [
      {
        courseId: 'course-1',
        title: 'Institutions',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
      },
    ],
    ...overrides,
  };
}

function uploadedPdf() {
  return {
    originalname: 'cours.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
    size: 8,
  };
}

function courseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...overrides,
  };
}

function publicCourseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:00:00.000Z',
    ...overrides,
  };
}

function revisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    metadata: {
      flowName: 'documentRevisionSheetGeneration',
      provider: 'mock',
      model: 'mock-model',
      promptVersion: 'generate-revision-sheet-v1',
      schemaVersion: 'revision-sheet-v1',
      generatedAt: new Date('2026-06-18T10:00:00.000Z'),
      sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
            relevanceScore: 0.9,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function publicRevisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-18T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'activity-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'diagnostic_quiz',
        sessionId: 'activity-1',
      },
    },
    history: [],
  };
}

function examRevisionSessionResponse() {
  const response = revisionSessionResponse();

  return {
    ...response,
    session: {
      ...response.session,
      id: 'exam-session-1',
      mode: 'EXAM',
    },
  };
}

function revisionSessionHistory(mode = 'QUICK') {
  return {
    items: [
      {
        session: {
          id: 'revision-session-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          mode,
          status: 'COMPLETED',
          createdAt: new Date('2026-06-15T10:00:00.000Z'),
          completedAt: new Date('2026-06-15T10:04:12.000Z'),
        },
        summary: {
          correctAnswers: 4,
          totalQuestions: 6,
          score: 0.6666666667,
          durationSeconds: 252,
        },
        course: {
          id: 'course-1',
          title: 'Droit constitutionnel',
        },
      },
    ],
  };
}
