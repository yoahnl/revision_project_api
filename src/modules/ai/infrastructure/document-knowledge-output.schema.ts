import { z } from 'genkit';

const DEFAULT_MAX_KNOWLEDGE_UNITS = 20;

export const ExtractedKnowledgeUnitSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    sourceChunkIds: z.array(z.string().min(1)).min(1),
    difficulty: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    displayOrder: z.number().int().min(0).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const ExtractedKnowledgeSchema = z
  .object({
    units: z
      .array(ExtractedKnowledgeUnitSchema)
      .max(DEFAULT_MAX_KNOWLEDGE_UNITS),
  })
  .strict();
