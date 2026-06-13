import { Job } from 'bullmq';
import type { DocumentKnowledgeExtractor } from '../../ai/application/document-knowledge-extractor';
import type { DocumentContentReader } from '../../documents/application/document-content-reader';
import type { DocumentTextExtractor } from '../../documents/application/document-text-extractor';
import type {
  DocumentsRepository,
  RevisionDocumentDto,
} from '../../documents/application/documents.repository';
import { DocumentProcessingConsumer } from './document-processing.consumer';

describe('DocumentProcessingConsumer', () => {
  it('rejects jobs without a non-empty documentId', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );
    const invalidJobs = [
      { data: null },
      { data: {} },
      { data: { documentId: null } },
      { data: { documentId: 42 } },
      { data: { documentId: '' } },
      { data: { documentId: '   ' } },
    ];

    for (const job of invalidJobs) {
      await expect(
        consumer.process(job as Job<{ documentId: string }>),
      ).rejects.toThrow('Document processing job requires documentId');
    }

    expect(documentsRepository.markProcessing).not.toHaveBeenCalled();
    expect(documentsRepository.findById).not.toHaveBeenCalled();
    expect(contentReader.read).not.toHaveBeenCalled();
    expect(textExtractor.extractText).not.toHaveBeenCalled();
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it('marks the document ready with extracted PDF knowledge units', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    extractor.extract.mockResolvedValue([
      {
        title: 'Cycle cardiaque',
        summary: 'Phases principales du cycle cardiaque.',
      },
    ]);

    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );

    await consumer.process({
      data: { documentId: 'document-1' },
    } as Job<{ documentId: string }>);

    expect(documentsRepository.markProcessing).toHaveBeenCalledWith(
      'document-1',
    );
    expect(documentsRepository.findById).toHaveBeenCalledWith('document-1');
    expect(contentReader.read).toHaveBeenCalledWith({
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
    });
    expect(textExtractor.extractText).toHaveBeenCalledWith({
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });
    expect(extractor.extract).toHaveBeenCalledWith({
      documentId: 'document-1',
      fileName: 'cours.pdf',
      text: 'Contenu PDF exploitable.',
    });
    expect(
      documentsRepository.markReadyWithKnowledgeUnits,
    ).toHaveBeenCalledWith({
      documentId: 'document-1',
      units: [
        {
          title: 'Cycle cardiaque',
          summary: 'Phases principales du cycle cardiaque.',
        },
      ],
    });
    expect(documentsRepository.markFailed).not.toHaveBeenCalled();
  });

  it('rethrows non-final extraction failures without marking the document failed', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    const extractionError = new Error('Gemini unavailable');
    extractor.extract.mockRejectedValue(extractionError);

    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );

    await expect(
      consumer.process({
        data: { documentId: 'document-1' },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as Job<{ documentId: string }>),
    ).rejects.toThrow(extractionError);

    expect(documentsRepository.markProcessing).toHaveBeenCalledWith(
      'document-1',
    );
    expect(documentsRepository.markFailed).not.toHaveBeenCalled();
    expect(
      documentsRepository.markReadyWithKnowledgeUnits,
    ).not.toHaveBeenCalled();
  });

  it('marks the document failed when Genkit fails on the final attempt', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    const extractionError = new Error('Gemini unavailable');
    extractor.extract.mockRejectedValue(extractionError);

    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );

    await expect(
      consumer.process({
        data: { documentId: 'document-1' },
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as Job<{ documentId: string }>),
    ).rejects.toThrow(extractionError);

    expect(documentsRepository.markProcessing).not.toHaveBeenCalled();
    expect(documentsRepository.markFailed).toHaveBeenCalledWith({
      documentId: 'document-1',
      errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
    });
    expect(
      documentsRepository.markReadyWithKnowledgeUnits,
    ).not.toHaveBeenCalled();
  });

  it('fails empty PDF text on the final attempt', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    textExtractor.extractText.mockResolvedValue('   ');

    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );

    await expect(
      consumer.process({
        data: { documentId: 'document-1' },
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as Job<{ documentId: string }>),
    ).rejects.toThrow('Document text extraction returned no text');

    expect(extractor.extract).not.toHaveBeenCalled();
    expect(documentsRepository.markFailed).toHaveBeenCalledWith({
      documentId: 'document-1',
      errorCode: 'DOCUMENT_TEXT_EMPTY',
    });
  });

  it('fails PDF parser errors on the final attempt', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    textExtractor.extractText.mockRejectedValue(new Error('Invalid PDF'));

    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );

    await expect(
      consumer.process({
        data: { documentId: 'document-1' },
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as Job<{ documentId: string }>),
    ).rejects.toThrow('Document text extraction failed');

    expect(documentsRepository.markFailed).toHaveBeenCalledWith({
      documentId: 'document-1',
      errorCode: 'DOCUMENT_TEXT_EXTRACTION_FAILED',
    });
  });

  it('fails empty knowledge output without marking the document ready', async () => {
    const documentsRepository = createDocumentsRepository();
    const extractor = createExtractor();
    const contentReader = createContentReader();
    const textExtractor = createTextExtractor();
    extractor.extract.mockResolvedValue([]);

    const consumer = new DocumentProcessingConsumer(
      documentsRepository.service,
      extractor.service,
      contentReader.service,
      textExtractor.service,
    );

    await expect(
      consumer.process({
        data: { documentId: 'document-1' },
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as Job<{ documentId: string }>),
    ).rejects.toThrow('Document knowledge extraction returned no units');

    expect(documentsRepository.markProcessing).not.toHaveBeenCalled();
    expect(documentsRepository.markFailed).toHaveBeenCalledWith({
      documentId: 'document-1',
      errorCode: 'KNOWLEDGE_EXTRACTION_EMPTY',
    });
    expect(
      documentsRepository.markReadyWithKnowledgeUnits,
    ).not.toHaveBeenCalled();
  });
});

function createDocumentsRepository(): {
  service: DocumentsRepository;
  markProcessing: jest.Mock;
  markReadyWithKnowledgeUnits: jest.Mock;
  markFailed: jest.Mock;
  findById: jest.Mock;
} {
  const markProcessing = jest.fn().mockResolvedValue(undefined);
  const markReadyWithKnowledgeUnits = jest.fn().mockResolvedValue(undefined);
  const markFailed = jest.fn().mockResolvedValue(undefined);
  const findById = jest.fn().mockResolvedValue(documentRecord());

  return {
    service: {
      create: jest.fn(),
      findBySubjectForStudent: jest.fn(),
      findByIdForStudent: jest.fn(),
      findById,
      markProcessing,
      markReadyWithKnowledgeUnits,
      markFailed,
    },
    markProcessing,
    markReadyWithKnowledgeUnits,
    markFailed,
    findById,
  };
}

function createExtractor(): {
  service: DocumentKnowledgeExtractor;
  extract: jest.Mock;
} {
  const extract = jest.fn().mockResolvedValue([]);

  return {
    service: { extract },
    extract,
  };
}

function createContentReader(): {
  service: DocumentContentReader;
  read: jest.Mock;
} {
  const read = jest.fn().mockResolvedValue(Buffer.from('pdf-content'));

  return {
    service: { read },
    read,
  };
}

function createTextExtractor(): {
  service: DocumentTextExtractor;
  extractText: jest.Mock;
} {
  const extractText = jest.fn().mockResolvedValue('Contenu PDF exploitable.');

  return {
    service: { extractText },
    extractText,
  };
}

function documentRecord(): RevisionDocumentDto {
  return {
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    kind: 'COURSE_PDF',
    fileName: 'cours.pdf',
    storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
    mimeType: 'application/pdf',
    status: 'PROCESSING',
  };
}
