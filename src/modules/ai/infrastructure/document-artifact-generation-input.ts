import {
  type DocumentArtifactChunk,
  type DocumentArtifactKnowledgeUnit,
} from '../application/document-summary-generator';

type ArtifactChunkLimitOptions = {
  maxChunksEnv: string;
  maxCharsEnv: string;
  defaultMaxChunks: number;
  defaultMaxChars: number;
};

export function selectDocumentArtifactChunks(
  chunks: DocumentArtifactChunk[],
  options: ArtifactChunkLimitOptions,
): DocumentArtifactChunk[] {
  const maxChunks = resolvePositiveInteger(
    process.env[options.maxChunksEnv],
    options.defaultMaxChunks,
  );
  const maxChars = resolvePositiveInteger(
    process.env[options.maxCharsEnv],
    options.defaultMaxChars,
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

export function buildDocumentSummaryPrompt(input: {
  documentId: string;
  chunks: DocumentArtifactChunk[];
  knowledgeUnits: DocumentArtifactKnowledgeUnit[];
}): string {
  return [
    'Tu es un tuteur universitaire qui produit un résumé de révision en français.',
    'Utilise uniquement les chunks et notions fournis. N’utilise aucune connaissance externe.',
    'Le résumé doit être synthétique, utile pour réviser, et indiquer ses limites si nécessaire.',
    'Les sources autoritaires sont uniquement les sourceChunkIds choisis parmi les chunks fournis.',
    'Copie exactement les ids depuis allowedSourceChunkIds pour remplir sourceChunkIds.',
    'N utilise jamais les index, titres, pages ou ids inventés comme sourceChunkIds.',
    'Ne crée aucune citation libre et retourne uniquement du JSON conforme au schéma demandé.',
    `Document id: ${input.documentId}`,
    JSON.stringify(toPromptPayload(input)),
  ].join('\n\n');
}

export function buildRevisionSheetPrompt(input: {
  documentId: string;
  chunks: DocumentArtifactChunk[];
  knowledgeUnits: DocumentArtifactKnowledgeUnit[];
}): string {
  return [
    'Tu es un tuteur universitaire qui produit une fiche de révision structurée en français.',
    'Utilise uniquement les chunks et notions fournis. N’utilise aucune connaissance externe.',
    'Chaque section doit être pédagogique, concise et sourcée par au moins un sourceChunkId fourni.',
    'Ajoute les points clés, erreurs fréquentes, éléments indispensables et suggestions de pratique quand le contenu le permet.',
    'Les sources autoritaires sont uniquement les sourceChunkIds choisis parmi les chunks fournis.',
    'Copie exactement les ids depuis allowedSourceChunkIds pour remplir sourceChunkIds.',
    'N utilise jamais les index, titres, pages ou ids inventés comme sourceChunkIds.',
    'Ne crée aucune citation libre et retourne uniquement du JSON conforme au schéma demandé.',
    `Document id: ${input.documentId}`,
    JSON.stringify(toPromptPayload(input)),
  ].join('\n\n');
}

export function normalizeSourceChunkIds(input: {
  sourceChunkIds: string[];
  knownChunkIds: Set<string>;
  errorMessage: string;
}): string[] {
  const sourceChunkIds = [...new Set(input.sourceChunkIds)];

  if (
    sourceChunkIds.length === 0 ||
    sourceChunkIds.some((chunkId) => !input.knownChunkIds.has(chunkId))
  ) {
    throw new Error(input.errorMessage);
  }

  return sourceChunkIds;
}

function toPromptPayload(input: {
  chunks: DocumentArtifactChunk[];
  knowledgeUnits: DocumentArtifactKnowledgeUnit[];
}) {
  return {
    allowedSourceChunkIds: input.chunks.map((chunk) => chunk.id),
    chunks: input.chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
    })),
    knowledgeUnits: input.knowledgeUnits.map((unit) => ({
      id: unit.id,
      title: unit.title,
      summary: unit.summary,
      sourceChunkIds: unit.sourceChunkIds,
    })),
  };
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
