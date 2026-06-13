import { z } from 'genkit';

const DEFAULT_MAX_KNOWLEDGE_UNITS = 20;

export const ExtractedKnowledgeUnitSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    sourceExcerpt: z.string().optional(),
    difficulty: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  })
  .strict();

export const ExtractedKnowledgeSchema = z
  .object({
    units: z
      .array(ExtractedKnowledgeUnitSchema)
      .max(DEFAULT_MAX_KNOWLEDGE_UNITS),
  })
  .strict();
