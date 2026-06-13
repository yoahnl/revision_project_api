import { Module } from '@nestjs/common';
import { DOCUMENT_KNOWLEDGE_EXTRACTOR } from './application/document-knowledge-extractor';
import { createDocumentKnowledgeExtractor } from './infrastructure/document-knowledge-extractor.provider';

@Module({
  providers: [
    {
      provide: DOCUMENT_KNOWLEDGE_EXTRACTOR,
      useFactory: createDocumentKnowledgeExtractor,
    },
  ],
  exports: [DOCUMENT_KNOWLEDGE_EXTRACTOR],
})
export class AiModule {}
