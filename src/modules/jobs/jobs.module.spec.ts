import { Test } from '@nestjs/testing';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from './application/document-processing.queue';
import { JobsModule } from './jobs.module';

describe('JobsModule', () => {
  it('uses an in-process document queue provider during tests', async () => {
    const module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const queue = module.get<DocumentProcessingQueue>(
      DOCUMENT_PROCESSING_QUEUE,
    );

    await expect(
      queue.enqueue({ documentId: 'document-1' }),
    ).resolves.toBeUndefined();

    await module.close();
  });
});
