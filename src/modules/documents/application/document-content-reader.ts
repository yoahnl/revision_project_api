export const DOCUMENT_CONTENT_READER = Symbol('DOCUMENT_CONTENT_READER');

export interface DocumentContentReader {
  read(input: { storagePath: string }): Promise<Buffer>;
}
