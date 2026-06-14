import { z } from 'genkit';

const NonEmptyStringSchema = z.string().trim().min(1);

export const GeneratedDocumentSummarySchema = z
  .object({
    title: NonEmptyStringSchema,
    content: NonEmptyStringSchema,
    keyPoints: z.array(NonEmptyStringSchema).min(1),
    limits: NonEmptyStringSchema.nullish(),
    sourceChunkIds: z.array(NonEmptyStringSchema).min(1),
  })
  .strict();

export const GeneratedRevisionSheetSectionSchema = z
  .object({
    title: NonEmptyStringSchema,
    content: NonEmptyStringSchema,
    sourceChunkIds: z.array(NonEmptyStringSchema).min(1),
  })
  .strict();

export const GeneratedRevisionSheetSchema = z
  .object({
    title: NonEmptyStringSchema,
    introduction: NonEmptyStringSchema.nullish(),
    sections: z.array(GeneratedRevisionSheetSectionSchema).min(1),
    keyPoints: z.array(NonEmptyStringSchema).min(1),
    commonMistakes: z.array(NonEmptyStringSchema).optional(),
    mustKnow: z.array(NonEmptyStringSchema).optional(),
    practiceSuggestions: z.array(NonEmptyStringSchema).optional(),
  })
  .strict();
