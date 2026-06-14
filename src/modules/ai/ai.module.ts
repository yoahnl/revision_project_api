import { Module } from '@nestjs/common';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
} from './application/ai-generation-observer';
import { DOCUMENT_KNOWLEDGE_EXTRACTOR } from './application/document-knowledge-extractor';
import { DOCUMENT_SUMMARY_GENERATOR } from './application/document-summary-generator';
import { REVISION_SHEET_GENERATOR } from './application/revision-sheet-generator';
import { createDocumentKnowledgeExtractor } from './infrastructure/document-knowledge-extractor.provider';
import { GenkitDocumentSummaryGenerator } from './infrastructure/genkit-document-summary.generator';
import { GenkitRevisionSheetGenerator } from './infrastructure/genkit-revision-sheet.generator';
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
    {
      provide: DOCUMENT_SUMMARY_GENERATOR,
      useClass: GenkitDocumentSummaryGenerator,
    },
    {
      provide: REVISION_SHEET_GENERATOR,
      useClass: GenkitRevisionSheetGenerator,
    },
  ],
  exports: [
    AI_GENERATION_OBSERVER,
    DOCUMENT_KNOWLEDGE_EXTRACTOR,
    DOCUMENT_SUMMARY_GENERATOR,
    REVISION_SHEET_GENERATOR,
  ],
})
export class AiModule {}
