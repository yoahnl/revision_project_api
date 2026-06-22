import { BullMqDocumentFileCleanupQueue } from './bullmq-document-file-cleanup.queue';

describe('BullMqDocumentFileCleanupQueue', () => {
  it('adds cleanup-document-file jobs with stable retention options', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add };

    await new BullMqDocumentFileCleanupQueue(queue as never).enqueue({
      cleanupJobId: 'cleanup-1',
    });

    expect(add).toHaveBeenCalledWith(
      'cleanup-document-file',
      { cleanupJobId: 'cleanup-1' },
      {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: 'cleanup-1',
        removeOnComplete: 100,
        removeOnFail: 250,
      },
    );
  });
});
