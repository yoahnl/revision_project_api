export interface DocumentProcessingQueue {
  enqueue(input: { documentId: string }): Promise<void>;
}

export const DOCUMENT_PROCESSING_QUEUE = Symbol('DOCUMENT_PROCESSING_QUEUE');
