import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  DOCUMENT_KNOWLEDGE_EXTRACTOR,
  type DocumentKnowledgeExtractor,
} from '../../ai/application/document-knowledge-extractor';
import {
  DOCUMENT_CONTENT_READER,
  type DocumentContentReader,
} from '../../documents/application/document-content-reader';
import {
  DOCUMENT_TEXT_CHUNKER,
  type DocumentTextChunker,
} from '../../documents/application/document-text-chunker';
import {
  DOCUMENT_TEXT_EXTRACTOR,
  type DocumentTextExtractor,
} from '../../documents/application/document-text-extractor';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/application/documents.repository';
import { DOCUMENT_PROCESSING_QUEUE_NAME } from './bullmq-document-processing.queue';

@Injectable()
@Processor(DOCUMENT_PROCESSING_QUEUE_NAME)
export class DocumentProcessingConsumer extends WorkerHost {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_KNOWLEDGE_EXTRACTOR)
    private readonly extractor: DocumentKnowledgeExtractor,
    @Inject(DOCUMENT_CONTENT_READER)
    private readonly contentReader: DocumentContentReader,
    @Inject(DOCUMENT_TEXT_EXTRACTOR)
    private readonly textExtractor: DocumentTextExtractor,
    @Inject(DOCUMENT_TEXT_CHUNKER)
    private readonly textChunker: DocumentTextChunker,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string }>): Promise<void> {
    const data = job.data as { documentId?: unknown } | null;
    const documentId = data?.documentId;

    if (typeof documentId !== 'string' || documentId.trim().length === 0) {
      throw new Error('Document processing job requires documentId');
    }

    if (isFirstAttempt(job)) {
      await this.documentsRepository.markProcessing(documentId);
    }

    let units: Awaited<ReturnType<DocumentKnowledgeExtractor['extract']>>;
    try {
      const document = await this.documentsRepository.findById(documentId);

      if (!document) {
        throw new DocumentNotFoundError(documentId);
      }

      if (document.mimeType !== 'application/pdf') {
        throw new UnsupportedDocumentMimeTypeError(document.mimeType);
      }

      let text: string;
      try {
        const content = await this.contentReader.read({
          storagePath: document.storagePath,
        });
        text = await this.textExtractor.extractText({
          fileName: document.fileName,
          mimeType: document.mimeType,
          content,
        });
      } catch (error) {
        throw new DocumentTextExtractionFailedError(error);
      }

      if (text.trim().length === 0) {
        throw new EmptyDocumentTextError();
      }

      const chunks = this.textChunker.chunk({ text });

      if (chunks.length === 0) {
        throw new EmptyDocumentChunksError();
      }

      await this.documentsRepository.replaceChunks({
        documentId,
        chunks,
      });

      units = await this.extractor.extract({
        documentId,
        fileName: document.fileName,
        text,
      });

      if (units.length === 0) {
        throw new EmptyExtractedKnowledgeUnitsError();
      }
    } catch (error) {
      if (isFinalAttempt(job) && !(error instanceof DocumentNotFoundError)) {
        await this.documentsRepository.markFailed({
          documentId,
          errorCode: getExtractionErrorCode(error),
        });
      }

      throw error;
    }

    await this.documentsRepository.markReadyWithKnowledgeUnits({
      documentId,
      units,
    });
  }
}

class DocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Document ${documentId} not found`);
  }
}

class UnsupportedDocumentMimeTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported document mime type: ${mimeType}`);
  }
}

class EmptyDocumentTextError extends Error {
  constructor() {
    super('Document text extraction returned no text');
  }
}

class EmptyDocumentChunksError extends Error {
  constructor() {
    super('Document chunking returned no chunks');
  }
}

class DocumentTextExtractionFailedError extends Error {
  constructor(readonly cause: unknown) {
    super('Document text extraction failed');
  }
}

class EmptyExtractedKnowledgeUnitsError extends Error {
  constructor() {
    super('Document knowledge extraction returned no units');
  }
}

function isFirstAttempt(job: Job<{ documentId: string }>): boolean {
  return (job.attemptsMade ?? 0) === 0;
}

function isFinalAttempt(job: Job<{ documentId: string }>): boolean {
  const configuredAttempts = job.opts?.attempts;

  if (typeof configuredAttempts !== 'number' || configuredAttempts <= 1) {
    return true;
  }

  return (job.attemptsMade ?? 0) + 1 >= configuredAttempts;
}

function getExtractionErrorCode(error: unknown): string {
  if (error instanceof UnsupportedDocumentMimeTypeError) {
    return 'DOCUMENT_UNSUPPORTED_MIME_TYPE';
  }

  if (error instanceof EmptyDocumentTextError) {
    return 'DOCUMENT_TEXT_EMPTY';
  }

  if (error instanceof EmptyDocumentChunksError) {
    return 'DOCUMENT_CHUNKS_EMPTY';
  }

  if (error instanceof DocumentTextExtractionFailedError) {
    return 'DOCUMENT_TEXT_EXTRACTION_FAILED';
  }

  if (error instanceof EmptyExtractedKnowledgeUnitsError) {
    return 'KNOWLEDGE_EXTRACTION_EMPTY';
  }

  return 'KNOWLEDGE_EXTRACTION_FAILED';
}
