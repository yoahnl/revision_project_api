import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import type { DocumentTextExtractor } from '../application/document-text-extractor';

@Injectable()
export class PdfParseDocumentTextExtractor implements DocumentTextExtractor {
  async extractText(input: {
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<string> {
    if (input.mimeType !== 'application/pdf') {
      throw new Error('Only PDF text extraction is supported');
    }

    const parser = new PDFParse({ data: input.content });

    try {
      const result = await parser.getText();

      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
}
