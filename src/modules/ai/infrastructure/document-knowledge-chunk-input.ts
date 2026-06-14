import {
  DOCUMENT_KNOWLEDGE_PROMPT_VERSION,
  DOCUMENT_KNOWLEDGE_SCHEMA_VERSION,
  type DocumentKnowledgeChunk,
  type ExtractedKnowledgeUnit,
} from '../application/document-knowledge-extractor';
import { ExtractedKnowledgeSchema } from './document-knowledge-output.schema';

const DEFAULT_MAX_CHUNKS = 12;
const DEFAULT_MAX_CHARS = 12000;

export function selectDocumentKnowledgeChunks(
  chunks: DocumentKnowledgeChunk[],
): DocumentKnowledgeChunk[] {
  const maxChunks = resolvePositiveInteger(
    process.env.DOCUMENT_KNOWLEDGE_MAX_CHUNKS,
    DEFAULT_MAX_CHUNKS,
  );
  const maxChars = resolvePositiveInteger(
    process.env.DOCUMENT_KNOWLEDGE_MAX_CHARS,
    DEFAULT_MAX_CHARS,
  );
  let remainingChars = maxChars;

  return [...chunks]
    .sort((left, right) => left.index - right.index)
    .filter((chunk) => chunk.text.trim().length > 0)
    .slice(0, maxChunks)
    .flatMap((chunk) => {
      if (remainingChars <= 0) {
        return [];
      }

      const text = chunk.text.slice(0, remainingChars);
      remainingChars -= text.length;

      if (text.trim().length === 0) {
        return [];
      }

      return [{ ...chunk, text }];
    });
}

export function buildDocumentKnowledgePrompt(input: {
  documentId: string;
  chunks: DocumentKnowledgeChunk[];
}): string {
  return [
    'Analyse les extraits de cours fournis et extrais les notions principales.',
    'Réponds en français avec des titres courts et des résumés concis.',
    'Utilise uniquement les chunks fournis. N’utilise aucune connaissance externe.',
    'Chaque notion doit référencer au moins un sourceChunkId choisi uniquement parmi les ids fournis.',
    'Ne crée aucune citation libre et ne renvoie que du JSON conforme au schéma demandé.',
    `Document id: ${input.documentId}`,
    JSON.stringify({
      chunks: input.chunks.map((chunk) => ({
        id: chunk.id,
        index: chunk.index,
        text: chunk.text,
      })),
    }),
  ].join('\n\n');
}

export function normalizeExtractedKnowledgeOutput(
  output: unknown,
  chunks: DocumentKnowledgeChunk[],
): ExtractedKnowledgeUnit[] {
  const parsed = ExtractedKnowledgeSchema.parse(output ?? { units: [] });
  const knownChunkIds = new Set(chunks.map((chunk) => chunk.id));

  return parsed.units.map((unit, index) => {
    const sourceChunkIds = [...new Set(unit.sourceChunkIds)];

    if (
      sourceChunkIds.length === 0 ||
      sourceChunkIds.some((chunkId) => !knownChunkIds.has(chunkId))
    ) {
      throw new Error('Generated knowledge references unknown chunk');
    }

    return {
      title: unit.title,
      summary: unit.summary,
      sourceChunkIds,
      difficulty: unit.difficulty,
      displayOrder: unit.displayOrder ?? index,
      confidence: unit.confidence,
      extractionPromptVersion: DOCUMENT_KNOWLEDGE_PROMPT_VERSION,
      extractionSchemaVersion: DOCUMENT_KNOWLEDGE_SCHEMA_VERSION,
    };
  });
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
