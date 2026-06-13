import { Injectable } from '@nestjs/common';
import openAICompatible from '@genkit-ai/compat-oai';
import { genkit } from 'genkit';
import {
  type DocumentKnowledgeExtractor,
  type ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';
import { ExtractedKnowledgeSchema } from './document-knowledge-output.schema';

const MISTRAL_PLUGIN_NAME = 'mistral';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const DEFAULT_TEXT_INPUT_LIMIT = 12000;

@Injectable()
export class GenkitMistralDocumentKnowledgeExtractor implements DocumentKnowledgeExtractor {
  private ai?: ReturnType<typeof genkit>;

  async extract(input: {
    documentId: string;
    fileName: string;
    text: string;
  }): Promise<ExtractedKnowledgeUnit[]> {
    const { output } = await this.getAi().generate({
      prompt: [
        'Extract the main knowledge units from this student revision document.',
        'Return concise French titles and summaries.',
        'Return JSON only using the requested schema.',
        `Document id: ${input.documentId}`,
        `File name: ${input.fileName}`,
        input.text.slice(0, resolveTextInputLimit()),
      ].join('\n\n'),
      output: {
        schema: ExtractedKnowledgeSchema,
      },
    });

    return output?.units ?? [];
  }

  private getAi(): ReturnType<typeof genkit> {
    this.ai ??= genkit({
      plugins: [
        openAICompatible({
          name: MISTRAL_PLUGIN_NAME,
          apiKey: resolveMistralApiKey(),
          baseURL: MISTRAL_BASE_URL,
        }),
      ],
      model: resolveMistralModel(),
    });

    return this.ai;
  }
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

function resolveTextInputLimit(): number {
  const configuredLimit = Number(process.env.DOCUMENT_TEXT_MAX_CHARS);

  if (!Number.isInteger(configuredLimit) || configuredLimit < 1000) {
    return DEFAULT_TEXT_INPUT_LIMIT;
  }

  return configuredLimit;
}
