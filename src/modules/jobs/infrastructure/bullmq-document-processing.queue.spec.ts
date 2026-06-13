import { BullMqDocumentProcessingQueue } from './bullmq-document-processing.queue';

describe('BullMqDocumentProcessingQueue', () => {
  it('adds process-document jobs with stable retention options', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add };

    await new BullMqDocumentProcessingQueue(queue as never).enqueue({
      documentId: 'document-1',
    });

    expect(add).toHaveBeenCalledWith(
      'process-document',
      { documentId: 'document-1' },
      {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: 'document-1',
        removeOnComplete: 100,
        removeOnFail: 250,
      },
    );
  });
});
