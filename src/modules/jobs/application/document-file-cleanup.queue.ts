export const DOCUMENT_FILE_CLEANUP_QUEUE = Symbol(
  'DOCUMENT_FILE_CLEANUP_QUEUE',
);

export interface DocumentFileCleanupQueue {
  enqueue(input: { cleanupJobId: string }): Promise<void>;
}
