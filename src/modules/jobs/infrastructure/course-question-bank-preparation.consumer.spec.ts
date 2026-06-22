import { ProcessCourseQuestionBankPreparationJobUseCase } from '../../courses/application/process-course-question-bank-preparation-job.use-case';
import { CourseQuestionBankPreparationConsumer } from './course-question-bank-preparation.consumer';

describe('CourseQuestionBankPreparationConsumer', () => {
  it('delegates valid BullMQ payloads to the preparation use case', async () => {
    const processPreparationJob = {
      execute: jest.fn().mockResolvedValue({ processed: true }),
    } as unknown as jest.Mocked<ProcessCourseQuestionBankPreparationJobUseCase>;
    const consumer = new CourseQuestionBankPreparationConsumer(
      processPreparationJob,
    );

    await consumer.process({ data: { preparationJobId: 'prep-1' } } as never);

    expect(processPreparationJob.execute.mock.calls[0]?.[0]).toEqual({
      preparationJobId: 'prep-1',
    });
  });

  it('rejects invalid BullMQ payloads', async () => {
    const processPreparationJob = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ProcessCourseQuestionBankPreparationJobUseCase>;
    const consumer = new CourseQuestionBankPreparationConsumer(
      processPreparationJob,
    );

    await expect(
      consumer.process({ data: { preparationJobId: '' } } as never),
    ).rejects.toThrow(
      'Question bank preparation job requires preparationJobId',
    );

    expect(processPreparationJob.execute.mock.calls).toHaveLength(0);
  });
});
