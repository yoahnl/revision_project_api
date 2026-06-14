import { Injectable } from '@nestjs/common';
import type {
  DocumentTextChunk,
  DocumentTextChunker,
} from '../application/document-text-chunker';

type ChunkerOptions = {
  targetSize: number;
  maxSize: number;
  overlap: number;
};

const DEFAULT_OPTIONS: ChunkerOptions = {
  targetSize: 1_800,
  maxSize: 2_400,
  overlap: 180,
};

@Injectable()
export class DeterministicDocumentTextChunker implements DocumentTextChunker {
  private readonly options: ChunkerOptions;

  constructor(options: Partial<ChunkerOptions> = {}) {
    this.options = normalizeOptions(options);
  }

  chunk(input: { text: string }): DocumentTextChunk[] {
    const source = input.text;
    const firstContentIndex = source.search(/\S/);

    if (firstContentIndex === -1) {
      return [];
    }

    const trailingWhitespace = source.match(/\s*$/)?.[0].length ?? 0;
    const sourceEnd = source.length - trailingWhitespace;
    const text = source.slice(firstContentIndex, sourceEnd);
    const chunks: DocumentTextChunk[] = [];
    let relativeStart = 0;

    while (relativeStart < text.length) {
      const relativeEnd = this.resolveChunkEnd(text, relativeStart);
      const rawChunk = text.slice(relativeStart, relativeEnd);
      const leadingWhitespace = rawChunk.search(/\S/);

      if (leadingWhitespace !== -1) {
        const trailing = rawChunk.match(/\s*$/)?.[0].length ?? 0;
        const chunkText = rawChunk.trim();

        if (chunkText.length > 0) {
          chunks.push({
            index: chunks.length,
            text: chunkText,
            charStart: firstContentIndex + relativeStart + leadingWhitespace,
            charEnd: firstContentIndex + relativeEnd - trailing,
            pageNumber: null,
          });
        }
      }

      if (relativeEnd >= text.length) {
        break;
      }

      const nextStart = Math.max(
        relativeEnd - this.options.overlap,
        relativeStart + 1,
      );
      relativeStart = skipLeadingWhitespace(text, nextStart);
    }

    return chunks;
  }

  private resolveChunkEnd(text: string, relativeStart: number): number {
    const remainingLength = text.length - relativeStart;

    if (remainingLength <= this.options.maxSize) {
      return text.length;
    }

    const targetEnd = relativeStart + this.options.targetSize;
    const maxEnd = relativeStart + this.options.maxSize;
    const boundary = findBoundary(text, targetEnd, maxEnd);

    return boundary > relativeStart ? boundary : maxEnd;
  }
}

function normalizeOptions(options: Partial<ChunkerOptions>): ChunkerOptions {
  const targetSize = options.targetSize ?? DEFAULT_OPTIONS.targetSize;
  const maxSize = options.maxSize ?? DEFAULT_OPTIONS.maxSize;
  const overlap = options.overlap ?? DEFAULT_OPTIONS.overlap;

  if (targetSize < 1 || maxSize < targetSize || overlap < 0) {
    throw new Error('Invalid document text chunker options');
  }

  return {
    targetSize,
    maxSize,
    overlap: Math.min(overlap, targetSize - 1),
  };
}

function findBoundary(text: string, targetEnd: number, maxEnd: number): number {
  const boundedMaxEnd = Math.min(maxEnd, text.length);
  const boundaryPatterns = ['\n\n', '\n', '. ', '; ', ', ', ' '];

  for (const pattern of boundaryPatterns) {
    const index = text.lastIndexOf(pattern, boundedMaxEnd);

    if (index >= targetEnd) {
      return index + pattern.length;
    }
  }

  return boundedMaxEnd;
}

function skipLeadingWhitespace(text: string, start: number): number {
  let index = start;

  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  return index;
}
