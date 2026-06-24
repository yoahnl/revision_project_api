# Genkit structured generation stability report

## Diagnostic initial

Les flows structurés critiques utilisaient déjà Genkit avec `output.schema`, mais les règles provider étaient dispersées. Gemini restait stable via le plugin Google, tandis que Mistral et MiMo passaient par le plugin OpenAI-compatible avec moins de garanties explicites autour de JSON mode, du streaming et des options provider.

Le risque principal observé était donc cohérent avec les erreurs `ERR_STREAM_PREMATURE_CLOSE` : les providers OpenAI-compatible étaient plus fragiles sur les sorties structurées longues, et les logs ne disaient pas toujours quelle stratégie avait été appliquée.

Fichiers audités :

- `src/modules/ai/infrastructure/openai-compatible-ai-provider.ts`
- `src/modules/ai/infrastructure/genkit-openai-compatible-document-knowledge.extractor.ts`
- `src/modules/ai/infrastructure/genkit-document-summary.generator.ts`
- `src/modules/ai/infrastructure/genkit-revision-sheet.generator.ts`
- `src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator.ts`
- `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts`
- `src/modules/ai/infrastructure/structured-log-ai-generation.observer.ts`
- `src/modules/ai/infrastructure/ai-error-diagnostics.ts`

## Documentation officielle vérifiée

- Genkit documente `generate()` avec `output.schema`, la validation Zod et la possibilité de retry/changer de modèle lorsque la sortie structurée échoue. Genkit documente aussi `generateStream()` pour les sorties structurées, mais les chunks peuvent être partiels.
- Mistral documente JSON mode via `response_format: { "type": "json_object" }` et recommande de demander explicitement une réponse JSON.
- MiMo documente son endpoint OpenAI-compatible avec `stream: false`, `temperature: 1.0`, `top_p: 0.95`, `max_completion_tokens` et `thinking: { "type": "disabled" }`.

## Modifications

### Provider capabilities et policy

Ajout de `src/modules/ai/infrastructure/structured-generation-policy.ts`.

La matrice centralise :

- support structured natif ;
- support JSON mode ;
- support streaming structuré ;
- support PDF ;
- support thinking ;
- taille d'entrée fiable ;
- température structurée par défaut ;
- besoin d'une instruction JSON explicite ;
- désactivation du streaming structuré.

La policy dérivée produit :

- `stream`;
- `temperature`;
- `topP`;
- `max_completion_tokens`;
- `response_format`;
- `thinking`;
- mode structuré (`native_schema`, `json_mode`, `prompt_json`);
- flags de logs et fallback.

### Mistral

Mistral utilise maintenant le resolver OpenAI-compatible custom pour appliquer la policy au niveau infrastructure.

Pour une génération structurée :

- `stream: false`;
- `temperature: 0`;
- `response_format: { type: "json_object" }`;
- instruction JSON explicite dans le prompt ;
- pas de champ `thinking`.

### MiMo

MiMo conserve le resolver custom, mais il est maintenant alimenté par la même policy.

Pour une génération structurée :

- `stream: false`;
- `temperature: 1`;
- `top_p: 0.95`;
- `max_completion_tokens: 4096`;
- `response_format: { type: "json_object" }`;
- `thinking: { type: "disabled" }`;
- instruction JSON explicite dans le prompt.

### Gemini

Gemini conserve le mode Genkit natif avec `output.schema`. Aucune instruction JSON explicite ni JSON mode OpenAI-compatible n'est ajouté à Gemini.

### Flows adaptés

Les flows suivants utilisent maintenant la policy centralisée :

- extraction de notions OpenAI-compatible ;
- génération de résumé ;
- génération de fiche ;
- génération de quiz diagnostic ;
- génération de questions fermées riches.

### Logs

Les logs de génération IA acceptent maintenant :

- `stream`;
- `structuredOutputMode`;
- `responseFormat`;
- `thinkingDisabled`;
- `attempt`;
- `maxAttempts`;
- `retryReason`;
- `repairAttempted`;
- `repairSucceeded`;
- `fallbackFrom`;
- `fallbackTo`.

Les logs restent bornés : aucun prompt complet, document complet, token ou réponse brute complète n'est ajouté.

### Retry, repair et fallback

Le lot ne crée pas un nouveau moteur global de réparation JSON. Il garde le comportement existant :

- Genkit/Zod valide les sorties ;
- les flows multi-provider utilisent le fallback existant ;
- le flow questions riches conserve sa boucle de correction déjà présente ;
- `ERR_STREAM_PREMATURE_CLOSE` est maintenant catégorisé comme erreur réseau et loggé avec `retryReason: stream_premature_close` quand un fallback est disponible.

Cette décision limite le scope et évite une refonte de la couche IA.

## Tests ajoutés ou modifiés

- `structured-generation-policy.spec.ts` couvre la matrice capabilities et la policy.
- `openai-compatible-ai-provider.spec.ts` couvre les request builders Mistral/MiMo.
- Les tests des générateurs structurés ont été adaptés pour vérifier les nouveaux champs de stratégie et le resolver Mistral.
- `structured-log-ai-generation.observer.spec.ts` vérifie les champs de stratégie sans fuite sensible.

## Résultats

Commandes exécutées :

- `npm test -- genkit-diagnostic-quiz genkit-rich-closed-question genkit-mistral-document-knowledge genkit-document-summary genkit-revision-sheet structured-generation-policy openai-compatible-ai-provider structured-log-ai-generation --runInBand` : PASS, 8 suites, 118 tests.
- `npm run build` : PASS.
- `npm run lint:check` : PASS après format ciblé.
- `npm test -- --runInBand` : PASS, 101 suites passées, 870 tests passés, 1 suite/test skip existant.
- `git diff --check` : PASS.

## Fichiers créés

- `docs/core/GENKIT_STRUCTURED_GENERATION_STABILITY_REPORT.md`
- `src/modules/ai/infrastructure/structured-generation-policy.ts`
- `src/modules/ai/infrastructure/structured-generation-policy.spec.ts`

## Fichiers modifiés

- `src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator.spec.ts`
- `src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator.ts`
- `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.spec.ts`
- `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts`
- `src/modules/ai/application/ai-generation-observer.ts`
- `src/modules/ai/infrastructure/ai-error-diagnostics.ts`
- `src/modules/ai/infrastructure/genkit-document-summary.generator.spec.ts`
- `src/modules/ai/infrastructure/genkit-document-summary.generator.ts`
- `src/modules/ai/infrastructure/genkit-mistral-document-knowledge.extractor.spec.ts`
- `src/modules/ai/infrastructure/genkit-openai-compatible-document-knowledge.extractor.ts`
- `src/modules/ai/infrastructure/genkit-revision-sheet.generator.spec.ts`
- `src/modules/ai/infrastructure/genkit-revision-sheet.generator.ts`
- `src/modules/ai/infrastructure/openai-compatible-ai-provider.spec.ts`
- `src/modules/ai/infrastructure/openai-compatible-ai-provider.ts`
- `src/modules/ai/infrastructure/structured-log-ai-generation.observer.spec.ts`
- `src/modules/ai/infrastructure/structured-log-ai-generation.observer.ts`

## Fichiers supprimés

Aucun.

## Risques connus

- La robustesse réelle MiMo dépend encore de son support effectif de `response_format` via l'API OpenAI-compatible. La documentation publique consultée confirme l'API OpenAI-compatible et les paramètres non-streaming/thinking, mais le rendu crawlé expose moins clairement l'exemple `response_format`.
- Le fallback final reste limité aux providers déjà configurés dans les flows. Ce lot ne crée pas de système d'évaluation qualité complet.
- La réparation JSON générique en une tentative reste une dette possible si les erreurs de schema persistent malgré JSON mode.

## Auto-review

- Gemini n'est pas converti en JSON mode OpenAI-compatible.
- Mistral et MiMo ne demandent plus de streaming pour les flows structurés adaptés.
- MiMo désactive `thinking` pour la sortie structurée.
- Les capacités provider sont centralisées.
- La logique provider reste en infrastructure.
- Les use cases métier ne connaissent pas Mistral/MiMo/Gemini.
- Les erreurs `ERR_STREAM_PREMATURE_CLOSE` sont mieux classifiées.
- Aucun commit n'a été effectué par Codex.

## Critique du prompt

Le prompt demandait une réparation JSON/schema générique. Dans ce codebase, l'approche la plus sûre pour ce lot était de ne pas ajouter un moteur transversal nouveau : les flows ont déjà validation Genkit/Zod, fallback provider et, pour les questions riches, une boucle de correction contextualisée. La réparation générique reste documentée comme dette plutôt qu'implémentée opportunistement.
