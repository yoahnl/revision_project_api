import { Injectable, Logger } from '@nestjs/common';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../application/ai-generation-observer';

const AI_GENERATION_EVENT = 'ai.generation';

@Injectable()
export class StructuredLogAiGenerationObserver implements AiGenerationObserver {
  private readonly logger = new Logger(StructuredLogAiGenerationObserver.name);

  observe(observation: AiGenerationObservation): void {
    // Keep this payload as an allowlist. Spreading the observation would make it
    // too easy to leak prompts, completions, source excerpts, or course content.
    const payload = JSON.stringify({
      event: AI_GENERATION_EVENT,
      flowName: observation.flowName,
      provider: observation.provider,
      model: observation.model,
      promptVersion: observation.promptVersion,
      schemaVersion: observation.schemaVersion,
      inputSize: observation.inputSize,
      durationMs: observation.durationMs,
      status: observation.status,
      errorCode: observation.errorCode,
      errorCategory: observation.errorCategory,
      errorName: observation.errorName,
      errorStatus: observation.errorStatus,
      errorProviderCode: observation.errorProviderCode,
      errorSummary: observation.errorSummary,
      documentId: observation.documentId,
      knowledgeUnitId: observation.knowledgeUnitId,
      subjectId: observation.subjectId,
      activitySessionId: observation.activitySessionId,
      studentId: observation.studentId,
    });

    if (observation.status === 'error') {
      this.logger.warn(payload);
      return;
    }

    this.logger.log(payload);
  }
}
