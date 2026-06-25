import { buildCourseQuestionBankPreparationPlan } from './course-question-bank-preparation-plan';

describe('buildCourseQuestionBankPreparationPlan', () => {
  it('budgets 10 questions across 7 empty knowledge units without targeting 35', () => {
    const plan = buildCourseQuestionBankPreparationPlan({
      sessionQuestionCount: 10,
      activeCourseQuestionCount: 0,
      activeCourseCap: 100,
      candidateKnowledgeUnits: knowledgeUnits(7),
    });

    expect(plan.poolTarget).toBe(10);
    expect(plan.missingForSession).toBe(10);
    expect(sumGeneratedQuestions(plan.jobs)).toBe(10);
    expect(plan.jobs.map((job) => job.targetQuestionCount)).toEqual([
      2, 2, 2, 1, 1, 1, 1,
    ]);
  });

  it('budgets 10 questions across 13 empty knowledge units without targeting 65', () => {
    const plan = buildCourseQuestionBankPreparationPlan({
      sessionQuestionCount: 10,
      activeCourseQuestionCount: 0,
      activeCourseCap: 100,
      candidateKnowledgeUnits: knowledgeUnits(13),
    });

    expect(sumGeneratedQuestions(plan.jobs)).toBe(10);
    expect(plan.jobs).toHaveLength(10);
    expect(plan.jobs.map((job) => job.targetQuestionCount)).toEqual(
      Array.from({ length: 10 }, () => 1),
    );
  });

  it('keeps a 30-question session close to 30 across 13 empty knowledge units', () => {
    const plan = buildCourseQuestionBankPreparationPlan({
      sessionQuestionCount: 30,
      activeCourseQuestionCount: 0,
      activeCourseCap: 100,
      candidateKnowledgeUnits: knowledgeUnits(13),
    });

    expect(sumGeneratedQuestions(plan.jobs)).toBe(30);
    expect(plan.jobs.map((job) => job.targetQuestionCount)).toEqual([
      3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    ]);
  });

  it('does not create jobs when the active pool already covers the session', () => {
    const plan = buildCourseQuestionBankPreparationPlan({
      sessionQuestionCount: 10,
      activeCourseQuestionCount: 12,
      activeCourseCap: 100,
      candidateKnowledgeUnits: knowledgeUnits(3),
    });

    expect(plan.missingForSession).toBe(0);
    expect(plan.jobs).toEqual([]);
  });

  it('creates jobs only for the real missing deficit on least-covered units', () => {
    const plan = buildCourseQuestionBankPreparationPlan({
      sessionQuestionCount: 10,
      activeCourseQuestionCount: 8,
      activeCourseCap: 100,
      candidateKnowledgeUnits: [
        knowledgeUnit(1, { activeQuestionCount: 4 }),
        knowledgeUnit(2, { activeQuestionCount: 0 }),
        knowledgeUnit(3, { activeQuestionCount: 4 }),
      ],
    });

    expect(plan.missingForSession).toBe(2);
    expect(sumGeneratedQuestions(plan.jobs)).toBe(2);
    expect(plan.jobs).toEqual([
      {
        knowledgeUnitId: 'ku-2',
        documentId: 'document-2',
        currentActiveQuestionCount: 0,
        targetQuestionCount: 2,
        questionsToGenerate: 2,
      },
    ]);
  });

  it('respects the remaining active course cap', () => {
    const plan = buildCourseQuestionBankPreparationPlan({
      sessionQuestionCount: 10,
      activeCourseQuestionCount: 8,
      activeCourseCap: 9,
      candidateKnowledgeUnits: knowledgeUnits(3),
    });

    expect(plan.missingForSession).toBe(1);
    expect(sumGeneratedQuestions(plan.jobs)).toBe(1);
  });
});

function knowledgeUnits(count: number) {
  return Array.from({ length: count }, (_, index) => knowledgeUnit(index + 1));
}

function knowledgeUnit(
  position: number,
  overrides: { activeQuestionCount?: number } = {},
) {
  return {
    knowledgeUnitId: `ku-${position}`,
    documentId: `document-${position}`,
    activeQuestionCount: overrides.activeQuestionCount ?? 0,
  };
}

function sumGeneratedQuestions(
  jobs: Array<{ questionsToGenerate: number }>,
): number {
  return jobs.reduce((sum, job) => sum + job.questionsToGenerate, 0);
}
