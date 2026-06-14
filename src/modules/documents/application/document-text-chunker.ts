export const DOCUMENT_TEXT_CHUNKER = Symbol('DOCUMENT_TEXT_CHUNKER');

export interface DocumentTextChunk {
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
}

export interface DocumentTextChunker {
  chunk(input: { text: string }): DocumentTextChunk[];
}
