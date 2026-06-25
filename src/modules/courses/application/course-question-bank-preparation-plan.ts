export interface CourseQuestionBankPreparationPlanCandidate {
  knowledgeUnitId: string;
  documentId: string;
  activeQuestionCount: number;
}

export interface CourseQuestionBankPreparationPlanJob {
  knowledgeUnitId: string;
  documentId: string;
  currentActiveQuestionCount: number;
  targetQuestionCount: number;
  questionsToGenerate: number;
}

export interface CourseQuestionBankPreparationPlan {
  sessionQuestionCount: number;
  poolTarget: number;
  activeCourseQuestionCount: number;
  missingForSession: number;
  jobs: CourseQuestionBankPreparationPlanJob[];
}

export function buildCourseQuestionBankPreparationPlan(input: {
  sessionQuestionCount: number;
  activeCourseQuestionCount: number;
  candidateKnowledgeUnits: CourseQuestionBankPreparationPlanCandidate[];
  activeCourseCap: number;
}): CourseQuestionBankPreparationPlan {
  const sessionQuestionCount = Math.max(0, input.sessionQuestionCount);
  const activeCourseQuestionCount = Math.max(
    0,
    input.activeCourseQuestionCount,
  );
  const activeCourseCap = Math.max(0, input.activeCourseCap);
  const poolTarget = Math.min(sessionQuestionCount, activeCourseCap);
  const missingForSession = Math.max(
    0,
    Math.min(
      poolTarget - activeCourseQuestionCount,
      activeCourseCap - activeCourseQuestionCount,
    ),
  );

  if (missingForSession === 0 || input.candidateKnowledgeUnits.length === 0) {
    return {
      sessionQuestionCount,
      poolTarget,
      activeCourseQuestionCount,
      missingForSession,
      jobs: [],
    };
  }

  const candidates = input.candidateKnowledgeUnits.map((candidate, index) => ({
    ...candidate,
    activeQuestionCount: Math.max(0, candidate.activeQuestionCount),
    assignedQuestionCount: 0,
    index,
  }));

  for (let remaining = missingForSession; remaining > 0; remaining -= 1) {
    const [candidate] = [...candidates].sort((left, right) => {
      const leftTarget = left.activeQuestionCount + left.assignedQuestionCount;
      const rightTarget =
        right.activeQuestionCount + right.assignedQuestionCount;

      return leftTarget - rightTarget || left.index - right.index;
    });

    candidate.assignedQuestionCount += 1;
  }

  return {
    sessionQuestionCount,
    poolTarget,
    activeCourseQuestionCount,
    missingForSession,
    jobs: candidates
      .filter((candidate) => candidate.assignedQuestionCount > 0)
      .map((candidate) => ({
        knowledgeUnitId: candidate.knowledgeUnitId,
        documentId: candidate.documentId,
        currentActiveQuestionCount: candidate.activeQuestionCount,
        targetQuestionCount:
          candidate.activeQuestionCount + candidate.assignedQuestionCount,
        questionsToGenerate: candidate.assignedQuestionCount,
      })),
  };
}
