import 'dotenv/config';

import { GenkitDiagnosticQuizGenerator } from '../src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../src/modules/ai/application/ai-generation-observer';
import { KnowledgeUnit } from '../src/modules/revision/domain/knowledge-unit.entity';

const aiKeyEnvNames = [
  'GOOGLE_GENAI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'MISTRAL_API_KEY',
  'MIMO_API_KEY',
] as const;

async function main() {
  if (!hasAnyAiKey()) {
    console.error(
      JSON.stringify({
        status: 'skipped',
        reason: 'NO_AI_PROVIDER_KEY',
        message:
          'Set one AI provider key before running the diagnostic quiz AI smoke.',
      }),
    );
    process.exitCode = 2;
    return;
  }

  const observer = new ConsoleAiGenerationObserver();
  const generator = new GenkitDiagnosticQuizGenerator(observer);

  try {
    const quiz = await generator.generate({
      questionCount: 1,
      selectionModes: ['single'],
      visualsEnabled: false,
      knowledgeUnit: new KnowledgeUnit({
        id: 'smoke-knowledge-unit',
        subjectId: 'smoke-subject',
        documentId: 'smoke-document',
        title: 'Contrôle constitutionnel',
        summary:
          'Le contrôle constitutionnel vérifie la conformité des normes à la Constitution et encadre la hiérarchie des normes.',
      }),
      chunks: [
        {
          id: 'smoke-chunk-1',
          index: 1,
          pageNumber: 1,
          text: 'Le contrôle constitutionnel est exercé pour garantir que les normes respectent la Constitution. Il protège les droits fondamentaux et organise les rapports entre les pouvoirs publics.',
        },
      ],
    });

    console.log(
      JSON.stringify({
        status: 'ok',
        titleLength: quiz.title.length,
        questionCount: quiz.questions.length,
        metadata: quiz.metadata,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: 'error',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Unknown diagnostic smoke error',
      }),
    );
    process.exitCode = 1;
  }
}

function hasAnyAiKey(): boolean {
  return aiKeyEnvNames.some((name) => {
    const value = process.env[name];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

class ConsoleAiGenerationObserver implements AiGenerationObserver {
  observe(observation: AiGenerationObservation): void {
    console.log(
      JSON.stringify({
        event: 'ai.generation.smoke',
        flowName: observation.flowName,
        provider: observation.provider,
        model: observation.model,
        promptVersion: observation.promptVersion,
        schemaVersion: observation.schemaVersion,
        status: observation.status,
        errorCode: observation.errorCode,
        errorCategory: observation.errorCategory,
        errorName: observation.errorName,
        errorProviderCode: observation.errorProviderCode,
        durationMs: observation.durationMs,
      }),
    );
  }
}

void main();
