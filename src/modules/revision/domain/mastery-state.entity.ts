import { StudentId } from '../../../shared/domain/student-id';

export class MasteryState {
  readonly studentId: StudentId;
  readonly knowledgeUnitId: string;
  readonly score: number;
  readonly lastPracticedAt: Date | null;

  constructor(input: {
    studentId: StudentId;
    knowledgeUnitId: string;
    score: number;
    lastPracticedAt: Date | null;
  }) {
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 1) {
      throw new Error('Mastery score must be between 0 and 1');
    }

    this.studentId = input.studentId;
    this.knowledgeUnitId = input.knowledgeUnitId;
    this.score = input.score;
    this.lastPracticedAt = input.lastPracticedAt;
  }

  applyQuizResult(
    correctAnswers: number,
    totalQuestions: number,
    practicedAt: Date,
  ): MasteryState {
    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      throw new Error('Quiz result must include at least one question');
    }
    if (
      !Number.isInteger(correctAnswers) ||
      correctAnswers < 0 ||
      correctAnswers > totalQuestions
    ) {
      throw new Error('Correct answers must be between 0 and total questions');
    }

    const ratio = correctAnswers / totalQuestions;
    const nextScore = Math.max(
      0,
      Math.min(1, this.score * 0.65 + ratio * 0.35),
    );

    return new MasteryState({
      studentId: this.studentId,
      knowledgeUnitId: this.knowledgeUnitId,
      score: Number(nextScore.toFixed(3)),
      lastPracticedAt: practicedAt,
    });
  }

  applyOpenAnswerRatio(ratio: number, practicedAt: Date): MasteryState {
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
      throw new Error('Open answer ratio must be between 0 and 1');
    }

    const nextScore = Math.max(
      0,
      Math.min(1, this.score * 0.65 + ratio * 0.35),
    );

    return new MasteryState({
      studentId: this.studentId,
      knowledgeUnitId: this.knowledgeUnitId,
      score: Number(nextScore.toFixed(3)),
      lastPracticedAt: practicedAt,
    });
  }
}
