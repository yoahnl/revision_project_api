# QB-01 Evidence Pack - API

## Portee

Ce pack documente les preuves API du lot `QB-01`.

Fichiers API modifies ou crees :

- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_REPORT.md`
- `docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_EVIDENCE_PACK.md`
- `src/modules/activities/application/question-bank.repository.ts`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.service.spec.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.spec.ts`
- `src/modules/courses/application/course-question-bank-preparation-plan.ts`
- `src/modules/courses/application/course-question-bank-preparation-plan.spec.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.spec.ts`

Le patch complet local peut etre reconstruit avec :

```bash
git diff -- docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md docs/roadmap/v3.1/LOT_TRACKER_V3_1.md src/modules/activities/application/question-bank.repository.ts src/modules/activities/application/question-bank.service.ts src/modules/activities/application/question-bank.service.spec.ts src/modules/activities/infrastructure/prisma-question-bank.repository.ts src/modules/activities/infrastructure/prisma-question-bank.repository.spec.ts src/modules/courses/application/course-question-bank-readiness.use-case.ts src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts src/modules/courses/application/process-course-question-bank-preparation-job.use-case.spec.ts
git diff --no-index /dev/null docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_REPORT.md
git diff --no-index /dev/null docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_EVIDENCE_PACK.md
git diff --no-index /dev/null src/modules/courses/application/course-question-bank-preparation-plan.ts
git diff --no-index /dev/null src/modules/courses/application/course-question-bank-preparation-plan.spec.ts
```

## Nouveau planner pur

```ts
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

  if (
    missingForSession === 0 ||
    input.candidateKnowledgeUnits.length === 0
  ) {
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
      const leftTarget =
        left.activeQuestionCount + left.assignedQuestionCount;
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
```

## Tests de budget couverts

```text
7 notions, toutes a 0, session 10  => total 10, cibles 2/2/2/1/1/1/1
13 notions, toutes a 0, session 10 => total 10, 10 jobs a cible 1
13 notions, toutes a 0, session 30 => total 30
pool suffisant                     => aucun job
pool partiel                       => seulement le deficit
cap course-level                   => respecte le reliquat du cap
```

## Preuves anti-regression

- `QuestionBankService.prepareCourseQuickQuestionBank` accepte `questionCount: 4` comme target interne.
- `createCourseQuickDiagnosticQuiz` garde le validateur session 5..30.
- `ProcessCourseQuestionBankPreparationJobUseCase` accepte un job `targetQuestionCount: 4`.
- `PrismaQuestionBankRepository` expose un `groupBy` par `knowledgeUnitId` et retourne 0 pour les notions sans question.
- `PrepareCourseQuestionBankUseCase` ne cree aucun job quand `readyQuestionCount >= sessionQuestionCount`.

## Validations deja executees

```bash
npm run build
npm test -- course-question-bank-preparation-plan --runInBand
npm test -- course-question-bank-readiness --runInBand
npm test -- question-bank.service --runInBand
npm test -- prisma-question-bank.repository --runInBand
npm test -- process-course-question-bank-preparation-job --runInBand
```

Toutes ces commandes sont passees.
