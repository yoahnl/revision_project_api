import { Job } from 'bullmq';
import type { ProcessDocumentFileCleanupJobUseCase } from '../../documents/application/process-document-file-cleanup.use-case';
import { DocumentFileCleanupConsumer } from './document-file-cleanup.consumer';

describe('DocumentFileCleanupConsumer', () => {
  it('rejects jobs without a non-empty cleanupJobId', async () => {
    const processCleanup = createProcessCleanup();
    const consumer = new DocumentFileCleanupConsumer(processCleanup.service);
    const invalidJobs = [
      { data: null },
      { data: {} },
      { data: { cleanupJobId: null } },
      { data: { cleanupJobId: 42 } },
      { data: { cleanupJobId: '' } },
      { data: { cleanupJobId: '   ' } },
    ];

    for (const job of invalidJobs) {
      await expect(
        consumer.process(job as Job<{ cleanupJobId: string }>),
      ).rejects.toThrow('Document file cleanup job requires cleanupJobId');
    }

    expect(processCleanup.execute).not.toHaveBeenCalled();
  });

  it('processes a cleanup job through the application use case', async () => {
    const processCleanup = createProcessCleanup();
    const consumer = new DocumentFileCleanupConsumer(processCleanup.service);

    await consumer.process({
      data: { cleanupJobId: 'cleanup-1' },
    } as Job<{ cleanupJobId: string }>);

    expect(processCleanup.execute).toHaveBeenCalledWith({
      cleanupJobId: 'cleanup-1',
    });
  });
});

function createProcessCleanup() {
  const execute = jest.fn().mockResolvedValue({
    processed: true,
    cleanupJobId: 'cleanup-1',
  });

  return {
    execute,
    service: {
      execute,
    } as unknown as ProcessDocumentFileCleanupJobUseCase,
  };
}
