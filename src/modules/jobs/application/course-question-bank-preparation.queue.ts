export const COURSE_QUESTION_BANK_PREPARATION_QUEUE = Symbol(
  'COURSE_QUESTION_BANK_PREPARATION_QUEUE',
);

export interface CourseQuestionBankPreparationQueue {
  enqueue(input: { preparationJobId: string }): Promise<void>;
}
