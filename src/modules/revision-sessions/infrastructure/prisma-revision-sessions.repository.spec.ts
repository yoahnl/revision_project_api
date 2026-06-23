import { PrismaRevisionSessionsRepository } from './prisma-revision-sessions.repository';

describe('PrismaRevisionSessionsRepository', () => {
  it('validates subject, document and knowledge unit ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findFirst.mockResolvedValue({ id: 'document-1' });
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      documentId: 'document-1',
      title: 'Notion 1',
    });

    await expect(
      repository.ensureStartContext({
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).resolves.toEqual({
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnitTitle: 'Notion 1',
    });
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-1', studentId: 'student-1' },
      select: { id: true },
    });
  });

  it('rejects cross-student context as not found', async () => {
    const { repository } = createRepository();

    await expect(
      repository.ensureStartContext({
        studentId: 'student-2',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('Revision subject not found');
  });

  it('persists a session and initial action in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(actionRecord());

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        status: 'STARTED',
        mode: 'QUICK',
      },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.history).toHaveLength(1);
    expect(result.currentAction?.kind).toBe('OPEN_QUESTION');
    expect(result.session.courseId).toBeNull();
    expect(result.session.mode).toBe('QUICK');
  });

  it('persists the courseId for course-level quick sessions', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(
      revisionSessionRecord({ courseId: 'course-1' }),
    );
    prisma.revisionSessionAction.create.mockResolvedValue(actionRecord());

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSession.create.mock.calls).toMatchObject([
      [
        {
          data: {
            courseId: 'course-1',
            mode: 'QUICK',
          },
        },
      ],
    ]);
    expect(result.session.courseId).toBe('course-1');
  });

  it('persists a rich closed session action without activity session id', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(
      actionRecord({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
      }),
    );

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(result.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
  });

  it('loads an owned session with sorted action history', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [actionRecord()],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        draftAnswers: {
          orderBy: { updatedAt: 'asc' },
          select: {
            questionId: true,
            selectedChoiceIds: true,
            updatedAt: true,
          },
        },
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: {
                id: true,
                subjectId: true,
                documentId: true,
                knowledgeUnitId: true,
                type: true,
                version: true,
                questions: {
                  orderBy: { displayOrder: 'asc' },
                  select: {
                    id: true,
                    knowledgeUnitId: true,
                    prompt: true,
                    difficulty: true,
                    displayOrder: true,
                    choices: true,
                    selectionMode: true,
                    minSelections: true,
                    maxSelections: true,
                    sources: {
                      include: {
                        chunk: {
                          select: {
                            pageNumber: true,
                            index: true,
                          },
                        },
                      },
                    },
                    visuals: {
                      orderBy: { displayOrder: 'asc' },
                      select: {
                        id: true,
                        type: true,
                        displayOrder: true,
                        payload: true,
                        sources: {
                          include: {
                            chunk: {
                              select: {
                                pageNumber: true,
                                index: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(result.currentAction?.payload).toEqual({
      type: 'open_question',
      sessionId: 'activity-session-1',
    });
  });

  it('preserves public diagnostic visuals when loading a quick revision session', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      actions: [
        actionRecord({
          kind: 'DIAGNOSTIC_QUIZ',
          activitySession: {
            id: 'activity-session-1',
            subjectId: 'subject-1',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
            type: 'DIAGNOSTIC_QUIZ',
            version: 3,
            questions: [
              diagnosticQuestionRecord({
                visuals: [
                  {
                    id: 'visual-1',
                    type: 'CHART',
                    displayOrder: 0,
                    payload: {
                      chartType: 'bar',
                      title: 'Répartition des pouvoirs',
                      data: [{ label: 'Exécutif', value: 2 }],
                    },
                    sources: [
                      {
                        chunkId: 'chunk-1',
                        chunk: { pageNumber: 4, index: 2 },
                      },
                    ],
                  },
                ],
              }),
            ],
          },
        }),
      ],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    const payload = result.currentAction?.payload as {
      questions: Array<{ visuals?: unknown[] }>;
    };
    const serializedPayload = JSON.stringify(payload);

    expect(payload.questions[0]?.visuals).toEqual([
      {
        id: 'visual-1',
        type: 'CHART',
        displayOrder: 0,
        chartType: 'bar',
        title: 'Répartition des pouvoirs',
        data: [{ label: 'Exécutif', value: 2 }],
        sources: [{ chunkId: 'chunk-1', pageNumber: 4, index: 2 }],
      },
    ]);
    expect(serializedPayload).not.toContain('correctChoiceId');
    expect(serializedPayload).not.toContain('storagePath');
    expect(serializedPayload).not.toContain('promptVersion');
    expect(serializedPayload).not.toContain('provider');
  });

  it('loads draft answers with a resumable quick revision session', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      draftAnswers: [
        {
          questionId: 'question-1',
          selectedChoiceIds: ['choice-1'],
          updatedAt: new Date('2026-06-15T10:02:00.000Z'),
        },
      ],
      actions: [
        diagnosticActionRecord({
          activitySession: {
            id: 'activity-session-1',
            subjectId: 'subject-1',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
            type: 'DIAGNOSTIC_QUIZ',
            version: 3,
            questions: [diagnosticQuestionRecord()],
          },
        }),
      ],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(result.draftAnswers).toEqual([
      {
        questionId: 'question-1',
        selectedChoiceIds: ['choice-1'],
        updatedAt: new Date('2026-06-15T10:02:00.000Z'),
      },
    ]);
  });

  it('finds the latest resumable course session with draft progress', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      draftAnswers: [
        {
          questionId: 'question-1',
          selectedChoiceIds: ['choice-1'],
          updatedAt: new Date('2026-06-15T10:02:00.000Z'),
        },
      ],
      actions: [
        diagnosticActionRecord({
          activitySession: {
            questions: [{ id: 'question-1' }, { id: 'question-2' }],
          },
        }),
      ],
    });

    const result = await repository.findResumableCourseSessionForStudent({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        status: 'STARTED',
        completedAt: null,
        course: {
          archivedAt: null,
          subject: {
            archivedAt: null,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        draftAnswers: {
          select: {
            questionId: true,
            selectedChoiceIds: true,
            updatedAt: true,
          },
        },
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: {
                questions: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    expect(result?.session.id).toBe('revision-session-1');
    expect(result?.progress).toEqual({
      answeredQuestionCount: 1,
      totalQuestionCount: 2,
    });
  });

  it('saves a valid diagnostic draft answer for the current session question', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst
      .mockResolvedValueOnce({
        ...revisionSessionRecord({ courseId: 'course-1' }),
        actions: [diagnosticActionRecord()],
      })
      .mockResolvedValueOnce({
        ...revisionSessionRecord({ courseId: 'course-1' }),
        draftAnswers: [
          {
            questionId: 'question-1',
            selectedChoiceIds: ['choice-1'],
            updatedAt: new Date('2026-06-15T10:03:00.000Z'),
          },
        ],
        actions: [
          diagnosticActionRecord({
            activitySession: {
              id: 'activity-session-1',
              subjectId: 'subject-1',
              documentId: 'document-1',
              knowledgeUnitId: 'unit-1',
              type: 'DIAGNOSTIC_QUIZ',
              version: 3,
              questions: [diagnosticQuestionRecord()],
            },
          }),
        ],
      });
    prisma.question.findFirst.mockResolvedValue(diagnosticQuestionRecord());

    const result = await repository.saveDraftAnswer({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      questionId: 'question-1',
      selectedChoiceIds: ['choice-1'],
    });

    expect(prisma.question.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'question-1',
        sessionId: 'activity-session-1',
      },
      select: {
        id: true,
        choices: true,
        selectionMode: true,
        maxSelections: true,
      },
    });
    expect(prisma.revisionQuestionDraftAnswer.upsert).toHaveBeenCalledWith({
      where: {
        studentId_sessionId_questionId: {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          questionId: 'question-1',
        },
      },
      create: {
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        activitySessionId: 'activity-session-1',
        questionId: 'question-1',
        selectedChoiceIds: ['choice-1'],
      },
      update: {
        activitySessionId: 'activity-session-1',
        selectedChoiceIds: ['choice-1'],
      },
    });
    expect(result.draftAnswers).toHaveLength(1);
  });

  it('rejects draft choices that do not belong to the question', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      actions: [diagnosticActionRecord()],
    });
    prisma.question.findFirst.mockResolvedValue(diagnosticQuestionRecord());

    await expect(
      repository.saveDraftAnswer({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        questionId: 'question-1',
        selectedChoiceIds: ['choice-outside'],
      }),
    ).rejects.toThrow('Revision session draft answer choice invalid');
    expect(prisma.revisionQuestionDraftAnswer.upsert).not.toHaveBeenCalled();
  });

  it('loads a planning context with action activity knowledge units and candidates', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [
        {
          ...actionRecord(),
          knowledgeUnitId: null,
          activitySession: { knowledgeUnitId: 'unit-from-activity' },
        },
      ],
    });
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);

    const result = await repository.findPlanningContextByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1' },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });
    expect(result.actions[0]?.knowledgeUnitId).toBe('unit-from-activity');
    expect(result.allowedKnowledgeUnitIds).toEqual([
      'unit-1',
      'unit-from-activity',
    ]);
    expect(result.allowedKnowledgeUnits).toEqual([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);
  });

  it('limits planning candidates to READY course documents for course sessions', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      actions: [],
    });
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      { id: 'unit-course-1', documentId: 'document-1', title: 'Notion 1' },
    ]);

    const result = await repository.findPlanningContextByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1' },
        document: {
          studentId: 'student-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });
    expect(result.allowedKnowledgeUnitIds).toEqual(['unit-course-1']);
  });

  it('appends an action with the next display order inside a transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst
      .mockResolvedValueOnce(revisionSessionRecord())
      .mockResolvedValueOnce({
        ...revisionSessionRecord(),
        actions: [
          actionRecord(),
          { ...actionRecord(), id: 'action-2', displayOrder: 1 },
        ],
      });
    prisma.revisionSessionAction.aggregate.mockResolvedValue({
      _max: { displayOrder: 0 },
    });
    prisma.revisionSessionAction.create.mockResolvedValue({
      ...actionRecord(),
      id: 'action-2',
      displayOrder: 1,
      activitySessionId: 'quiz-session-2',
      kind: 'DIAGNOSTIC_QUIZ',
      documentId: null,
      knowledgeUnitId: null,
    });

    const result = await repository.appendAction({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      action: {
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });

    expect(prisma.revisionSessionAction.aggregate).toHaveBeenCalledWith({
      where: { sessionId: 'revision-session-1' },
      _max: { displayOrder: true },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 1,
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });
    expect(result.history).toHaveLength(2);
    expect(result.currentAction?.displayOrder).toBe(1);
  });

  it('refuses to append an action to a course-level quick session', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({ courseId: 'course-1', mode: 'QUICK' }),
    );

    await expect(
      repository.appendAction({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        action: {
          kind: 'DIAGNOSTIC_QUIZ',
          status: 'READY',
          activitySessionId: 'quiz-session-2',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    ).rejects.toThrow(
      'Quick course revision sessions do not support next actions',
    );

    expect(prisma.revisionSessionAction.aggregate).not.toHaveBeenCalled();
    expect(prisma.revisionSessionAction.create).not.toHaveBeenCalled();
  });

  it('completes a submitted quick diagnostic session and returns the backend result', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({
        result: {
          correctAnswers: 3,
          totalQuestions: 4,
          score: 0.75,
        },
        answers: [
          answerRecord({ knowledgeUnitId: 'unit-a', title: 'Unit A' }),
          answerRecord({
            knowledgeUnitId: 'unit-a',
            title: 'Unit A',
            isCorrect: false,
          }),
          answerRecord({ knowledgeUnitId: 'unit-b', title: 'Unit B' }),
        ],
      }),
    );

    const result = await repository.completeQuickSession({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      completedAt,
    });

    expect(prisma.revisionSessionAction.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: { status: 'COMPLETED', completedAt },
    });
    expect(prisma.revisionSession.update).toHaveBeenCalledWith({
      where: { id: 'revision-session-1' },
      data: { status: 'COMPLETED', completedAt },
    });
    expect(result.summary).toEqual({
      correctAnswers: 3,
      totalQuestions: 4,
      score: 0.75,
      durationSeconds: 300,
    });
    expect(result.knowledgeUnits).toEqual([
      {
        knowledgeUnitId: 'unit-a',
        title: 'Unit A',
        correctAnswers: 1,
        totalQuestions: 2,
        score: 0.5,
        state: 'TO_REVIEW',
      },
      {
        knowledgeUnitId: 'unit-b',
        title: 'Unit B',
        correctAnswers: 1,
        totalQuestions: 1,
        score: 1,
        state: 'MASTERED',
      },
    ]);
  });

  it('keeps quick completion idempotent for an already completed session', async () => {
    const { prisma, repository } = createRepository();
    const existingCompletedAt = new Date('2026-06-15T10:03:00.000Z');
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt: existingCompletedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt: existingCompletedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord(),
    );

    const result = await repository.completeQuickSession({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      completedAt: new Date('2026-06-15T10:05:00.000Z'),
    });

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
    expect(result.session.completedAt).toBe(existingCompletedAt);
  });

  it('refuses to complete a quick session when the diagnostic activity is not submitted', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({ status: 'STARTED' }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session activity not submitted');

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
  });

  it('refuses to complete a quick session without an activity result', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({ result: null }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session result not found');

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
  });

  it('refuses to complete when the current action is not a diagnostic quiz', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [actionRecord({ kind: 'OPEN_QUESTION' })],
      }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session not ready to complete');

    expect(prisma.activitySession.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to complete unsupported revision session modes', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        mode: 'DEEP',
        actions: [diagnosticActionRecord()],
      }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session completion unsupported');
  });

  it('returns not found when completing a session outside the student ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(null);

    await expect(
      repository.completeQuickSession({
        studentId: 'student-2',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session not found');
  });

  it('loads a completed result without mutating the session', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({
        result: {
          correctAnswers: 3,
          totalQuestions: 5,
          score: null,
        },
        answers: [
          answerRecord({ knowledgeUnitId: 'unit-a', title: 'Unit A' }),
          answerRecord({ knowledgeUnitId: 'unit-a', title: 'Unit A' }),
          answerRecord({
            knowledgeUnitId: 'unit-b',
            title: 'Unit B',
            isCorrect: false,
          }),
        ],
      }),
    );

    const result = await repository.findResultByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
    expect(result.summary.score).toBe(0.6);
    expect(result.knowledgeUnits).toEqual([
      {
        knowledgeUnitId: 'unit-a',
        title: 'Unit A',
        correctAnswers: 2,
        totalQuestions: 2,
        score: 1,
        state: 'MASTERED',
      },
      {
        knowledgeUnitId: 'unit-b',
        title: 'Unit B',
        correctAnswers: 0,
        totalQuestions: 1,
        score: 0,
        state: 'TO_REVIEW',
      },
    ]);
    expect(result.corrections).toEqual([
      expect.objectContaining({
        prompt: 'Quel principe organise les pouvoirs ?',
        isCorrect: true,
        selectedAnswers: ['La séparation des pouvoirs'],
        correctAnswers: ['La séparation des pouvoirs'],
      }),
      expect.objectContaining({
        prompt: 'Quel principe organise les pouvoirs ?',
        isCorrect: true,
        selectedAnswers: ['La séparation des pouvoirs'],
        correctAnswers: ['La séparation des pouvoirs'],
      }),
      expect.objectContaining({
        prompt: 'Quel principe organise les pouvoirs ?',
        isCorrect: false,
        selectedAnswers: ['Le mandat impératif'],
        correctAnswers: ['La séparation des pouvoirs'],
        explanation: 'La Constitution organise la séparation des pouvoirs.',
      }),
    ]);
  });

  it('refuses to load a result for an incomplete session', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );

    await expect(
      repository.findResultByIdForStudent({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('Revision session not completed');

    expect(prisma.activitySession.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to load a completed result when the activity result is missing', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({ result: null }),
    );

    await expect(
      repository.findResultByIdForStudent({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('Revision session result not found');
  });

  it('clamps stored result scores when loading a completed result', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({
        result: {
          correctAnswers: 0,
          totalQuestions: 0,
          score: 1.5,
        },
        answers: [],
      }),
    );

    const result = await repository.findResultByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(result.summary.score).toBe(1);
    expect(result.summary.durationSeconds).toBe(300);
    expect(result.knowledgeUnits).toEqual([]);
  });
});

type PrismaRevisionSessionsMock = ReturnType<typeof createPrismaMock>;
type TransactionCallback = (tx: PrismaRevisionSessionsMock) => Promise<unknown>;

function createRepository() {
  const prisma = createPrismaMock();

  return {
    prisma,
    repository: new PrismaRevisionSessionsRepository(prisma as never),
  };
}

function createPrismaMock() {
  return {
    subject: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    knowledgeUnit: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    revisionSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    revisionSessionAction: {
      create: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn(),
    },
    activitySession: {
      findFirst: jest.fn(),
    },
    question: {
      findFirst: jest.fn(),
    },
    revisionQuestionDraftAnswer: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function revisionSessionRecord(
  overrides: Partial<ReturnType<typeof revisionSessionRecordShape>> = {},
) {
  return { ...revisionSessionRecordShape(), ...overrides };
}

function revisionSessionRecordShape() {
  return {
    id: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    mode: 'QUICK',
    status: 'STARTED',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    updatedAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}

function actionRecord(
  overrides: Partial<ReturnType<typeof actionRecordShape>> = {},
) {
  return { ...actionRecordShape(), ...overrides };
}

function actionRecordShape() {
  return {
    id: 'action-1',
    sessionId: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    kind: 'OPEN_QUESTION',
    status: 'READY',
    displayOrder: 0,
    activitySessionId: 'activity-session-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}

function diagnosticActionRecord(
  overrides: Partial<ReturnType<typeof actionRecordShape>> = {},
) {
  return actionRecord({
    kind: 'DIAGNOSTIC_QUIZ',
    activitySessionId: 'activity-session-1',
    ...overrides,
  });
}

function diagnosticQuestionRecord(
  overrides: Partial<ReturnType<typeof diagnosticQuestionRecordShape>> = {},
) {
  return { ...diagnosticQuestionRecordShape(), ...overrides };
}

function diagnosticQuestionRecordShape() {
  return {
    id: 'question-1',
    knowledgeUnitId: 'unit-1',
    prompt: 'Quel principe organise les pouvoirs ?',
    difficulty: 'MEDIUM' as const,
    displayOrder: 0,
    choices: [
      { id: 'choice-1', label: 'La séparation des pouvoirs' },
      { id: 'choice-2', label: 'Le mandat impératif' },
    ],
    selectionMode: 'SINGLE' as const,
    minSelections: null,
    maxSelections: null,
    sources: [],
    visuals: [],
  };
}

function diagnosticActivityRecord(
  overrides: Partial<ReturnType<typeof diagnosticActivityRecordShape>> = {},
) {
  return { ...diagnosticActivityRecordShape(), ...overrides };
}

function diagnosticActivityRecordShape() {
  return {
    id: 'activity-session-1',
    studentId: 'student-1',
    status: 'COMPLETED',
    type: 'DIAGNOSTIC_QUIZ',
    result: {
      correctAnswers: 1,
      totalQuestions: 1,
      score: 1,
    },
    answers: [answerRecord()],
  };
}

function answerRecord(
  overrides: {
    knowledgeUnitId?: string;
    title?: string;
    isCorrect?: boolean;
    selectedChoiceId?: string;
  } = {},
) {
  return {
    isCorrect: overrides.isCorrect ?? true,
    selectedChoiceId:
      overrides.selectedChoiceId ??
      (overrides.isCorrect === false ? 'choice-2' : 'choice-1'),
    selectedChoices: [],
    question: {
      prompt: 'Quel principe organise les pouvoirs ?',
      choices: [
        { id: 'choice-1', label: 'La séparation des pouvoirs' },
        { id: 'choice-2', label: 'Le mandat impératif' },
      ],
      correctChoiceId: 'choice-1',
      correctChoiceIds: null,
      explanation: 'La Constitution organise la séparation des pouvoirs.',
      knowledgeUnitId: overrides.knowledgeUnitId ?? 'unit-1',
      knowledgeUnit: {
        title: overrides.title ?? 'Notion 1',
      },
    },
  };
}
