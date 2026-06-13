import { Injectable } from '@nestjs/common';
import openAICompatible from '@genkit-ai/compat-oai';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit, z } from 'genkit';
import type {
  DiagnosticQuizGenerator,
  GeneratedDiagnosticQuiz,
} from '../application/diagnostic-quiz-generator';
import type { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';

const MISTRAL_PLUGIN_NAME = 'mistral';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';

const GeneratedDiagnosticQuizChoiceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

const GeneratedDiagnosticQuizQuestionSchema = z
  .object({
    prompt: z.string().min(8),
    choices: z.array(GeneratedDiagnosticQuizChoiceSchema).min(2).max(4),
    correctChoiceId: z.string().min(1),
    explanation: z.string().min(8),
  })
  .strict()
  .refine(
    (question) =>
      new Set(question.choices.map((choice) => choice.id)).size ===
        question.choices.length &&
      question.choices.some((choice) => choice.id === question.correctChoiceId),
    {
      message:
        'Question choices must be unique and include the correct choice id',
    },
  );

const GeneratedDiagnosticQuizSchema = z
  .object({
    title: z.string().min(2),
    questions: z.array(GeneratedDiagnosticQuizQuestionSchema).min(1).max(3),
  })
  .strict();

@Injectable()
export class GenkitDiagnosticQuizGenerator implements DiagnosticQuizGenerator {
  private ai?: ReturnType<typeof genkit>;

  async generate(input: {
    knowledgeUnit: KnowledgeUnit;
  }): Promise<GeneratedDiagnosticQuiz> {
    const { output } = await this.getAi().generate({
      prompt: buildPrompt(input.knowledgeUnit),
      output: {
        schema: GeneratedDiagnosticQuizSchema,
      },
    });

    if (!output) {
      throw new Error('Generated diagnostic quiz is empty');
    }

    return output;
  }

  private getAi(): ReturnType<typeof genkit> {
    this.ai ??= genkit(resolveGenkitConfig());

    return this.ai;
  }
}

function buildPrompt(knowledgeUnit: KnowledgeUnit): string {
  return [
    'Tu es un tuteur universitaire qui genere un QCM de revision en francais.',
    'Genere le QCM exclusivement a partir de l unite de connaissance fournie.',
    'N ajoute aucun sujet externe, aucun exemple generique et aucune question hors cours.',
    'Si le contenu est court, pose une question de comprehension sur le titre et le resume fournis.',
    'Retourne uniquement du JSON respectant le schema demande.',
    'Contraintes: 1 a 3 questions, 2 a 4 choix par question, une seule bonne reponse, explication concise.',
    `Titre de l unite: ${knowledgeUnit.title}`,
    `Resume de l unite: ${knowledgeUnit.summary}`,
  ].join('\n\n');
}

function resolveGenkitConfig(): Parameters<typeof genkit>[0] {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (
    provider === 'mistral' ||
    (!hasValue(process.env.GOOGLE_GENAI_API_KEY) &&
      hasValue(process.env.MISTRAL_API_KEY))
  ) {
    return {
      plugins: [
        openAICompatible({
          name: MISTRAL_PLUGIN_NAME,
          apiKey: resolveMistralApiKey(),
          baseURL: MISTRAL_BASE_URL,
        }),
      ],
      model: resolveMistralModel(),
    };
  }

  return {
    plugins: [googleAI()],
    model: process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL,
  };
}

function resolveMistralApiKey(): string {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is required');
  }

  return apiKey;
}

function resolveMistralModel(): string {
  const configuredModel = process.env.MISTRAL_MODEL?.trim();
  const model = configuredModel || DEFAULT_MISTRAL_MODEL;

  if (model.startsWith(`${MISTRAL_PLUGIN_NAME}/`)) {
    return model;
  }

  return `${MISTRAL_PLUGIN_NAME}/${model}`;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
