export interface ActivityQuestionChoice {
  id: string;
  label: string;
}

export interface ActivityQuestion {
  id: string;
  prompt: string;
  choices: ActivityQuestionChoice[];
}

export interface DiagnosticQuizActivity {
  sessionId: string;
  type: 'diagnostic_quiz';
  title: string;
  questions: ActivityQuestion[];
}

export const ACTIVITIES_REPOSITORY = Symbol('ACTIVITIES_REPOSITORY');

export interface ActivitiesRepository {
  createDiagnosticQuiz(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<DiagnosticQuizActivity>;

  submitResult(input: {
    studentId: string;
    sessionId: string;
    answers: Array<{ questionId: string; choiceId: string }>;
  }): Promise<{
    correctAnswers: number;
    totalQuestions: number;
    knowledgeUnitId: string;
  }>;
}
