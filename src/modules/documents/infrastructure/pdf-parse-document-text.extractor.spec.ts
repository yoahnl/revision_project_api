const mockGetText = jest.fn();
const mockDestroy = jest.fn();
const mockPdfParse = jest.fn(() => ({
  getText: mockGetText,
  destroy: mockDestroy,
}));

jest.mock('pdf-parse', () => ({
  PDFParse: mockPdfParse,
}));

import { PdfParseDocumentTextExtractor } from './pdf-parse-document-text.extractor';

describe('PdfParseDocumentTextExtractor', () => {
  beforeEach(() => {
    mockPdfParse.mockClear();
    mockGetText.mockReset();
    mockDestroy.mockReset();
    mockDestroy.mockResolvedValue(undefined);
  });

  it('extracts trimmed text from PDF content and destroys the parser', async () => {
    mockGetText.mockResolvedValue({ text: '  Contenu PDF exploitable.  ' });

    const text = await new PdfParseDocumentTextExtractor().extractText({
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });

    expect(mockPdfParse).toHaveBeenCalledWith({
      data: Buffer.from('pdf-content'),
    });
    expect(text).toBe('Contenu PDF exploitable.');
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('rejects non-PDF documents before parsing', async () => {
    await expect(
      new PdfParseDocumentTextExtractor().extractText({
        fileName: 'image.png',
        mimeType: 'image/png',
        content: Buffer.from('image-content'),
      }),
    ).rejects.toThrow('Only PDF text extraction is supported');

    expect(mockPdfParse).not.toHaveBeenCalled();
  });
});
