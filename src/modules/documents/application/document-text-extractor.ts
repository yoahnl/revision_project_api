export const DOCUMENT_TEXT_EXTRACTOR = Symbol('DOCUMENT_TEXT_EXTRACTOR');

export interface DocumentTextExtractor {
  extractText(input: {
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<string>;
}
