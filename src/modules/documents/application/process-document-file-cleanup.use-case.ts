import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENT_FILE_CLEANUP_REPOSITORY,
  type DocumentFileCleanupRepository,
} from './document-file-cleanup.repository';
import {
  DOCUMENT_FILE_STORAGE,
  type DocumentFileStorage,
} from './document-file-storage';

const DEFAULT_CLEANUP_MAX_ATTEMPTS = 3;
const DEFAULT_CLEANUP_BATCH_LIMIT = 10;

@Injectable()
export class ProcessDocumentFileCleanupJobUseCase {
  constructor(
    @Inject(DOCUMENT_FILE_CLEANUP_REPOSITORY)
    private readonly cleanupRepository: DocumentFileCleanupRepository,
    @Inject(DOCUMENT_FILE_STORAGE)
    private readonly storage: Pick<DocumentFileStorage, 'delete'>,
  ) {}

  async execute(input: {
    cleanupJobId?: string;
    maxAttempts?: number;
  }): Promise<{ processed: boolean; cleanupJobId: string | null }> {
    const maxAttempts = input.maxAttempts ?? DEFAULT_CLEANUP_MAX_ATTEMPTS;
    const job = await this.cleanupRepository.claimNextPending({
      cleanupJobId: input.cleanupJobId,
      maxAttempts,
    });

    if (!job) {
      return {
        processed: false,
        cleanupJobId: input.cleanupJobId ?? null,
      };
    }

    try {
      await this.storage.delete({ storagePath: job.storagePath });
      await this.cleanupRepository.markCompleted({ cleanupJobId: job.id });

      return { processed: true, cleanupJobId: job.id };
    } catch (error) {
      await this.cleanupRepository.markFailed({
        cleanupJobId: job.id,
        error,
        maxAttempts,
      });
      throw error;
    }
  }
}

@Injectable()
export class ProcessPendingDocumentFileCleanupJobsUseCase {
  constructor(
    private readonly processCleanupJob: ProcessDocumentFileCleanupJobUseCase,
  ) {}

  async execute(
    input: { limit?: number } = {},
  ): Promise<{ processed: number }> {
    const limit = input.limit ?? DEFAULT_CLEANUP_BATCH_LIMIT;
    let processed = 0;

    for (let index = 0; index < limit; index += 1) {
      const result = await this.processCleanupJob.execute({});

      if (!result.processed) {
        break;
      }

      processed += 1;
    }

    return { processed };
  }
}
