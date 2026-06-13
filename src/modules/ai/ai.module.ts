import { Module } from '@nestjs/common';
import { DOCUMENT_KNOWLEDGE_EXTRACTOR } from './application/document-knowledge-extractor';
import { GenkitDocumentKnowledgeExtractor } from './infrastructure/genkit-document-knowledge.extractor';

@Module({
  providers: [
    {
      provide: DOCUMENT_KNOWLEDGE_EXTRACTOR,
      useClass: GenkitDocumentKnowledgeExtractor,
    },
  ],
  exports: [DOCUMENT_KNOWLEDGE_EXTRACTOR],
})
export class AiModule {}
