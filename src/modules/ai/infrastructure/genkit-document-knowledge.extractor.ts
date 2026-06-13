import { Injectable } from '@nestjs/common';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit, z } from 'genkit';
import {
  type DocumentKnowledgeExtractor,
  type ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';

const DEFAULT_GENKIT_MODEL = 'googleai/gemini-2.5-flash';
const DEFAULT_TEXT_INPUT_LIMIT = 12000;
const DEFAULT_MAX_KNOWLEDGE_UNITS = 20;

const ExtractedKnowledgeUnitSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    sourceExcerpt: z.string().optional(),
    difficulty: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  })
  .strict();

const ExtractedKnowledgeSchema = z
  .object({
    units: z
      .array(ExtractedKnowledgeUnitSchema)
      .max(DEFAULT_MAX_KNOWLEDGE_UNITS),
  })
  .strict();

@Injectable()
export class GenkitDocumentKnowledgeExtractor implements DocumentKnowledgeExtractor {
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
      plugins: [googleAI()],
      model: process.env.GENKIT_MODEL ?? DEFAULT_GENKIT_MODEL,
    });

    return this.ai;
  }
}

function resolveTextInputLimit(): number {
  const configuredLimit = Number(process.env.DOCUMENT_TEXT_MAX_CHARS);

  if (!Number.isInteger(configuredLimit) || configuredLimit < 1000) {
    return DEFAULT_TEXT_INPUT_LIMIT;
  }

  return configuredLimit;
}
