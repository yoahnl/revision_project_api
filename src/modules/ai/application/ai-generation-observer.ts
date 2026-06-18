export const AI_GENERATION_OBSERVER = Symbol('AI_GENERATION_OBSERVER');

export type AiGenerationStatus = 'success' | 'error';
export type AiGenerationErrorCategory =
  | 'AUTHENTICATION'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'BAD_REQUEST'
  | 'SCHEMA_VALIDATION'
  | 'PROVIDER_SERVER_ERROR'
  | 'CONFIGURATION'
  | 'UNKNOWN';

// This DTO is intentionally metadata-only: no prompt, completion, course text,
// user answer, generated question, or source excerpt should cross this port.
export interface AiGenerationObservation {
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  durationMs: number;
  status: AiGenerationStatus;
  errorCode?: string;
  errorCategory?: AiGenerationErrorCategory;
  errorName?: string;
  errorStatus?: number;
  errorProviderCode?: string;
  errorSummary?: string;
  documentId?: string;
  knowledgeUnitId?: string;
  subjectId?: string;
  activitySessionId?: string;
  studentId?: string;
}

export interface AiGenerationObserver {
  observe(observation: AiGenerationObservation): void;
}

// Direct unit tests and provider factories can instantiate AI adapters without
// Nest. This fallback preserves that boundary while keeping instrumentation opt-in.
export class NoopAiGenerationObserver implements AiGenerationObserver {
  observe(observation: AiGenerationObservation): void {
    void observation;
  }
}

export const noopAiGenerationObserver = new NoopAiGenerationObserver();
