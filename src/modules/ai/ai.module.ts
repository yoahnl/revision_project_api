import { Module } from '@nestjs/common';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
} from './application/ai-generation-observer';
import { DOCUMENT_KNOWLEDGE_EXTRACTOR } from './application/document-knowledge-extractor';
import { createDocumentKnowledgeExtractor } from './infrastructure/document-knowledge-extractor.provider';
import { StructuredLogAiGenerationObserver } from './infrastructure/structured-log-ai-generation.observer';

@Module({
  providers: [
    {
      provide: AI_GENERATION_OBSERVER,
      useClass: StructuredLogAiGenerationObserver,
    },
    {
      provide: DOCUMENT_KNOWLEDGE_EXTRACTOR,
      useFactory: (observer: AiGenerationObserver) =>
        createDocumentKnowledgeExtractor(process.env, observer),
      inject: [AI_GENERATION_OBSERVER],
    },
  ],
  exports: [AI_GENERATION_OBSERVER, DOCUMENT_KNOWLEDGE_EXTRACTOR],
})
export class AiModule {}
