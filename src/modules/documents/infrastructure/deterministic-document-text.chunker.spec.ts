import { DeterministicDocumentTextChunker } from './deterministic-document-text.chunker';

describe('DeterministicDocumentTextChunker', () => {
  it('returns no chunks for empty text', () => {
    const chunker = new DeterministicDocumentTextChunker({
      targetSize: 20,
      maxSize: 30,
      overlap: 5,
    });

    expect(chunker.chunk({ text: '   ' })).toEqual([]);
  });

  it('returns a single normalized chunk for short text', () => {
    const chunker = new DeterministicDocumentTextChunker({
      targetSize: 50,
      maxSize: 80,
      overlap: 10,
    });

    expect(chunker.chunk({ text: '  Introduction au droit.   ' })).toEqual([
      {
        index: 0,
        text: 'Introduction au droit.',
        charStart: 2,
        charEnd: 24,
        pageNumber: null,
      },
    ]);
  });

  it('splits long text into ordered chunks with bounded lengths', () => {
    const chunker = new DeterministicDocumentTextChunker({
      targetSize: 40,
      maxSize: 55,
      overlap: 8,
    });
    const text = [
      'La Constitution organise les pouvoirs publics.',
      'Elle garantit la séparation des pouvoirs.',
      'Le contrôle de constitutionnalité protège la norme suprême.',
    ].join('\n\n');

    const chunks = chunker.chunk({ text });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.index)).toEqual(
      chunks.map((_, index) => index),
    );
    expect(chunks.every((chunk) => chunk.text.length <= 55)).toBe(true);
    expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[1].charStart).toBeLessThan(chunks[1].charEnd);
    expect(chunks[2].charStart).toBeLessThan(chunks[2].charEnd);
  });

  it('keeps deterministic output for the same text', () => {
    const chunker = new DeterministicDocumentTextChunker({
      targetSize: 35,
      maxSize: 50,
      overlap: 5,
    });
    const text =
      'Article premier. La France est une Republique indivisible, laique, democratique et sociale.';

    expect(chunker.chunk({ text })).toEqual(chunker.chunk({ text }));
  });
});
