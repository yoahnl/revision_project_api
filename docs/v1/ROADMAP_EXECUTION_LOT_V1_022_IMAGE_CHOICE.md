# LOT V1-022 — Image choice/personnages historiques V1-D

## 1. Résultat

V1-022 est implémenté côté API et validable: le type fermé `image_choice` est ajouté au contrat rich closed avec catalogue d'assets allowlisté, IDs publics opaques, validation stricte, mapper public anti-fuite, parsing submit, scoring backend, correction post-submit, Genkit mockable, fixture V1-D à 14 questions et smoke E2E ciblé. Aucun provider IA réel, aucune migration Prisma, aucune URL image, aucun stockage arbitraire, aucun blob/base64 et aucun V1-023 n'ont été ajoutés.

## 2. Sources inspectées

- Prompt attaché V1-022: `/Users/karim/.codex/attachments/a22e5d2f-b381-4696-9a7b-c1361df50677/pasted-text.txt`.
- Core rich closed: types, fixtures, validator, mapper public, scorer, quality gate, generation profile.
- Genkit: generator et tests mockés rich closed.
- API/E2E/seed: controller activities, critical paths E2E, demo seed fixtures, plan V1 API, rapports V1-020/V1-021 existants.
- Prisma inspecté par contrainte de périmètre mais non modifié; aucune migration créée.

## 3. Préflight Git

- Repo: `/Users/karim/Project/app-révision/api`.
- Branche: `main`.
- Status initial: clean avant travaux V1-022.
- Derniers commits initiaux: `5441805 021: Intégration des QCM de calcul`, `07f6e00 020: Intégration de l'étiquetage de diagrammes`, `4f51fcd 019: Intégration de la matrice institutionnelle`.
- Repo frontend aussi modifié dans un rapport séparé: `revision_app/docs/v1/ROADMAP_EXECUTION_LOT_V1_022_IMAGE_CHOICE.md`.
- Repos non modifiés: aucun autre repo volontairement touché.

## 4. Périmètre réalisé

Backend API:

- Ajout du contrat `image_choice` dans les unions internes/publiques/réponses.
- Ajout du catalogue `rich-closed-image-assets` sans URL, storage path, base64, blob ni asset path public.
- Asset IDs publics opaques: `image-choice-historical-figure-001-v1`, `002-v1`, `003-v1`; les noms restent dans `semanticLabel` privé backend/génération.
- Validation stricte: assets connus, IDs uniques, alt text catalogue, credit/license catalogue, labels/captions non révélateurs, champs image/rendu interdits.
- Mapper public reconstruit explicitement les choices image par allowlist et ne spread pas le choix interne.
- Submit/parser/scorer: `choiceId`, erreurs sur champs privés/interdits, correction `correctChoiceId` post-submit, score backend full-correct.
- Genkit mockable: schema, prompt, repair prompt, catalog borné, interdictions URL/image générée/base64/blob/storage/widget/V1-023.
- Generation profile: mix 6/8/10/11/12/13 préservé, `image_choice` à 14.
- Fixture V1-D séparée à 14 questions et smoke E2E V1-D.

Frontend app:

- Voir rapport app dédié. L'API expose un contrat consommable par Flutter sans payload arbitraire ni ID sémantique public.

## 5. Contrat V1-D

`image_choice` interne:

- Champs communs: `id`, `questionKind: 'image_choice'`, `prompt`, `instruction?`, `difficulty`, `cognitiveSkill`, `sourceChunkIds`.
- `choices[]`: `id`, `label`, `imageAssetId`, `altText`, `caption?`, `creditLabel?`, `license?`.
- Privé: `correctChoiceId`, `explanation`.

Payload public pré-submit:

- Même shape public sans `correctChoiceId`, sans `semanticLabel`, sans `answerHint`, sans `explanation`, sans correction/score/feedback, sans URL/base64/blob/storage/render.
- Les `imageAssetId` publics sont opaques; les choices publics sont reconstruits explicitement depuis l'asset catalog.

Answer submit:

- `{ questionId, questionKind: 'image_choice', choiceId }`.

Correction post-submit:

- `{ correctChoiceId }`, avec `explanation`, `isCorrect`, `partialScore` dans l'enveloppe résultat post-submit existante.

## 6. Asset catalog / allowlist

IDs autorisés V1-022:

- `image-choice-historical-figure-001-v1` — `historical_figure`, semantic label privé `Charles de Gaulle`, alt public non révélateur, licence `internal_placeholder`.
- `image-choice-historical-figure-002-v1` — `historical_figure`, semantic label privé `Napoléon Bonaparte`, alt public non révélateur, licence `internal_placeholder`.
- `image-choice-historical-figure-003-v1` — `historical_figure`, semantic label privé `Simone Veil`, alt public non révélateur, licence `internal_placeholder`.

Provenance: assets de démonstration contrôlés, placeholders internes, aucun binaire image ajouté et aucun téléchargement effectué. Aucune URL libre n'est acceptée parce que ce type doit rester borné, testable, non arbitraire et compatible anti-fuite. Les IDs publics sont volontairement opaques pour éviter la fuite par nom de fichier.

## 7. Genkit

- Schema Zod ajouté pour `image_choice`, avec `imageAssetId` enum issu de l'allowlist.
- Prompt principal enrichi avec le catalogue borné, l'interdiction d'URL/image générée/base64/blob/storage/widget et l'interdiction V1-023+.
- Prompt de réparation mis à jour avec la shape exacte `image_choice`, labels/captions neutres et mêmes interdits.
- Mix préservé: 6 V1-A, 8 V1-017, 10 V1-018, 11 V1-019, 12 V1-020, 13 V1-021; `image_choice` entre à 14 ou via mix explicite.
- Tests Genkit restent mockés; aucun provider réel lancé.
- Genkit ne peut pas choisir un widget libre ni inventer d'asset hors enum.

## 8. Validation/scoring

Validation:

- 2 à 6 choices.
- Choice IDs uniques, `imageAssetId` uniques, IDs connus dans le catalogue.
- `altText` égal au `publicAltText` catalogué.
- `creditLabel` et `license`, si présents, cohérents avec le catalogue.
- `label` et `caption` publics ne peuvent pas reprendre un token significatif du `semanticLabel` privé.
- `correctChoiceId` doit pointer vers un choice existant.
- Rejet des champs `imageUrl`, `url`, `remoteUrl`, `src`, `href`, `storagePath`, `bucketPath`, `cdnUrl`, `base64`, `dataUri`, `blob`, `rawImage`, `assetPath`, `renderPayload`, `semanticLabel`, `answerHint`, HTML/SVG/Mermaid/widget/script/canvas/code.

Scoring:

- Full-correct: `choiceId === correctChoiceId`.
- Pas de partial score spécifique introduit.
- Correction post-submit: `correctChoiceId`.

## 9. Flutter

Voir le rapport app dédié pour les détails Flutter. Côté API, le payload public fournit uniquement `imageAssetId` opaque, label neutre, alt text public, caption/credit/license contrôlés, ce qui permet au registry Flutter de rester local et sans URL distante.

## 10. Anti-fuite / anti-URL libre

- Le mapper public retire `correctChoiceId`, `explanation`, `semanticLabel`, `answerHint`, `feedback`, `score` et tout champ `correct*`.
- Les champs URL/storage/base64/blob/render sont rejetés par validator, quality gate, submit parser/scorer et smoke E2E.
- Start/get pré-submit sont scannés récursivement en E2E et vérifient aussi l'absence de tokens d'anciens IDs sémantiques comme `de-gaulle`, `napoleon`, `simone`.
- Post-submit est autorisé à contenir correction et explication.

## 11. Accessibilité

- `altText` est obligatoire et contrôlé par le catalogue.
- Les alt texts de fixtures restent descriptifs sans nommer directement la personnalité, pour éviter une fuite pédagogique quand l'identification visuelle est testée.
- Limite documentée: cette stratégie protège le quiz mais reste imparfaite pour certains usages d'accessibilité; une future refonte devra trancher les variantes pédagogiques inclusives.

## 12. Fichiers créés/modifiés/supprimés

Créés:

- `src/modules/activities/application/rich-closed-questions/rich-closed-image-assets.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-image-assets.spec.ts`.
- `docs/v1/ROADMAP_EXECUTION_LOT_V1_022_IMAGE_CHOICE.md`.

Modifiés:

- `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-image-assets.spec.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-image-assets.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.spec.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper.spec.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-quality-gate.spec.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-quality-gate.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer.spec.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.spec.ts`.
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.ts`.
- `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.spec.ts`.
- `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts`.
- `src/modules/activities/interfaces/activities.controller.ts`.
- `src/modules/demo-seed/demo-seed.fixtures.ts`.
- `test/critical-paths.e2e-spec.ts`.

Supprimés: aucun.

## 13. Tests ajoutés ou renforcés

- Catalog image: absence URL/storage/base64/blob/assetPath et absence d'anciens tokens d'ID sémantique.
- Validator: fixture valide, choices <2/>6, IDs dupliqués, asset inconnu, asset dupliqué, altText incohérent, labels/captions révélateurs rejetés, correctChoiceId inconnu, champs URL/base64/blob/render/semantic interdits.
- Public mapper: anti-fuite, IDs publics opaques et reconstruction explicite des choices image.
- Scorer/submit: exact correct, wrong incorrect, unknown/error, champs privés interdits dont `blob`.
- Genkit: schema/prompt/catalog/mix V1-D, refus URL/image générée/base64/blob/storage/render/semantic.
- E2E: start/get public V1-D, anti-fuite des champs et anciens IDs sémantiques, submit `image_choice`, invalides DTO.

## 14. Validations lancées avec résultats

- `npm test -- rich-closed --runInBand`: OK, 10 suites, 245 tests.
- `npm test -- activities --runInBand`: OK, 19 suites passées, 1 skipped, 342 tests passés, 1 skipped.
- `npm run test:e2e -- --runInBand`: OK, 2 suites, 25 tests.
- `npm test -- revision --runInBand`: OK, 15 suites, 87 tests.
- `npm test -- revision-session --runInBand`: OK, 6 suites, 41 tests.
- `npm test -- revision-sessions --runInBand`: OK, 6 suites, 41 tests.
- `npm run lint:check`: OK après les corrections finales.
- `npm run build`: OK.
- `git diff --check`: OK après régénération finale des rapports.

## 15. Validations non lancées avec justification

- Aucun provider IA réel: explicitement interdit, tests Genkit mockés.
- Aucune migration Prisma/prod: non nécessaire et explicitement évitée.
- Aucun Dokploy: explicitement interdit.
- Aucun téléchargement d'asset ou vérification réseau d'image: interdit par le périmètre V1-022.

## 16. Risques restants

- Les assets sont des placeholders allowlistés sans binaire image réel; l'UI consommera un fallback jusqu'au branchement d'assets locaux avec provenance.
- Le compromis alt text/accessibilité protège la correction mais peut être moins informatif pour des utilisateurs non voyants; il faudra une décision produit dédiée si on teste l'identification visuelle.
- Le catalogue est volontairement petit; l'extension devra rester gouvernée par provenance/licence et conserver des IDs publics opaques.

## 17. Recommandation prochain lot

V1-023 — Runbook demo V1 est recommandé. Aucun bis bloquant n'est nécessaire côté API pour V1-022, sous réserve d'accepter le risque connu des placeholders sans bitmap réel.

## 18. Passes de review

Sub-agents/reviews exécutés en lecture seule:

- Backend contract + asset catalog: a trouvé la fuite possible via IDs/labels publics; corrigé par IDs opaques et validation label/caption.
- Genkit/schema: a trouvé la fuite possible via label/caption; corrigé par prompt + validation + tests.
- Scoring/mapper anti-fuite: a trouvé la fuite via `imageAssetId`; corrigé et couvert en E2E.
- Flutter parser/widget: verdict validable, amélioration semantics appliquée côté app.
- Tests/sécurité: a trouvé `blob` manquant et prompt “image générée” incomplet; corrigé dans API, app et tests.

Passes finales:

- Backend contract: union, DTO, submit et correction vérifiés.
- Asset catalog: IDs bornés opaques, semantic label privé, aucun URL/storage/base64/blob.
- Backend Genkit/schema: enum catalogue, prompt anti-URL/image générée/blob/widget/V1-023, mix 14.
- Backend scoring/validation: full-correct, rejets stricts, aucune formule libre.
- Public mapper anti-fuite: reconstruction explicite, pas de spread de choice image.
- Anti-URL libre: validator, quality gate, scorer, controller, E2E.
- Tests: unitaires, Genkit mocké, E2E, lint/build.
- Sécurité: pas de secret, pas de provider IA réel, pas de migration, pas de Dokploy.

## 19. Critique honnête du prompt initial

Le prompt est cohérent et utilement strict. Les reviews ont révélé deux angles morts que le prompt permettait d'identifier: la fuite par ID public sémantique et l'oubli initial de `blob`. La seule tension produit restante est l'accessibilité: un alt text très descriptif peut révéler la réponse, tandis qu'un alt text neutre peut moins bien servir certains utilisateurs. V1-022 documente cette limite au lieu de prétendre la résoudre. Le prompt autorise explicitement l'auto-exclusion du rapport courant dans l'annexe, ce qui évite une récursion impossible.

## 20. Contenu complet des fichiers créés/modifiés/supprimés

Le rapport courant est listé en section 12 mais n'est pas inclus ci-dessous afin d'éviter la récursion infinie, comme autorisé par le prompt. Aucun fichier supprimé.

### docs/v1/ROADMAP_EXECUTION_PLAN_V1.md

~~~~md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot     | Intitulé                                   | Statut  | Rapport                                                                             |
| ------- | ------------------------------------------ | ------- | ----------------------------------------------------------------------------------- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md            |
| V1-013  | Today integration V1                       | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md                        |
| V1-014  | Revision session integration V1            | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md             |
| V1-015  | Rich demo fixtures V1                      | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md                |
| V1-016  | E2E/smoke rich questions V1                | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md                |
| V1-017  | Timeline/date slider V1-B                  | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_017_TIMELINE_DATE_SLIDER.md                        |
| V1-018  | True/false grid + cause/consequence V1-B   | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_018_TRUE_FALSE_GRID_CAUSE_CONSEQUENCE.md           |
| V1-019  | Institution matrix V1-C                    | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_019_INSTITUTION_MATRIX.md                          |
| V1-020  | Diagram labeling V1-C                      | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_020_DIAGRAM_LABELING.md                            |
| V1-021  | Calculation MCQ modes de scrutin V1-C      | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_021_CALCULATION_MCQ.md                             |
| V1-022  | Image choice/personnages historiques V1-D  | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_022_IMAGE_CHOICE.md                                |

## Lots détaillés

### V1-012C — Backend diagnostics génération rich closed

- Objectif : diagnostiquer et fiabiliser les échecs Genkit rich closed.
- Pourquoi maintenant : la page front existe mais la génération backend échoue en runtime avec `RICH_CLOSED_GENERATION_CONTRACT_INVALID`.
- Périmètre inclus : diagnostics metadata-only, catégorisation des rejets, prompt de réparation sur modèle fallback configuré, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md`.

### V1-012D — Dokploy runtime fix génération rich closed

- Objectif : vérifier le runtime Dokploy réel et rendre `RICH_CLOSED_GENERATION_SCHEMA_INVALID` exploitable.
- Pourquoi maintenant : V1-012C est déployé, mais le fallback Mistral échoue encore avec un diagnostic schema trop pauvre.
- Périmètre inclus : inspection Dokploy, prompt strict, diagnostics schema imbriqués, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics, redeploy sans commit déployable.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md`.

### V1-013 — Today integration V1

- Objectif : permettre à Today de recommander une action déterministe `rich_closed_exercise`.
- Pourquoi maintenant : la page rich closed complète existe et peut prendre le relais au clic utilisateur.
- Périmètre inclus : contrat Today, sélection déterministe, propagation optionnelle de `documentId`, tests Today/revision/activities.
- Non-objectifs : Genkit depuis Today, revision sessions, endpoints rich closed, Prisma schema ou migration.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md`.

### V1-014 — Revision session integration V1

- Objectif : permettre aux sessions de révision de proposer l'action bornée `RICH_CLOSED_EXERCISE`.
- Pourquoi maintenant : le flow rich closed V1-A existe et Today sait déjà le recommander.
- Périmètre inclus : contrat session, coach next-action, persistance enum, contrôleur, tests anti-fuite.
- Non-objectifs : génération de questions rich closed depuis la session, rendu de widget arbitraire, correction pré-submit, provider IA réel dans les tests.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md`.

### V1-015 — Rich demo fixtures V1

- Objectif : disposer d'un seed démo riche fermé V1-A stable, rejouable et synthétique.
- Pourquoi maintenant : les parcours Today, sessions de révision et rich closed sont intégrés, mais il manquait un jeu démo persistant couvrant les 6 types fermés riches.
- Périmètre inclus : fixture `Droit constitutionnel`, notion `Régime parlementaire rationalisé`, chunks/sources synthétiques, session `RICH_CLOSED_EXERCISE`, payload rich closed V1-A à 6 questions, dry-run non destructif.
- Non-objectifs : migration Prisma, provider IA réel, reset ou suppression de données, nouveau type de question.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`.

### V1-016 — E2E/smoke rich questions V1

- Objectif : protéger le contrat HTTP rich closed V1-A et les launchers Today/session de révision.
- Pourquoi maintenant : le seed démo doit être validable et les parcours intégrés doivent garantir l'absence de fuite pré-submit.
- Périmètre inclus : smoke `/activities/rich-closed/start`, get, result avant submit, submit, result après submit, invalides, Today rich closed, revision session rich closed, anti-fuite récursif.
- Non-objectifs : refonte frontend, génération Genkit réelle, widgets libres, V1-017.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`.

### V1-017 — Timeline/date slider V1-B

- Objectif : ajouter les types rich closed fermés `timeline` et `date_slider`.
- Pourquoi maintenant : V1-A, Today, revision sessions, seed et smoke sont stabilisés.
- Périmètre inclus : contrat backend, validation, mapper public anti-fuite, scoring, Genkit mockable, fixture V1-B dédiée, smoke E2E.
- Non-objectifs : V1-018, widgets libres, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_017_TIMELINE_DATE_SLIDER.md`.

### V1-018 — True/false grid + cause/consequence V1-B

- Objectif : ajouter les types rich closed fermés `true_false_grid` et `cause_consequence`.
- Pourquoi maintenant : V1-017 a stabilisé les extensions V1-B `timeline` et `date_slider`; le moteur peut accueillir deux interactions fermées supplémentaires.
- Périmètre inclus : contrat backend, validation, mapper public anti-fuite, parsing submit, scoring, correction post-submit, Genkit mockable, fixture V1-B full dédiée, smoke E2E.
- Non-objectifs : V1-019, `institution_matrix`, `diagram_labeling`, `calculation_mcq`, `image_choice`, widgets libres, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_018_TRUE_FALSE_GRID_CAUSE_CONSEQUENCE.md`.

### V1-019 — Institution matrix V1-C

- Objectif : ajouter le type rich closed fermé `institution_matrix`.
- Pourquoi maintenant : V1-018 a stabilisé les interactions fermées à cellules/paires, ce qui permet d'introduire une matrice institutionnelle bornée.
- Périmètre inclus : contrat backend, validation stricte rows/columns/cells/options, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-C dédiée, smoke E2E.
- Non-objectifs : V1-020, `diagram_labeling`, `calculation_mcq`, `image_choice`, `fill_blank_dropdown`, widgets libres, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_019_INSTITUTION_MATRIX.md`.

### V1-020 — Diagram labeling V1-C

- Objectif : ajouter le type rich closed fermé `diagram_labeling`.
- Pourquoi maintenant : V1-019 a stabilisé les matrices institutionnelles fermées; le moteur peut accepter un schéma textuel borné sans rendu arbitraire.
- Périmètre inclus : contrat backend diagram/nodes/edges/slots/options, validation stricte, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-C full dédiée, smoke E2E.
- Non-objectifs : V1-021, `calculation_mcq`, `image_choice`, `fill_blank_dropdown`, HTML/SVG/Mermaid/Canvas/image URL/widget libre, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_020_DIAGRAM_LABELING.md`.

### V1-021 — Calculation MCQ modes de scrutin V1-C

- Objectif : ajouter le type rich closed fermé `calculation_mcq` pour calculs bornés de modes de scrutin.
- Pourquoi maintenant : V1-020 a stabilisé le dernier type V1-C non calculatoire; on peut ajouter un QCM calculé sans ouvrir de formule libre.
- Périmètre inclus : contrat backend, validation stricte des deux modes autorisés, recalcul déterministe backend, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-C calculation dédiée, smoke E2E.
- Non-objectifs : V1-022, `image_choice`, `fill_blank_dropdown`, formule libre, eval/Function/parser d'expression, D'Hondt, Sainte-Laguë, seuils électoraux, votes blancs/nuls, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_021_CALCULATION_MCQ.md`.

### V1-022 — Image choice/personnages historiques V1-D

- Objectif : ajouter le type rich closed fermé `image_choice`.
- Pourquoi maintenant : V1-021 a stabilisé les QCM calculés; on peut ouvrir un choix d'image borné sans URL distante ni widget libre.
- Périmètre inclus : catalogue contrôlé d'assets image, contrat backend, validation stricte des choix et IDs allowlistés, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-D dédiée, smoke E2E.
- Non-objectifs : V1-023, `fill_blank_dropdown`, upload d'images, URL distante, base64, storage path, rendu libre, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_022_IMAGE_CHOICE.md`.

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-image-assets.spec.ts

~~~~ts
import {
  RICH_CLOSED_IMAGE_ASSETS,
  getRichClosedImageAsset,
  isRichClosedImageAssetId,
} from './rich-closed-image-assets';

describe('rich closed image assets', () => {
  it('exposes a small allowlisted catalog without URL or storage fields', () => {
    expect(RICH_CLOSED_IMAGE_ASSETS).toHaveLength(3);

    for (const asset of RICH_CLOSED_IMAGE_ASSETS) {
      expect(asset.id).toMatch(/-v1$/);
      expect(asset.publicAltText.trim()).toBe(asset.publicAltText);
      expect(asset.publicAltText.length).toBeGreaterThan(10);
      expect(asset.license).toBe('internal_placeholder');
    }

    const serialized = JSON.stringify(RICH_CLOSED_IMAGE_ASSETS);
    expect(serialized).not.toContain('url');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('dataUri');
    expect(serialized).not.toContain('blob');
    expect(serialized).not.toContain('assetPath');
    expect(serialized).not.toContain('de-gaulle');
    expect(serialized).not.toContain('napoleon');
    expect(serialized).not.toContain('simone');
  });

  it('resolves only known image asset ids', () => {
    expect(
      isRichClosedImageAssetId('image-choice-historical-figure-001-v1'),
    ).toBe(true);
    expect(
      getRichClosedImageAsset('image-choice-historical-figure-001-v1'),
    ).toEqual(
      expect.objectContaining({
        semanticLabel: 'Charles de Gaulle',
        publicAltText:
          'Portrait historique en noir et blanc d’un homme en uniforme.',
      }),
    );
    expect(isRichClosedImageAssetId('https://example.test/image.png')).toBe(
      false,
    );
    expect(getRichClosedImageAsset('unknown-asset')).toBeNull();
  });
});

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-image-assets.ts

~~~~ts
export type RichClosedImageAssetKind =
  | 'historical_figure'
  | 'institution'
  | 'symbol'
  | 'document';

export type RichClosedImageAssetLicense =
  | 'public_domain'
  | 'own_generated'
  | 'open_license'
  | 'internal_placeholder';

export interface RichClosedImageAsset {
  id: string;
  kind: RichClosedImageAssetKind;
  semanticLabel: string;
  publicAltText: string;
  creditLabel?: string | null;
  license: RichClosedImageAssetLicense;
}

export const RICH_CLOSED_IMAGE_ASSETS = [
  {
    id: 'image-choice-historical-figure-001-v1',
    kind: 'historical_figure',
    semanticLabel: 'Charles de Gaulle',
    publicAltText:
      'Portrait historique en noir et blanc d’un homme en uniforme.',
    creditLabel: 'Asset de démonstration contrôlé',
    license: 'internal_placeholder',
  },
  {
    id: 'image-choice-historical-figure-002-v1',
    kind: 'historical_figure',
    semanticLabel: 'Napoléon Bonaparte',
    publicAltText: 'Portrait peint d’un homme en tenue impériale.',
    creditLabel: 'Asset de démonstration contrôlé',
    license: 'internal_placeholder',
  },
  {
    id: 'image-choice-historical-figure-003-v1',
    kind: 'historical_figure',
    semanticLabel: 'Simone Veil',
    publicAltText: 'Portrait historique d’une femme politique.',
    creditLabel: 'Asset de démonstration contrôlé',
    license: 'internal_placeholder',
  },
] as const satisfies readonly RichClosedImageAsset[];

export const RICH_CLOSED_IMAGE_ASSET_IDS = RICH_CLOSED_IMAGE_ASSETS.map(
  (asset) => asset.id,
) as [string, ...string[]];

const RICH_CLOSED_IMAGE_ASSETS_BY_ID = new Map<string, RichClosedImageAsset>(
  RICH_CLOSED_IMAGE_ASSETS.map((asset) => [asset.id, asset]),
);

export function isRichClosedImageAssetId(value: string): boolean {
  return RICH_CLOSED_IMAGE_ASSETS_BY_ID.has(value);
}

export function getRichClosedImageAsset(
  id: string,
): RichClosedImageAsset | null {
  return RICH_CLOSED_IMAGE_ASSETS_BY_ID.get(id) ?? null;
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.spec.ts

~~~~ts
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';
import {
  RICH_CLOSED_QUESTION_COUNT_INVALID,
  resolveRichClosedQuestionTypeMix,
} from './rich-closed-question-generation-profile';

describe('rich closed question generation profile', () => {
  it('returns the exact balanced V1-A mix for six questions', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 6 })).toEqual({
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 0,
      date_slider: 0,
      true_false_grid: 0,
      cause_consequence: 0,
      institution_matrix: 0,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('keeps V1-B out of the default mix below eight questions', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 7 });

    expect(mix.timeline).toBe(0);
    expect(mix.date_slider).toBe(0);
    expect(mix.true_false_grid).toBe(0);
    expect(mix.cause_consequence).toBe(0);
    expect(mix.institution_matrix).toBe(0);
    expect(mix.diagram_labeling).toBe(0);
    expect(mix.calculation_mcq).toBe(0);
    expect(mix.image_choice).toBe(0);
    expect(sumMix(mix)).toBe(7);
  });

  it('preserves the V1-017 default mix for eight questions', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 8 })).toEqual({
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 0,
      cause_consequence: 0,
      institution_matrix: 0,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('keeps V1-018 types out of the default nine-question mix', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 9 });

    expect(mix.timeline).toBeGreaterThan(0);
    expect(mix.date_slider).toBeGreaterThan(0);
    expect(mix.true_false_grid).toBe(0);
    expect(mix.cause_consequence).toBe(0);
    expect(mix.institution_matrix).toBe(0);
    expect(mix.diagram_labeling).toBe(0);
    expect(mix.calculation_mcq).toBe(0);
    expect(mix.image_choice).toBe(0);
    expect(sumMix(mix)).toBe(9);
  });

  it('preserves the expected V1-B full mix for ten questions', () => {
    expect(
      resolveRichClosedQuestionTypeMix({
        questionCount: 10,
        complexityProfile: 'exam',
      }),
    ).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 0,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('preserves the V1-019 default mix for eleven questions', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 11 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 0,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('adds diagram_labeling only from the twelve-question default mix', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 12 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 0,
      image_choice: 0,
    });
  });

  it('adds calculation_mcq only from the thirteen-question default mix', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 13 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
      image_choice: 0,
    });
  });

  it('adds image_choice only from the fourteen-question default mix', () => {
    expect(resolveRichClosedQuestionTypeMix({ questionCount: 14 })).toEqual({
      case_qualification: 1,
      error_detection: 1,
      matching: 1,
      ordering: 1,
      multiple_choice: 1,
      single_choice: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
      image_choice: 1,
    });
  });

  it('always sums exactly to the requested question count', () => {
    for (const questionCount of [1, 3, 6, 7, 10, 13, 14, 20]) {
      const mix = resolveRichClosedQuestionTypeMix({ questionCount });

      expect(sumMix(mix)).toBe(questionCount);
    }
  });

  it('never returns a type outside the rich closed allowlist', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 14 });
    const allowedKinds = new Set<string>(RICH_CLOSED_QUESTION_KINDS);

    expect(Object.keys(mix).every((kind) => allowedKinds.has(kind))).toBe(true);
  });

  it('does not let single_choice dominate generated exercises', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 14 });

    expect((mix.single_choice ?? 0) / 14).toBeLessThanOrEqual(0.4);
  });

  it('treats small question counts as rich closed exercises without defaulting to single_choice', () => {
    const mix = resolveRichClosedQuestionTypeMix({ questionCount: 3 });

    expect(sumMix(mix)).toBe(3);
    expect(mix.single_choice ?? 0).toBe(0);
    expect((mix.case_qualification ?? 0) + (mix.error_detection ?? 0)).toBe(2);
  });

  it('rejects unsupported question counts explicitly', () => {
    expect(() =>
      resolveRichClosedQuestionTypeMix({ questionCount: 0 }),
    ).toThrow(RICH_CLOSED_QUESTION_COUNT_INVALID);
    expect(() =>
      resolveRichClosedQuestionTypeMix({ questionCount: 21 }),
    ).toThrow(RICH_CLOSED_QUESTION_COUNT_INVALID);
  });
});

function sumMix(mix: Partial<Record<RichClosedQuestionKind, number>>): number {
  return Object.values(mix).reduce((total, count) => total + count, 0);
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.ts

~~~~ts
import type { RichClosedQuestionKind } from './rich-closed-question.types';
import type { RichClosedComplexityProfile } from './rich-closed-question-generator';

export const RICH_CLOSED_QUESTION_COUNT_INVALID =
  'RICH_CLOSED_QUESTION_COUNT_INVALID';

const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;
const MAX_SINGLE_CHOICE_RATIO = 0.4;
const V1A_FULL_EXERCISE_COUNT = 6;
const V1B_017_FULL_EXERCISE_COUNT = 8;
const V1B_018_FULL_EXERCISE_COUNT = 10;
const V1C_019_FULL_EXERCISE_COUNT = 11;
const V1C_020_FULL_EXERCISE_COUNT = 12;
const V1C_021_FULL_EXERCISE_COUNT = 13;
const V1D_022_FULL_EXERCISE_COUNT = 14;

const SMALL_EXERCISE_KIND_ORDER: RichClosedQuestionKind[] = [
  'case_qualification',
  'error_detection',
  'matching',
  'ordering',
  'multiple_choice',
];

const FULL_EXERCISE_BASE_MIX: Record<RichClosedQuestionKind, number> = {
  single_choice: 1,
  multiple_choice: 1,
  matching: 1,
  ordering: 1,
  case_qualification: 1,
  error_detection: 1,
  timeline: 0,
  date_slider: 0,
  true_false_grid: 0,
  cause_consequence: 0,
  institution_matrix: 0,
  diagram_labeling: 0,
  calculation_mcq: 0,
  image_choice: 0,
};

const FULL_EXERCISE_V1B_BASE_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_BASE_MIX,
  timeline: 1,
  date_slider: 1,
};

const FULL_EXERCISE_V1B_FULL_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_V1B_BASE_MIX,
  true_false_grid: 1,
  cause_consequence: 1,
};

const FULL_EXERCISE_V1C_FULL_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_V1B_FULL_MIX,
  institution_matrix: 1,
};

const FULL_EXERCISE_V1C_DIAGRAM_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_V1C_FULL_MIX,
  diagram_labeling: 1,
};

const FULL_EXERCISE_V1C_CALCULATION_MIX: Record<
  RichClosedQuestionKind,
  number
> = {
  ...FULL_EXERCISE_V1C_DIAGRAM_MIX,
  calculation_mcq: 1,
};

const FULL_EXERCISE_V1D_IMAGE_MIX: Record<RichClosedQuestionKind, number> = {
  ...FULL_EXERCISE_V1C_CALCULATION_MIX,
  image_choice: 1,
};

const DISTRIBUTION_ORDER_BY_PROFILE: Record<
  RichClosedComplexityProfile,
  RichClosedQuestionKind[]
> = {
  standard: [
    'case_qualification',
    'error_detection',
    'matching',
    'multiple_choice',
    'ordering',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
    'image_choice',
    'single_choice',
  ],
  exam: [
    'case_qualification',
    'error_detection',
    'matching',
    'multiple_choice',
    'ordering',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
    'image_choice',
    'single_choice',
  ],
  advanced: [
    'case_qualification',
    'error_detection',
    'ordering',
    'matching',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
    'image_choice',
    'multiple_choice',
    'single_choice',
  ],
};

export interface RichClosedQuestionTypeMixInput {
  questionCount: number;
  complexityProfile?: RichClosedComplexityProfile;
}

export function resolveRichClosedQuestionTypeMix(
  input: RichClosedQuestionTypeMixInput,
): Record<RichClosedQuestionKind, number> {
  if (
    !Number.isInteger(input.questionCount) ||
    input.questionCount < MIN_QUESTION_COUNT ||
    input.questionCount > MAX_QUESTION_COUNT
  ) {
    throw new Error(RICH_CLOSED_QUESTION_COUNT_INVALID);
  }

  if (input.questionCount < V1A_FULL_EXERCISE_COUNT) {
    return buildSmallExerciseMix(input.questionCount);
  }

  const usesV1D022Base = input.questionCount >= V1D_022_FULL_EXERCISE_COUNT;
  const usesV1C021Base =
    !usesV1D022Base && input.questionCount >= V1C_021_FULL_EXERCISE_COUNT;
  const usesV1C020Base =
    !usesV1D022Base &&
    !usesV1C021Base &&
    input.questionCount >= V1C_020_FULL_EXERCISE_COUNT;
  const usesV1C019Base =
    !usesV1D022Base &&
    !usesV1C021Base &&
    !usesV1C020Base &&
    input.questionCount >= V1C_019_FULL_EXERCISE_COUNT;
  const usesV1B018Base =
    !usesV1D022Base &&
    !usesV1C021Base &&
    !usesV1C020Base &&
    !usesV1C019Base &&
    input.questionCount >= V1B_018_FULL_EXERCISE_COUNT;
  const usesV1B017Base =
    !usesV1D022Base &&
    !usesV1C021Base &&
    !usesV1C020Base &&
    !usesV1C019Base &&
    !usesV1B018Base &&
    input.questionCount >= V1B_017_FULL_EXERCISE_COUNT;
  const mix = usesV1D022Base
    ? { ...FULL_EXERCISE_V1D_IMAGE_MIX }
    : usesV1C021Base
      ? { ...FULL_EXERCISE_V1C_CALCULATION_MIX }
      : usesV1C020Base
        ? { ...FULL_EXERCISE_V1C_DIAGRAM_MIX }
        : usesV1C019Base
          ? { ...FULL_EXERCISE_V1C_FULL_MIX }
          : usesV1B018Base
            ? { ...FULL_EXERCISE_V1B_FULL_MIX }
            : usesV1B017Base
              ? { ...FULL_EXERCISE_V1B_BASE_MIX }
              : { ...FULL_EXERCISE_BASE_MIX };
  const profile = input.complexityProfile ?? 'standard';
  let remaining =
    input.questionCount -
    (usesV1D022Base
      ? V1D_022_FULL_EXERCISE_COUNT
      : usesV1C021Base
        ? V1C_021_FULL_EXERCISE_COUNT
        : usesV1C020Base
          ? V1C_020_FULL_EXERCISE_COUNT
          : usesV1C019Base
            ? V1C_019_FULL_EXERCISE_COUNT
            : usesV1B018Base
              ? V1B_018_FULL_EXERCISE_COUNT
              : usesV1B017Base
                ? V1B_017_FULL_EXERCISE_COUNT
                : V1A_FULL_EXERCISE_COUNT);
  let cursor = 0;

  while (remaining > 0) {
    const kind = DISTRIBUTION_ORDER_BY_PROFILE[profile][cursor];
    if (
      kind !== 'single_choice' ||
      (mix.single_choice + 1) / input.questionCount <= MAX_SINGLE_CHOICE_RATIO
    ) {
      mix[kind] += 1;
      remaining -= 1;
    }
    cursor = (cursor + 1) % DISTRIBUTION_ORDER_BY_PROFILE[profile].length;
  }

  return mix;
}

function buildSmallExerciseMix(
  questionCount: number,
): Record<RichClosedQuestionKind, number> {
  const mix = emptyMix();

  for (let index = 0; index < questionCount; index += 1) {
    mix[SMALL_EXERCISE_KIND_ORDER[index]] += 1;
  }

  return mix;
}

function emptyMix(): Record<RichClosedQuestionKind, number> {
  return {
    single_choice: 0,
    multiple_choice: 0,
    matching: 0,
    ordering: 0,
    case_qualification: 0,
    error_detection: 0,
    timeline: 0,
    date_slider: 0,
    true_false_grid: 0,
    cause_consequence: 0,
    institution_matrix: 0,
    diagram_labeling: 0,
    calculation_mcq: 0,
    image_choice: 0,
  };
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper.spec.ts

~~~~ts
import {
  toRichClosedPublicExercise,
  toRichClosedPublicQuestion,
} from './rich-closed-question-public.mapper';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from './rich-closed-question.fixtures';
import type {
  RichClosedCalculationMcqQuestion,
  RichClosedImageChoiceQuestion,
} from './rich-closed-question.types';

describe('rich closed question public mapper', () => {
  it.each([
    'single_choice',
    'multiple_choice',
    'matching',
    'ordering',
    'case_qualification',
    'error_detection',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
    'image_choice',
  ] as const)('maps %s without leaking correction fields', (questionKind) => {
    const publicQuestion = toRichClosedPublicQuestion(
      richClosedQuestionFixture(questionKind),
    );
    const serialized = JSON.stringify(publicQuestion);

    expect(publicQuestion.questionKind).toBe(questionKind);
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('correctChoiceIds');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('correctErrorId');
    expect(serialized).not.toContain('expectedValue');
    expect(serialized).not.toContain('workedSteps');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('rawSvg');
    expect(serialized).not.toContain('mermaid');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('semanticLabel');
    expect(serialized).not.toContain('imageUrl');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('base64');
  });

  it('maps a full exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.version).toBe('rich-closed-question-v1');
    expect(publicExercise.questions).toHaveLength(6);
    expect(serialized).not.toContain('correct');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-B exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1BExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(8);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
    ]);
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-B full exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1BFullExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(10);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
      'true_false_grid',
      'cause_consequence',
    ]);
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-C exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1CExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(11);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
      'true_false_grid',
      'cause_consequence',
      'institution_matrix',
    ]);
    expect(serialized).toContain('cells');
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-C full diagram exercise without leaking private correction or render payloads', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1CFullExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(12);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
      'true_false_grid',
      'cause_consequence',
      'institution_matrix',
      'diagram_labeling',
    ]);
    expect(serialized).toContain('diagram');
    expect(serialized).toContain('slots');
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
    expect(serialized).not.toContain('rawSvg');
    expect(serialized).not.toContain('mermaid');
    expect(serialized).not.toContain('widget');
    expect(serialized).not.toContain('renderPayload');
  });

  it('maps a V1-C calculation exercise without leaking private calculations or formulas', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1CCalculationExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(13);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toContain('calculation_mcq');
    expect(serialized).toContain('scenario');
    expect(serialized).toContain('calculation');
    expect(serialized).toContain('choices');
    expect(serialized).toContain('value');
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('expectedValue');
    expect(serialized).not.toContain('workedSteps');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('formula');
    expect(serialized).not.toContain('expression');
    expect(serialized).not.toContain('calculationCode');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('score');
  });

  it('allowlists nested calculation fields before submit', () => {
    const fixture = richClosedQuestionFixture(
      'calculation_mcq',
    ) as RichClosedCalculationMcqQuestion;
    const calculation = {
      ...fixture.calculation,
      correctChoiceId: 'nested-correct-choice-leak',
      expectedValue: 999,
      formula: 'Math.floor(validVotes / 2) + 1',
      renderPayload: { widget: 'free' },
    } as RichClosedCalculationMcqQuestion['calculation'];
    const choices = fixture.choices.map((choice) => ({
      ...choice,
      correctChoiceId: 'choice-correction-leak',
      workedSteps: [{ id: 'private-step', label: 'Private step' }],
      expression: 'validVotes / 2',
    })) as RichClosedCalculationMcqQuestion['choices'];
    const question: RichClosedCalculationMcqQuestion = {
      ...fixture,
      calculation,
      choices,
    };

    const publicQuestion = toRichClosedPublicQuestion(question);
    const serialized = JSON.stringify(publicQuestion);

    expect(serialized).toContain('calculation');
    expect(serialized).toContain('choices');
    expect(serialized).toContain('value');
    expect(serialized).not.toContain('nested-correct-choice-leak');
    expect(serialized).not.toContain('choice-correction-leak');
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('expectedValue');
    expect(serialized).not.toContain('workedSteps');
    expect(serialized).not.toContain('formula');
    expect(serialized).not.toContain('expression');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('widget');
  });

  it('maps a V1-D image choice exercise without leaking private image data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1DImageChoiceExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(14);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toContain('image_choice');
    expect(serialized).toContain('imageAssetId');
    expect(serialized).toContain('altText');
    expect(serialized).toContain('internal_placeholder');
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('semanticLabel');
    expect(serialized).not.toContain('answerHint');
    expect(serialized).not.toContain('imageUrl');
    expect(serialized).not.toContain('url');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('blob');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('de-gaulle');
    expect(serialized).not.toContain('napoleon');
    expect(serialized).not.toContain('simone');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('score');
  });

  it('allowlists nested image choice fields before submit', () => {
    const fixture = richClosedQuestionFixture(
      'image_choice',
    ) as RichClosedImageChoiceQuestion;
    const choices = fixture.choices.map((choice) => ({
      ...choice,
      correctChoiceId: 'choice-correction-leak',
      semanticLabel: 'Charles de Gaulle',
      answerHint: 'appel du 18 juin',
      imageUrl: 'https://example.test/image.png',
      storagePath: 'gs://bucket/image.png',
      base64: 'iVBORw0KGgo=',
      blob: 'blob://unsafe',
      renderPayload: { widget: 'free' },
      feedback: 'private feedback',
    })) as RichClosedImageChoiceQuestion['choices'];
    const question: RichClosedImageChoiceQuestion = {
      ...fixture,
      choices,
    };

    const publicQuestion = toRichClosedPublicQuestion(question);
    const serialized = JSON.stringify(publicQuestion);

    expect(serialized).toContain('imageAssetId');
    expect(serialized).toContain('altText');
    expect(serialized).toContain('Asset de démonstration contrôlé');
    expect(serialized).not.toContain('choice-correction-leak');
    expect(serialized).not.toContain('semanticLabel');
    expect(serialized).not.toContain('answerHint');
    expect(serialized).not.toContain('imageUrl');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('blob');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('feedback');
  });

  it('removes internal choice feedback from public choice payloads', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      choices: [
        {
          id: 'choice-a',
          label: 'La responsabilité politique',
          feedback: 'Ce feedback reste privé avant submit.',
        },
        {
          id: 'choice-b',
          label: 'La séparation totalement étanche',
          feedback: 'Feedback privé également.',
        },
      ],
    };

    const publicQuestion = toRichClosedPublicQuestion(question);
    const serialized = JSON.stringify(publicQuestion);

    expect(serialized).not.toContain('feedback');
    expect(serialized).not.toContain('Ce feedback reste privé avant submit.');
    expect(serialized).not.toContain('Feedback privé également.');
  });
});

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper.ts

~~~~ts
import type {
  RichClosedExercise,
  RichClosedCalculationData,
  RichClosedCalculationChoice,
  RichClosedDiagram,
  RichClosedDiagramLabelingSlot,
  RichClosedImageChoiceOption,
  RichClosedPublicChoice,
  RichClosedPublicExercise,
  RichClosedPublicExerciseEnvelope,
  RichClosedPublicQuestion,
  RichClosedQuestion,
} from './rich-closed-question.types';
import { getRichClosedImageAsset } from './rich-closed-image-assets';

export function toRichClosedPublicExercise(
  exercise: RichClosedExercise,
): RichClosedPublicExercise {
  return {
    id: exercise.id,
    version: exercise.version,
    title: exercise.title,
    ...(exercise.subjectId === undefined
      ? {}
      : { subjectId: exercise.subjectId }),
    ...(exercise.documentId === undefined
      ? {}
      : { documentId: exercise.documentId }),
    ...(exercise.knowledgeUnitId === undefined
      ? {}
      : { knowledgeUnitId: exercise.knowledgeUnitId }),
    questions: exercise.questions.map(toRichClosedPublicQuestion),
  };
}

export function toRichClosedPublicExerciseEnvelope(input: {
  sessionId: string;
  exercise: RichClosedExercise;
}): RichClosedPublicExerciseEnvelope {
  return {
    sessionId: input.sessionId,
    type: 'rich_closed_exercise',
    ...toRichClosedPublicExercise(input.exercise),
  };
}

export function toRichClosedPublicQuestion(
  question: RichClosedQuestion,
): RichClosedPublicQuestion {
  const base = {
    id: question.id,
    questionKind: question.questionKind,
    prompt: question.prompt,
    difficulty: question.difficulty,
    cognitiveSkill: question.cognitiveSkill,
    sourceChunkIds: [...question.sourceChunkIds],
  };

  switch (question.questionKind) {
    case 'single_choice':
      return {
        ...base,
        questionKind: question.questionKind,
        choices: publicChoices(question.choices),
      };
    case 'multiple_choice':
      return {
        ...base,
        questionKind: question.questionKind,
        choices: publicChoices(question.choices),
        minSelections: question.minSelections,
        maxSelections: question.maxSelections,
      };
    case 'matching':
      return {
        ...base,
        questionKind: question.questionKind,
        leftItems: cloneLabelItems(question.leftItems),
        rightItems: cloneLabelItems(question.rightItems),
      };
    case 'ordering':
      return {
        ...base,
        questionKind: question.questionKind,
        items: cloneLabelItems(question.items),
      };
    case 'timeline':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        events: cloneTimelineEvents(question.events),
      };
    case 'date_slider':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        minYear: question.minYear,
        maxYear: question.maxYear,
        step: question.step,
        toleranceYears: question.toleranceYears,
      };
    case 'true_false_grid':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        rows: cloneTrueFalseRows(question.rows),
      };
    case 'cause_consequence':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        causes: cloneDescribedLabelItems(question.causes),
        consequences: cloneDescribedLabelItems(question.consequences),
      };
    case 'institution_matrix':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        rows: cloneDescribedLabelItems(question.rows),
        columns: cloneDescribedLabelItems(question.columns),
        cells: cloneInstitutionMatrixCells(question.cells),
      };
    case 'diagram_labeling':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        diagram: cloneDiagram(question.diagram),
        slots: cloneDiagramLabelingSlots(question.slots),
      };
    case 'calculation_mcq':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        scenario: question.scenario,
        calculation: cloneCalculation(question.calculation),
        choices: cloneCalculationChoices(question.choices),
      };
    case 'image_choice':
      return {
        ...base,
        questionKind: question.questionKind,
        ...(question.instruction === undefined
          ? {}
          : { instruction: question.instruction }),
        choices: cloneImageChoiceOptions(question.choices),
      };
    case 'case_qualification':
      return {
        ...base,
        questionKind: question.questionKind,
        caseText: question.caseText,
        choices: publicChoices(question.choices),
      };
    case 'error_detection':
      return {
        ...base,
        questionKind: question.questionKind,
        statement: question.statement,
        errorOptions: publicChoices(question.errorOptions),
      };
  }
}

function publicChoices(
  choices: Array<{ id: string; label: string }>,
): RichClosedPublicChoice[] {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
  }));
}

function cloneLabelItems(items: Array<{ id: string; label: string }>) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
  }));
}

function cloneTimelineEvents(
  events: Array<{ id: string; label: string; description?: string | null }>,
) {
  return events.map((event) => ({
    id: event.id,
    label: event.label,
    ...(event.description === undefined
      ? {}
      : { description: event.description }),
  }));
}

function cloneTrueFalseRows(
  rows: Array<{ id: string; statement: string; context?: string | null }>,
) {
  return rows.map((row) => ({
    id: row.id,
    statement: row.statement,
    ...(row.context === undefined ? {} : { context: row.context }),
  }));
}

function cloneDescribedLabelItems(
  items: Array<{ id: string; label: string; description?: string | null }>,
) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    ...(item.description === undefined
      ? {}
      : { description: item.description }),
  }));
}

function cloneInstitutionMatrixCells(
  cells: Array<{
    id: string;
    rowId: string;
    columnId: string;
    prompt?: string | null;
    options: Array<{ id: string; label: string }>;
  }>,
) {
  return cells.map((cell) => ({
    id: cell.id,
    rowId: cell.rowId,
    columnId: cell.columnId,
    ...(cell.prompt === undefined ? {} : { prompt: cell.prompt }),
    options: publicChoices(cell.options),
  }));
}

function cloneDiagram(diagram: RichClosedDiagram): RichClosedDiagram {
  return {
    ...(diagram.title === undefined ? {} : { title: diagram.title }),
    ...(diagram.description === undefined
      ? {}
      : { description: diagram.description }),
    layout: diagram.layout,
    nodes: diagram.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      ...(node.description === undefined
        ? {}
        : { description: node.description }),
      ...(node.groupId === undefined ? {} : { groupId: node.groupId }),
    })),
    ...(diagram.groups === undefined
      ? {}
      : { groups: cloneDescribedLabelItems(diagram.groups) }),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      ...(edge.label === undefined ? {} : { label: edge.label }),
      ...(edge.description === undefined
        ? {}
        : { description: edge.description }),
    })),
  };
}

function cloneDiagramLabelingSlots(
  slots: RichClosedDiagramLabelingSlot[],
): RichClosedDiagramLabelingSlot[] {
  return slots.map((slot) => ({
    id: slot.id,
    anchorType: slot.anchorType,
    anchorId: slot.anchorId,
    prompt: slot.prompt,
    options: publicChoices(slot.options),
  }));
}

function cloneCalculation(
  calculation: RichClosedCalculationData,
): RichClosedCalculationData {
  switch (calculation.mode) {
    case 'absolute_majority_threshold':
      return {
        mode: calculation.mode,
        validVotes: calculation.validVotes,
      };
    case 'largest_remainder_target_party_seats':
      return {
        mode: calculation.mode,
        totalSeats: calculation.totalSeats,
        targetPartyId: calculation.targetPartyId,
        parties: calculation.parties.map((party) => ({
          id: party.id,
          label: party.label,
          votes: party.votes,
        })),
      };
  }
}

function cloneCalculationChoices(
  choices: RichClosedCalculationChoice[],
): RichClosedCalculationChoice[] {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    value: choice.value,
  }));
}

function cloneImageChoiceOptions(
  choices: RichClosedImageChoiceOption[],
): RichClosedImageChoiceOption[] {
  return choices.map((choice) => {
    const asset = getRichClosedImageAsset(choice.imageAssetId);

    return {
      id: choice.id,
      label: choice.label,
      imageAssetId: choice.imageAssetId,
      altText: asset?.publicAltText ?? choice.altText,
      ...(choice.caption === undefined ? {} : { caption: choice.caption }),
      ...(asset?.creditLabel === undefined
        ? {}
        : { creditLabel: asset.creditLabel }),
      ...(asset === null ? {} : { license: asset.license }),
    };
  });
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-quality-gate.spec.ts

~~~~ts
import { evaluateRichClosedExerciseQuality } from './rich-closed-question-quality-gate';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
} from './rich-closed-question.fixtures';
import { toRichClosedPublicExercise } from './rich-closed-question-public.mapper';

describe('rich closed question quality gate', () => {
  it('accepts a rich V1-A exercise and exposes deterministic metrics', () => {
    const exercise = richClosedExerciseFixture();

    const result = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      publicExercise: toRichClosedPublicExercise(exercise),
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.metrics).toMatchObject({
      questionCount: 6,
      distinctQuestionKindCount: 6,
      advancedQuestionCount: 6,
      basicQuestionCount: 0,
      sourcedQuestionCount: 6,
      qualityGateStatus: 'accepted',
    });
    expect(result.metrics.questionKindCounts).toMatchObject({
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
    });
  });

  it('rejects a six-question exercise made only of single choice questions', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: Array.from({ length: 6 }, (_value, index) => ({
        ...richClosedQuestionFixture('single_choice'),
        id: `single-${index + 1}`,
        prompt: `Question de choix unique ${index + 1}`,
      })),
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_NOT_ENOUGH_KIND_DIVERSITY',
        }),
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        }),
      ]),
    );
  });

  it('rejects a six-question exercise without case qualification', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        richClosedQuestionFixture('single_choice'),
        richClosedQuestionFixture('multiple_choice'),
        richClosedQuestionFixture('matching'),
        richClosedQuestionFixture('ordering'),
        richClosedQuestionFixture('error_detection'),
        { ...richClosedQuestionFixture('matching'), id: 'matching-extra' },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_CASE_QUALIFICATION_REQUIRED',
      }),
    );
  });

  it('rejects a six-question exercise without error detection', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        richClosedQuestionFixture('single_choice'),
        richClosedQuestionFixture('multiple_choice'),
        richClosedQuestionFixture('matching'),
        richClosedQuestionFixture('ordering'),
        richClosedQuestionFixture('case_qualification'),
        { ...richClosedQuestionFixture('ordering'), id: 'ordering-extra' },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_ERROR_DETECTION_REQUIRED',
      }),
    );
  });

  it('rejects unknown sources', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        {
          ...richClosedQuestionFixture('single_choice'),
          sourceChunkIds: ['chunk-unknown'],
        },
        ...richClosedExerciseFixture().questions.slice(1),
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_SOURCE_UNKNOWN' }),
    );
  });

  it('rejects an insufficient sourced ratio when source context is known', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: richClosedExerciseFixture().questions.map((question, index) =>
        index < 2 ? question : { ...question, sourceChunkIds: [] },
      ),
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_NOT_ENOUGH_SOURCED_QUESTIONS',
      }),
    );
  });

  it('rejects excessive basic prompts while keeping the heuristic bounded', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: richClosedExerciseFixture().questions.map(
        (question, index) => ({
          ...question,
          prompt:
            index < 4
              ? `Qui est associé à la notion ${index + 1} ?`
              : question.prompt,
        }),
      ),
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_TOO_MANY_BASIC_QUESTIONS',
      }),
    );
  });

  it('uses relaxed diversity rules for a small three-question exercise', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        richClosedQuestionFixture('single_choice'),
        richClosedQuestionFixture('multiple_choice'),
        richClosedQuestionFixture('case_qualification'),
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_SMALL_EXERCISE_RELAXED_RULES',
      }),
    );
  });

  it('rejects public pre-submit payloads that contain private correction fields', () => {
    const exercise = richClosedExerciseFixture();
    const publicExercise = {
      ...toRichClosedPublicExercise(exercise),
      questions: [
        {
          ...toRichClosedPublicExercise(exercise).questions[0],
          correctChoiceId: 'choice-a',
        },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      publicExercise,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
      }),
    );
  });

  it.each([
    ['feedback', 'Feedback pré-submit interdit'],
    ['choiceFeedback', 'Feedback de choix interdit'],
    ['modelAnswer', 'Réponse modèle interdite'],
    ['answerText', 'Réponse libre interdite'],
    ['expectedValue', 289],
    ['workedSteps', ['Étape révélatrice interdite']],
  ])('rejects public pre-submit payloads containing %s', (key, value) => {
    const exercise = richClosedExerciseFixture();
    const publicExercise = {
      ...toRichClosedPublicExercise(exercise),
      questions: [
        {
          ...toRichClosedPublicExercise(exercise).questions[0],
          metadata: {
            nested: {
              [key]: value,
            },
          },
        },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      publicExercise,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
      }),
    );
  });

  it.each([
    'html',
    'svg',
    'mermaid',
    'widget',
    'renderPayload',
    'imageUrl',
    'blob',
    'formula',
    'expression',
    'calculationCode',
    'script',
    'code',
  ])(
    'rejects public pre-submit payloads containing arbitrary render key %s',
    (key) => {
      const exercise = richClosedExerciseFixture();
      const publicExercise = {
        ...toRichClosedPublicExercise(exercise),
        questions: [
          {
            ...toRichClosedPublicExercise(exercise).questions[0],
            metadata: {
              nested: {
                [key]: '<unsafe>',
              },
            },
          },
        ],
      };

      const result = evaluateRichClosedExerciseQuality(exercise, {
        publicExercise,
      });

      expect(result.accepted).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
        }),
      );
    },
  );

  it('detects basic definition prompts with or without accents', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: richClosedExerciseFixture().questions.map(
        (question, index) => ({
          ...question,
          prompt:
            index < 2
              ? `Quelle est la définition de la notion ${index + 1} ?`
              : index < 4
                ? `Quelle est la definition de la notion ${index + 1} ?`
                : question.prompt,
        }),
      ),
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.metrics.basicQuestionCount).toBe(4);
    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_TOO_MANY_BASIC_QUESTIONS',
      }),
    );
  });
});

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-quality-gate.ts

~~~~ts
import { toRichClosedPublicExercise } from './rich-closed-question-public.mapper';
import {
  validateRichClosedExercise,
  type RichClosedQuestionValidationOptions,
} from './rich-closed-question.validator';
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedCognitiveSkill,
  type RichClosedDifficulty,
  type RichClosedExercise,
  type RichClosedExerciseValidationIssue,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';

export interface RichClosedQuestionQualityGateOptions extends RichClosedQuestionValidationOptions {
  publicExercise?: unknown;
}

export interface RichClosedQuestionQualityGateMetrics {
  questionCount: number;
  questionKindCounts: Record<RichClosedQuestionKind, number>;
  distinctQuestionKindCount: number;
  advancedQuestionCount: number;
  basicQuestionCount: number;
  sourcedQuestionCount: number;
  cognitiveSkillCounts: Partial<Record<RichClosedCognitiveSkill, number>>;
  difficultyCounts: Partial<Record<RichClosedDifficulty, number>>;
  qualityGateStatus: 'accepted' | 'rejected';
}

export interface RichClosedQuestionQualityGateResult {
  accepted: boolean;
  issues: RichClosedExerciseValidationIssue[];
  warnings: RichClosedExerciseValidationIssue[];
  metrics: RichClosedQuestionQualityGateMetrics;
}

const MIN_FULL_GATE_QUESTION_COUNT = 6;
const MIN_DISTINCT_KINDS_FOR_FULL_GATE = 3;
const MAX_SINGLE_CHOICE_RATIO = 0.4;
const MIN_SOURCED_RATIO = 0.8;
const MAX_BASIC_PROMPT_RATIO = 0.4;

export function evaluateRichClosedExerciseQuality(
  exercise: RichClosedExercise,
  options: RichClosedQuestionQualityGateOptions = {},
): RichClosedQuestionQualityGateResult {
  const issues: RichClosedExerciseValidationIssue[] = [
    ...validateRichClosedExercise(exercise, options).issues,
  ];
  const warnings: RichClosedExerciseValidationIssue[] = [];
  const metrics = buildMetrics(exercise);

  if (options.publicExercise !== undefined) {
    const publicLeakIssues = validatePublicPayloadHasNoCorrection(
      options.publicExercise,
    );
    issues.push(...publicLeakIssues);
  } else {
    const mappedPublicPayload = toRichClosedPublicExercise(exercise);
    issues.push(...validatePublicPayloadHasNoCorrection(mappedPublicPayload));
  }

  if (metrics.questionCount < MIN_FULL_GATE_QUESTION_COUNT) {
    warnings.push(
      warning(
        'RICH_CLOSED_GATE_SMALL_EXERCISE_RELAXED_RULES',
        'Diversity gates are relaxed below six questions',
      ),
    );
  } else {
    applyFullExerciseGates(metrics, issues);
  }

  applySourceGates(metrics, issues, options);
  applyBasicPromptGate(metrics, issues);

  metrics.qualityGateStatus = issues.length === 0 ? 'accepted' : 'rejected';

  return {
    accepted: issues.length === 0,
    issues,
    warnings,
    metrics,
  };
}

function applyFullExerciseGates(
  metrics: RichClosedQuestionQualityGateMetrics,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (metrics.distinctQuestionKindCount < MIN_DISTINCT_KINDS_FOR_FULL_GATE) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_NOT_ENOUGH_KIND_DIVERSITY',
        'A full rich closed exercise must contain at least three question kinds',
      ),
    );
  }

  if (
    metrics.questionKindCounts.single_choice / metrics.questionCount >
    MAX_SINGLE_CHOICE_RATIO
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        'A full rich closed exercise cannot be dominated by single choice questions',
      ),
    );
  }

  if (metrics.questionKindCounts.case_qualification === 0) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_CASE_QUALIFICATION_REQUIRED',
        'A full rich closed exercise must contain a case qualification question',
      ),
    );
  }

  if (metrics.questionKindCounts.error_detection === 0) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_ERROR_DETECTION_REQUIRED',
        'A full rich closed exercise must contain an error detection question',
      ),
    );
  }

  if (
    metrics.questionKindCounts.matching === 0 &&
    metrics.questionKindCounts.ordering === 0
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_STRUCTURED_INTERACTION_REQUIRED',
        'A full rich closed exercise must contain matching or ordering',
      ),
    );
  }
}

function applySourceGates(
  metrics: RichClosedQuestionQualityGateMetrics,
  issues: RichClosedExerciseValidationIssue[],
  options: RichClosedQuestionQualityGateOptions,
) {
  if (
    options.knownSourceChunkIds === undefined ||
    metrics.questionCount === 0
  ) {
    return;
  }

  if (
    metrics.sourcedQuestionCount / metrics.questionCount <
    MIN_SOURCED_RATIO
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_NOT_ENOUGH_SOURCED_QUESTIONS',
        'At least 80% of rich closed questions must be sourced when source context is known',
      ),
    );
  }
}

function applyBasicPromptGate(
  metrics: RichClosedQuestionQualityGateMetrics,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (metrics.questionCount === 0) {
    return;
  }

  if (
    metrics.basicQuestionCount / metrics.questionCount >
    MAX_BASIC_PROMPT_RATIO
  ) {
    issues.push(
      error(
        'RICH_CLOSED_GATE_TOO_MANY_BASIC_QUESTIONS',
        'The exercise contains too many likely restitution prompts',
      ),
    );
  }
}

function buildMetrics(
  exercise: RichClosedExercise,
): RichClosedQuestionQualityGateMetrics {
  const questionKindCounts = emptyQuestionKindCounts();
  const cognitiveSkillCounts: Partial<
    Record<RichClosedCognitiveSkill, number>
  > = {};
  const difficultyCounts: Partial<Record<RichClosedDifficulty, number>> = {};
  let sourcedQuestionCount = 0;
  let basicQuestionCount = 0;

  for (const question of exercise.questions) {
    questionKindCounts[question.questionKind] += 1;
    cognitiveSkillCounts[question.cognitiveSkill] =
      (cognitiveSkillCounts[question.cognitiveSkill] ?? 0) + 1;
    difficultyCounts[question.difficulty] =
      (difficultyCounts[question.difficulty] ?? 0) + 1;

    if (question.sourceChunkIds.length > 0) {
      sourcedQuestionCount += 1;
    }

    if (isLikelyBasicPrompt(question.prompt)) {
      basicQuestionCount += 1;
    }
  }

  return {
    questionCount: exercise.questions.length,
    questionKindCounts,
    distinctQuestionKindCount: Object.values(questionKindCounts).filter(
      (count) => count > 0,
    ).length,
    advancedQuestionCount: exercise.questions.length - basicQuestionCount,
    basicQuestionCount,
    sourcedQuestionCount,
    cognitiveSkillCounts,
    difficultyCounts,
    qualityGateStatus: 'rejected',
  };
}

function emptyQuestionKindCounts(): Record<RichClosedQuestionKind, number> {
  return Object.fromEntries(
    RICH_CLOSED_QUESTION_KINDS.map((kind) => [kind, 0]),
  ) as Record<RichClosedQuestionKind, number>;
}

function isLikelyBasicPrompt(prompt: string): boolean {
  const normalized = normalizePromptForHeuristic(prompt);

  return (
    normalized.startsWith('qui ') ||
    normalized.startsWith('quand ') ||
    normalized.startsWith('quelle date') ||
    normalized.startsWith('quelle est la definition') ||
    normalized.startsWith('quel terme designe')
  );
}

function normalizePromptForHeuristic(prompt: string): string {
  return prompt
    .trim()
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ');
}

function validatePublicPayloadHasNoCorrection(
  value: unknown,
): RichClosedExerciseValidationIssue[] {
  const leakingPaths = privateFieldPaths(value);

  return leakingPaths.map((path) =>
    error(
      'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
      'Public pre-submit payload contains private correction data',
      path,
    ),
  );
}

function privateFieldPaths(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      privateFieldPaths(item, `${path}.${index}`),
    );
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const paths: string[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (isPrivatePublicPayloadKey(key)) {
      paths.push(nestedPath);
      continue;
    }

    paths.push(...privateFieldPaths(nestedValue, nestedPath));
  }

  return paths;
}

function isPrivatePublicPayloadKey(key: string): boolean {
  return (
    key.startsWith('correct') ||
    key === 'correction' ||
    key === 'correctionPayload' ||
    key === 'explanation' ||
    key === 'feedback' ||
    key === 'choiceFeedback' ||
    key === 'modelAnswer' ||
    key === 'answerText' ||
    key === 'freeTextAnswer' ||
    key === 'textAnswer' ||
    key === 'score' ||
    key === 'partialScore' ||
    key === 'expectedValue' ||
    key === 'workedSteps' ||
    key === 'answersPayload' ||
    key === 'expectedAnswer' ||
    key === 'expectedAnswers' ||
    key === 'semanticLabel' ||
    key === 'answerHint' ||
    isForbiddenRenderPublicPayloadKey(key)
  );
}

function isForbiddenRenderPublicPayloadKey(key: string): boolean {
  return [
    'html',
    'svg',
    'rawSvg',
    'mermaid',
    'markdown',
    'widget',
    'component',
    'renderPayload',
    'style',
    'css',
    'script',
    'formula',
    'expression',
    'rawFormula',
    'calculationCode',
    'javascript',
    'python',
    'imageUrl',
    'assetUrl',
    'url',
    'remoteUrl',
    'src',
    'href',
    'storagePath',
    'bucketPath',
    'cdnUrl',
    'base64',
    'dataUri',
    'blob',
    'rawImage',
    'assetPath',
    'canvas',
    'code',
    'markup',
  ].includes(key);
}

function error(
  code: string,
  message: string,
  path?: string,
): RichClosedExerciseValidationIssue {
  return {
    code,
    message,
    ...(path === undefined ? {} : { path }),
    severity: 'error',
  };
}

function warning(
  code: string,
  message: string,
): RichClosedExerciseValidationIssue {
  return {
    code,
    message,
    severity: 'warning',
  };
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer.spec.ts

~~~~ts
import { RICH_CLOSED_SUBMIT_INVALID_INPUT } from './rich-closed-question-errors';
import {
  richClosedExerciseFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from './rich-closed-question.fixtures';
import { scoreRichClosedExerciseSubmission } from './rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedExercise,
} from './rich-closed-question.types';

describe('scoreRichClosedExerciseSubmission', () => {
  it('scores a fully correct rich closed exercise', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers(),
    });

    expect(result).toMatchObject({
      sessionId: 'session-1',
      type: 'rich_closed_exercise',
      status: 'completed',
      correctAnswers: 6,
      totalQuestions: 6,
      score: 1,
    });
    expect(result.items).toHaveLength(6);
    expect(result.items.every((item) => item.isCorrect)).toBe(true);
    expect(result.items[0]?.correction).toEqual({
      correctChoiceId: 'choice-a',
    });
    expect(result.items[1]?.correction).toEqual({
      correctChoiceIds: ['choice-a', 'choice-b'],
    });
  });

  it('scores exact and incorrect answers by question kind', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: [
        {
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'choice-b',
        },
        {
          questionId: 'multiple-1',
          questionKind: 'multiple_choice',
          choiceIds: ['choice-b', 'choice-a'],
        },
        {
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-2', rightId: 'right-2' },
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-3', rightId: 'right-3' },
          ],
        },
        {
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-1', 'item-3', 'item-2'],
        },
        {
          questionId: 'case-1',
          questionKind: 'case_qualification',
          choiceId: 'choice-a',
        },
        {
          questionId: 'error-1',
          questionKind: 'error_detection',
          errorId: 'error-b',
        },
      ],
    });

    expect(result.correctAnswers).toBe(3);
    expect(result.score).toBe(0.5);
    expect(result.items.map((item) => item.isCorrect)).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
  });

  it('accepts multiple choice answer order but requires an exact set', () => {
    const exact = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers().map((answer) =>
        answer.questionId === 'multiple-1'
          ? {
              questionId: 'multiple-1',
              questionKind: 'multiple_choice',
              choiceIds: ['choice-b', 'choice-a'],
            }
          : answer,
      ),
    });
    const wrongSet = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers().map((answer) =>
        answer.questionId === 'multiple-1'
          ? {
              questionId: 'multiple-1',
              questionKind: 'multiple_choice',
              choiceIds: ['choice-a', 'choice-c'],
            }
          : answer,
      ),
    });

    expect(
      exact.items.find((item) => item.questionId === 'multiple-1'),
    ).toMatchObject({
      isCorrect: true,
    });
    expect(
      wrongSet.items.find((item) => item.questionId === 'multiple-1'),
    ).toMatchObject({
      isCorrect: false,
    });
  });

  it('rejects unknown selected ids for choice-based answers', () => {
    expectInvalid(
      replaceAnswer({
        questionId: 'single-1',
        questionKind: 'single_choice',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalid(
      replaceAnswer({
        questionId: 'case-1',
        questionKind: 'case_qualification',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalid(
      replaceAnswer({
        questionId: 'error-1',
        questionKind: 'error_detection',
        errorId: 'unknown-error',
      }),
    );
  });

  it('rejects multiple choice submissions outside min and max selections', () => {
    expectInvalid(
      replaceAnswer({
        questionId: 'multiple-1',
        questionKind: 'multiple_choice',
        choiceIds: ['choice-a'],
      }),
    );
    expectInvalid(
      replaceAnswer({
        questionId: 'multiple-1',
        questionKind: 'multiple_choice',
        choiceIds: ['choice-a', 'choice-b', 'choice-c'],
      }),
    );
  });

  it('accepts matching pair order but requires exact logical pairs', () => {
    const wrongPair = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: correctAnswers().map((answer) =>
        answer.questionId === 'matching-1'
          ? {
              questionId: 'matching-1',
              questionKind: 'matching',
              pairs: [
                { leftId: 'left-1', rightId: 'right-2' },
                { leftId: 'left-2', rightId: 'right-1' },
                { leftId: 'left-3', rightId: 'right-3' },
              ],
            }
          : answer,
      ),
    });

    expect(
      wrongPair.items.find((item) => item.questionId === 'matching-1'),
    ).toMatchObject({
      isCorrect: false,
    });
  });

  it('scores timeline and date slider V1-B answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BExerciseFixture(),
      answers: correctAnswersV1B(),
    });

    expect(result).toMatchObject({
      correctAnswers: 8,
      totalQuestions: 8,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'timeline-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: { correctOrder: ['event-1', 'event-2', 'event-3'] },
    });
    expect(
      result.items.find((item) => item.questionId === 'date-slider-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctYear: 1958,
        minAcceptedYear: 1958,
        maxAcceptedYear: 1958,
      },
    });
  });

  it('marks a wrong timeline order as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BExerciseFixture(),
      answers: correctAnswersV1B().map((answer) =>
        answer.questionId === 'timeline-1'
          ? {
              questionId: 'timeline-1',
              questionKind: 'timeline',
              orderedEventIds: ['event-1', 'event-3', 'event-2'],
            }
          : answer,
      ),
    });

    expect(
      result.items.find((item) => item.questionId === 'timeline-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown and incomplete timeline answers', () => {
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'timeline-1',
        questionKind: 'timeline',
        orderedEventIds: ['event-1', 'event-1', 'event-3'],
      }),
    );
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'timeline-1',
        questionKind: 'timeline',
        orderedEventIds: ['event-1', 'event-2', 'unknown-event'],
      }),
    );
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'timeline-1',
        questionKind: 'timeline',
        orderedEventIds: ['event-1', 'event-2'],
      }),
    );
  });

  it('scores date slider answers with tolerance and rejects invalid years', () => {
    const exercise = {
      ...richClosedV1BExerciseFixture(),
      questions: richClosedV1BExerciseFixture().questions.map((question) =>
        question.questionKind === 'date_slider'
          ? { ...question, toleranceYears: 2 }
          : question,
      ),
    };
    const withinTolerance = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise,
      answers: correctAnswersV1B().map((answer) =>
        answer.questionId === 'date-slider-1'
          ? {
              questionId: 'date-slider-1',
              questionKind: 'date_slider',
              year: 1960,
            }
          : answer,
      ),
    });
    const outsideTolerance = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise,
      answers: correctAnswersV1B().map((answer) =>
        answer.questionId === 'date-slider-1'
          ? {
              questionId: 'date-slider-1',
              questionKind: 'date_slider',
              year: 1961,
            }
          : answer,
      ),
    });

    expect(
      withinTolerance.items.find((item) => item.questionId === 'date-slider-1'),
    ).toMatchObject({ isCorrect: true });
    expect(
      outsideTolerance.items.find(
        (item) => item.questionId === 'date-slider-1',
      ),
    ).toMatchObject({ isCorrect: false });
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'date-slider-1',
        questionKind: 'date_slider',
        year: 1971,
      }),
    );
    expectInvalidV1B(
      replaceV1BAnswer({
        questionId: 'date-slider-1',
        questionKind: 'date_slider',
        year: 1958.5,
      } as unknown as RichClosedAnswer),
    );
  });

  it('scores true_false_grid and cause_consequence V1-B answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers: correctAnswersV1BFull(),
    });

    expect(result).toMatchObject({
      correctAnswers: 10,
      totalQuestions: 10,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'true-false-grid-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctValues: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'row-3', value: true },
        ],
      },
    });
    expect(
      result.items.find((item) => item.questionId === 'cause-consequence-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctPairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-2' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      },
    });
  });

  it('marks one wrong true_false_grid value as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers: replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: true },
          { rowId: 'row-3', value: true },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'true-false-grid-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown, incomplete and non-boolean true_false_grid answers', () => {
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-1', value: false },
          { rowId: 'row-3', value: true },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'unknown-row', value: true },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'true-false-grid-1',
        questionKind: 'true_false_grid',
        values: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'row-3', value: 'true' },
        ],
      }),
    );
  });

  it('marks a wrong cause_consequence pair as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers: replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-2' },
          { causeId: 'cause-2', consequenceId: 'consequence-1' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'cause-consequence-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown and incomplete cause_consequence answers', () => {
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-1', consequenceId: 'consequence-2' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'unknown-consequence' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-2' },
        ],
      }),
    );
    expectInvalidV1BFull(
      replaceV1BFullAnswer({
        questionId: 'cause-consequence-1',
        questionKind: 'cause_consequence',
        pairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-1' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
      }),
    );
  });

  it('scores institution_matrix V1-C answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CExerciseFixture(),
      answers: correctAnswersV1C(),
    });

    expect(result).toMatchObject({
      correctAnswers: 11,
      totalQuestions: 11,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'institution-matrix-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctValues: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      },
    });
  });

  it('marks one wrong institution_matrix value as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CExerciseFixture(),
      answers: replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-confidence',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'institution-matrix-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown, incomplete and invalid institution_matrix answers', () => {
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-confidence',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    );
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          { cellId: 'unknown-cell', optionId: 'option-legitimacy-election' },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    );
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-action-censure',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
      }),
    );
    expectInvalidV1C(
      replaceV1CAnswer({
        questionId: 'institution-matrix-1',
        questionKind: 'institution_matrix',
        values: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
        ],
      }),
    );
  });

  it('scores diagram_labeling V1-C answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CFullExerciseFixture(),
      answers: correctAnswersV1CFull(),
    });

    expect(result).toMatchObject({
      correctAnswers: 12,
      totalQuestions: 12,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'diagram-labeling-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctValues: [
          {
            slotId: 'slot-government-role',
            optionId: 'option-government',
          },
          {
            slotId: 'slot-censure',
            optionId: 'option-motion-censure',
          },
          {
            slotId: 'slot-nomination',
            optionId: 'option-nomination',
          },
        ],
      },
    });
  });

  it('marks one wrong diagram_labeling value as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CFullExerciseFixture(),
      answers: replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          {
            slotId: 'slot-government-role',
            optionId: 'option-president',
          },
          {
            slotId: 'slot-censure',
            optionId: 'option-motion-censure',
          },
          {
            slotId: 'slot-nomination',
            optionId: 'option-nomination',
          },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'diagram-labeling-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('keeps diagram_labeling value comparison structured when ids contain separators', () => {
    const exercise = {
      ...richClosedV1CFullExerciseFixture(),
      questions: richClosedV1CFullExerciseFixture().questions.map((question) =>
        question.questionKind === 'diagram_labeling'
          ? {
              ...question,
              slots: [
                {
                  id: 'slot:a',
                  anchorType: 'node',
                  anchorId: 'node-government',
                  prompt: 'Slot A',
                  options: [
                    { id: 'option:b', label: 'Option B' },
                    { id: 'option:b:d', label: 'Option BD' },
                  ],
                },
                {
                  id: 'slot:a:b',
                  anchorType: 'node',
                  anchorId: 'node-assembly',
                  prompt: 'Slot AB',
                  options: [
                    { id: 'option:c', label: 'Option C' },
                    { id: 'option:d', label: 'Option D' },
                  ],
                },
              ],
              correctValues: [
                { slotId: 'slot:a', optionId: 'option:b' },
                { slotId: 'slot:a:b', optionId: 'option:c' },
              ],
            }
          : question,
      ),
    };

    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise,
      answers: replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot:a', optionId: 'option:b:d' },
          { slotId: 'slot:a:b', optionId: 'option:c' },
        ],
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'diagram-labeling-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
    });
  });

  it('rejects duplicate, unknown, incomplete, invalid and render-bearing diagram_labeling answers', () => {
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-government' },
          { slotId: 'slot-government-role', optionId: 'option-president' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'unknown-slot', optionId: 'option-government' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-motion-censure' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-government' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
        ],
      }),
    );
    expectInvalidV1CFull(
      replaceV1CFullAnswer({
        questionId: 'diagram-labeling-1',
        questionKind: 'diagram_labeling',
        values: [
          { slotId: 'slot-government-role', optionId: 'option-government' },
          { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          { slotId: 'slot-nomination', optionId: 'option-nomination' },
        ],
        renderPayload: { widget: 'free-form' },
      }),
    );
  });

  it('scores calculation_mcq V1-C answers with deterministic correction steps', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CCalculationExerciseFixture(),
      answers: correctAnswersV1CCalculation(),
    });

    expect(result).toMatchObject({
      correctAnswers: 13,
      totalQuestions: 13,
      score: 1,
    });
    const item = result.items.find(
      (item) => item.questionId === 'calculation-mcq-majority-1',
    );
    const correction = item?.correction as
      | {
          correctChoiceId: string;
          expectedValue: number;
          workedSteps: unknown[];
        }
      | undefined;

    expect(item).toMatchObject({
      isCorrect: true,
    });
    expect(correction?.correctChoiceId).toBe('choice-289');
    expect(correction?.expectedValue).toBe(289);
    expect(correction?.workedSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'threshold', value: 289 }),
      ]),
    );
  });

  it('derives calculation_mcq correctness from the recalculated expected value', () => {
    const exercise = richClosedV1CCalculationExerciseFixture();
    const tamperedExercise: RichClosedExercise = {
      ...exercise,
      questions: exercise.questions.map((question) =>
        question.questionKind === 'calculation_mcq'
          ? { ...question, correctChoiceId: 'choice-288' }
          : question,
      ),
    };

    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: tamperedExercise,
      answers: correctAnswersV1CCalculation(),
    });

    expect(
      result.items.find(
        (item) => item.questionId === 'calculation-mcq-majority-1',
      ),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctChoiceId: 'choice-289',
        expectedValue: 289,
      },
    });
  });

  it('marks a wrong calculation_mcq choice as incorrect without recalculating from the answer value', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CCalculationExerciseFixture(),
      answers: replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'choice-288',
      }),
    });

    expect(
      result.items.find(
        (item) => item.questionId === 'calculation-mcq-majority-1',
      ),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
      correction: {
        correctChoiceId: 'choice-289',
        expectedValue: 289,
      },
    });
  });

  it('rejects unknown and private-field calculation_mcq answers', () => {
    expectInvalidV1CCalculation(
      replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalidV1CCalculation(
      replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'choice-289',
        expectedValue: 289,
      }),
    );
    expectInvalidV1CCalculation(
      replaceV1CCalculationAnswer({
        questionId: 'calculation-mcq-majority-1',
        questionKind: 'calculation_mcq',
        choiceId: 'choice-289',
        formula: 'floor(validVotes / 2) + 1',
      }),
    );
  });

  it('scores image_choice V1-D answers', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1DImageChoiceExerciseFixture(),
      answers: correctAnswersV1DImageChoice(),
    });

    expect(result).toMatchObject({
      correctAnswers: 14,
      totalQuestions: 14,
      score: 1,
    });
    expect(
      result.items.find((item) => item.questionId === 'image-choice-1'),
    ).toMatchObject({
      isCorrect: true,
      correction: {
        correctChoiceId: 'choice-image-a',
      },
    });
  });

  it('marks a wrong image_choice choice as incorrect without partial scoring', () => {
    const result = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1DImageChoiceExerciseFixture(),
      answers: replaceV1DImageChoiceAnswer({
        questionId: 'image-choice-1',
        questionKind: 'image_choice',
        choiceId: 'choice-image-b',
      }),
    });

    expect(
      result.items.find((item) => item.questionId === 'image-choice-1'),
    ).toMatchObject({
      isCorrect: false,
      partialScore: 0,
      correction: {
        correctChoiceId: 'choice-image-a',
      },
    });
  });

  it('rejects unknown and private-field image_choice answers', () => {
    expectInvalidV1DImageChoice(
      replaceV1DImageChoiceAnswer({
        questionId: 'image-choice-1',
        questionKind: 'image_choice',
        choiceId: 'unknown-choice',
      }),
    );
    expectInvalidV1DImageChoice(
      replaceV1DImageChoiceAnswer({
        questionId: 'image-choice-1',
        questionKind: 'image_choice',
        choiceId: 'choice-image-a',
        imageUrl: 'https://example.test/image.png',
      }),
    );
    expectInvalidV1DImageChoice(
      replaceV1DImageChoiceAnswer({
        questionId: 'image-choice-1',
        questionKind: 'image_choice',
        choiceId: 'choice-image-a',
        blob: 'blob://unsafe',
      }),
    );
    expectInvalidV1DImageChoice(
      replaceV1DImageChoiceAnswer({
        questionId: 'image-choice-1',
        questionKind: 'image_choice',
        choiceId: 'choice-image-a',
        renderPayload: { widget: 'free-form' },
      }),
    );
  });

  it('rejects incomplete ordering answers', () => {
    expect(() =>
      scoreRichClosedExerciseSubmission({
        sessionId: 'session-1',
        exercise: richClosedExerciseFixture(),
        answers: correctAnswers().map((answer) =>
          answer.questionId === 'ordering-1'
            ? {
                questionId: 'ordering-1',
                questionKind: 'ordering',
                orderedIds: ['item-1', 'item-2'],
              }
            : answer,
        ),
      }),
    ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  });

  it('rejects unknown, duplicate, missing and kind-mismatched answers', () => {
    expectInvalid([
      ...correctAnswers(),
      {
        questionId: 'unknown-question',
        questionKind: 'single_choice',
        choiceId: 'choice-a',
      },
    ]);
    expectInvalid([
      ...correctAnswers(),
      {
        questionId: 'single-1',
        questionKind: 'single_choice',
        choiceId: 'choice-a',
      },
    ]);
    expectInvalid(
      correctAnswers().filter((answer) => answer.questionId !== 'single-1'),
    );
    expectInvalid(
      correctAnswers().map((answer) =>
        answer.questionId === 'single-1'
          ? {
              questionId: 'single-1',
              questionKind: 'multiple_choice',
              choiceIds: ['choice-a', 'choice-b'],
            }
          : answer,
      ),
    );
  });

  it('rejects answers carrying free text or correction fields', () => {
    expectInvalid([
      ...correctAnswers().filter((answer) => answer.questionId !== 'single-1'),
      {
        questionId: 'single-1',
        questionKind: 'single_choice',
        choiceId: 'choice-a',
        answerText: 'réponse libre interdite',
      },
    ]);
    expectInvalid([
      ...correctAnswers().filter(
        (answer) => answer.questionId !== 'multiple-1',
      ),
      {
        questionId: 'multiple-1',
        questionKind: 'multiple_choice',
        choiceIds: ['choice-a', 'choice-b'],
        correctChoiceIds: ['choice-a', 'choice-b'],
      },
    ]);
  });

  it('produces global scores at 0 and 1', () => {
    const zero = scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers: [
        {
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'choice-b',
        },
        {
          questionId: 'multiple-1',
          questionKind: 'multiple_choice',
          choiceIds: ['choice-a', 'choice-c'],
        },
        {
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-1', rightId: 'right-2' },
            { leftId: 'left-2', rightId: 'right-3' },
            { leftId: 'left-3', rightId: 'right-1' },
          ],
        },
        {
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-3', 'item-2', 'item-1'],
        },
        {
          questionId: 'case-1',
          questionKind: 'case_qualification',
          choiceId: 'choice-b',
        },
        {
          questionId: 'error-1',
          questionKind: 'error_detection',
          errorId: 'error-b',
        },
      ],
    });

    expect(zero.score).toBe(0);
    expect(
      scoreRichClosedExerciseSubmission({
        sessionId: 'session-1',
        exercise: richClosedExerciseFixture(),
        answers: correctAnswers(),
      }).score,
    ).toBe(1);
  });
});

function expectInvalid(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1B(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1BFull(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1BFullExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1C(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1CFull(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CFullExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1CCalculation(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1CCalculationExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function expectInvalidV1DImageChoice(answers: unknown[]) {
  expect(() =>
    scoreRichClosedExerciseSubmission({
      sessionId: 'session-1',
      exercise: richClosedV1DImageChoiceExerciseFixture(),
      answers,
    }),
  ).toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
}

function replaceAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return correctAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceV1BAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return correctAnswersV1B().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceV1BFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1BFull().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1CAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1C().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1CFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1CFull().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1CCalculationAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1CCalculation().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceV1DImageChoiceAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return correctAnswersV1DImageChoice().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function correctAnswers(): RichClosedAnswer[] {
  return [
    {
      questionId: 'single-1',
      questionKind: 'single_choice',
      choiceId: 'choice-a',
    },
    {
      questionId: 'multiple-1',
      questionKind: 'multiple_choice',
      choiceIds: ['choice-a', 'choice-b'],
    },
    {
      questionId: 'matching-1',
      questionKind: 'matching',
      pairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    },
    {
      questionId: 'ordering-1',
      questionKind: 'ordering',
      orderedIds: ['item-1', 'item-2', 'item-3'],
    },
    {
      questionId: 'case-1',
      questionKind: 'case_qualification',
      choiceId: 'choice-a',
    },
    {
      questionId: 'error-1',
      questionKind: 'error_detection',
      errorId: 'error-a',
    },
  ];
}

function correctAnswersV1B(): RichClosedAnswer[] {
  return [
    ...correctAnswers(),
    {
      questionId: 'timeline-1',
      questionKind: 'timeline',
      orderedEventIds: ['event-1', 'event-2', 'event-3'],
    },
    {
      questionId: 'date-slider-1',
      questionKind: 'date_slider',
      year: 1958,
    },
  ];
}

function correctAnswersV1BFull(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1B(),
    {
      questionId: 'true-false-grid-1',
      questionKind: 'true_false_grid',
      values: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: true },
      ],
    },
    {
      questionId: 'cause-consequence-1',
      questionKind: 'cause_consequence',
      pairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    },
  ];
}

function correctAnswersV1C(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1BFull(),
    {
      questionId: 'institution-matrix-1',
      questionKind: 'institution_matrix',
      values: [
        {
          cellId: 'cell-president-legitimacy',
          optionId: 'option-legitimacy-election',
        },
        {
          cellId: 'cell-government-responsibility',
          optionId: 'option-responsibility-assembly',
        },
        {
          cellId: 'cell-assembly-action',
          optionId: 'option-action-censure',
        },
      ],
    },
  ];
}

function correctAnswersV1CFull(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1C(),
    {
      questionId: 'diagram-labeling-1',
      questionKind: 'diagram_labeling',
      values: [
        {
          slotId: 'slot-government-role',
          optionId: 'option-government',
        },
        {
          slotId: 'slot-censure',
          optionId: 'option-motion-censure',
        },
        {
          slotId: 'slot-nomination',
          optionId: 'option-nomination',
        },
      ],
    },
  ];
}

function correctAnswersV1CCalculation(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1CFull(),
    {
      questionId: 'calculation-mcq-majority-1',
      questionKind: 'calculation_mcq',
      choiceId: 'choice-289',
    },
  ];
}

function correctAnswersV1DImageChoice(): RichClosedAnswer[] {
  return [
    ...correctAnswersV1CCalculation(),
    {
      questionId: 'image-choice-1',
      questionKind: 'image_choice',
      choiceId: 'choice-image-a',
    },
  ];
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer.ts

~~~~ts
import {
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
  RICH_CLOSED_SESSION_NOT_FOUND,
} from './rich-closed-question-errors';
import { evaluateRichClosedCalculationMcq } from './rich-closed-question-calculation';
import {
  type RichClosedAnswer,
  type RichClosedCalculationMcqQuestion,
  type RichClosedCauseConsequencePair,
  type RichClosedCorrectionItem,
  type RichClosedCorrectionPayload,
  type RichClosedDiagramLabelingValue,
  type RichClosedExercise,
  type RichClosedExerciseResult,
  type RichClosedInstitutionMatrixValue,
  type RichClosedPair,
  type RichClosedQuestion,
  type RichClosedTrueFalseValue,
} from './rich-closed-question.types';

export function scoreRichClosedExerciseSubmission(input: {
  sessionId: string;
  exercise: RichClosedExercise;
  answers: unknown[];
}): RichClosedExerciseResult {
  if (input.exercise.questions.length === 0) {
    throw new Error(RICH_CLOSED_SESSION_NOT_FOUND);
  }

  const answersByQuestionId = normalizeAnswers(input.answers);
  const questionIds = new Set(
    input.exercise.questions.map((question) => question.id),
  );

  for (const answer of answersByQuestionId.values()) {
    if (!questionIds.has(answer.questionId)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }
  }

  const items = input.exercise.questions.map((question) => {
    const answer = answersByQuestionId.get(question.id);

    if (!answer) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return scoreQuestion(question, answer);
  });
  const correctAnswers = items.filter((item) => item.isCorrect).length;
  const totalQuestions = input.exercise.questions.length;
  const score =
    totalQuestions === 0
      ? 0
      : Number((correctAnswers / totalQuestions).toFixed(3));

  return {
    sessionId: input.sessionId,
    type: 'rich_closed_exercise',
    status: 'completed',
    correctAnswers,
    totalQuestions,
    score,
    items,
  };
}

function normalizeAnswers(answers: unknown[]): Map<string, RichClosedAnswer> {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  const answersByQuestionId = new Map<string, RichClosedAnswer>();

  for (const answer of answers) {
    const normalizedAnswer = normalizeAnswer(answer);

    if (answersByQuestionId.has(normalizedAnswer.questionId)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    answersByQuestionId.set(normalizedAnswer.questionId, normalizedAnswer);
  }

  return answersByQuestionId;
}

function normalizeAnswer(answer: unknown): RichClosedAnswer {
  if (!isRecord(answer) || hasForbiddenSubmitField(answer)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  const questionId = readRequiredString(answer.questionId);
  const questionKind = readRequiredString(answer.questionKind);

  switch (questionKind) {
    case 'single_choice':
    case 'case_qualification':
      return {
        questionId,
        questionKind,
        choiceId: readRequiredString(answer.choiceId),
      };
    case 'multiple_choice':
      return {
        questionId,
        questionKind,
        choiceIds: readStringArray(answer.choiceIds),
      };
    case 'matching':
      return {
        questionId,
        questionKind,
        pairs: readPairs(answer.pairs),
      };
    case 'ordering':
      return {
        questionId,
        questionKind,
        orderedIds: readStringArray(answer.orderedIds),
      };
    case 'timeline':
      return {
        questionId,
        questionKind,
        orderedEventIds: readStringArray(answer.orderedEventIds),
      };
    case 'date_slider':
      return {
        questionId,
        questionKind,
        year: readRequiredInteger(answer.year),
      };
    case 'true_false_grid':
      return {
        questionId,
        questionKind,
        values: readTrueFalseValues(answer.values),
      };
    case 'cause_consequence':
      return {
        questionId,
        questionKind,
        pairs: readCauseConsequencePairs(answer.pairs),
      };
    case 'institution_matrix':
      return {
        questionId,
        questionKind,
        values: readInstitutionMatrixValues(answer.values),
      };
    case 'diagram_labeling':
      return {
        questionId,
        questionKind,
        values: readDiagramLabelingValues(answer.values),
      };
    case 'calculation_mcq':
      return {
        questionId,
        questionKind,
        choiceId: readRequiredString(answer.choiceId),
      };
    case 'image_choice':
      return {
        questionId,
        questionKind,
        choiceId: readRequiredString(answer.choiceId),
      };
    case 'error_detection':
      return {
        questionId,
        questionKind,
        errorId: readRequiredString(answer.errorId),
      };
    default:
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function scoreQuestion(
  question: RichClosedQuestion,
  answer: RichClosedAnswer,
): RichClosedCorrectionItem {
  if (question.questionKind !== answer.questionKind) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  switch (question.questionKind) {
    case 'single_choice': {
      const singleAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'single_choice' }
      >;
      assertKnownId(
        singleAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );

      return buildCorrectionItem({
        question,
        answer: singleAnswer,
        isCorrect: singleAnswer.choiceId === question.correctChoiceId,
        correction: { correctChoiceId: question.correctChoiceId },
      });
    }
    case 'case_qualification': {
      const caseAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'case_qualification' }
      >;
      assertKnownId(
        caseAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );

      return buildCorrectionItem({
        question,
        answer: caseAnswer,
        isCorrect: caseAnswer.choiceId === question.correctChoiceId,
        correction: { correctChoiceId: question.correctChoiceId },
      });
    }
    case 'error_detection': {
      const errorAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'error_detection' }
      >;
      assertKnownId(
        errorAnswer.errorId,
        question.errorOptions.map((option) => option.id),
      );

      return buildCorrectionItem({
        question,
        answer: errorAnswer,
        isCorrect: errorAnswer.errorId === question.correctErrorId,
        correction: { correctErrorId: question.correctErrorId },
      });
    }
    case 'multiple_choice': {
      const multipleAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'multiple_choice' }
      >;
      assertKnownIds(
        multipleAnswer.choiceIds,
        question.choices.map((choice) => choice.id),
      );

      if (
        multipleAnswer.choiceIds.length < question.minSelections ||
        multipleAnswer.choiceIds.length > question.maxSelections
      ) {
        throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
      }

      return buildCorrectionItem({
        question,
        answer: multipleAnswer,
        isCorrect: areStringSetsEqual(
          multipleAnswer.choiceIds,
          question.correctChoiceIds,
        ),
        correction: { correctChoiceIds: [...question.correctChoiceIds] },
      });
    }
    case 'matching': {
      const matchingAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'matching' }
      >;
      assertKnownPairs(matchingAnswer.pairs, question);

      return buildCorrectionItem({
        question,
        answer: matchingAnswer,
        isCorrect: arePairsEqual(matchingAnswer.pairs, question.correctPairs),
        correction: { correctPairs: clonePairs(question.correctPairs) },
      });
    }
    case 'ordering': {
      const orderingAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'ordering' }
      >;
      assertKnownIds(
        orderingAnswer.orderedIds,
        question.items.map((item) => item.id),
      );

      if (orderingAnswer.orderedIds.length !== question.items.length) {
        throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
      }

      return buildCorrectionItem({
        question,
        answer: orderingAnswer,
        isCorrect: areStringArraysEqual(
          orderingAnswer.orderedIds,
          question.correctOrder,
        ),
        correction: { correctOrder: [...question.correctOrder] },
      });
    }
    case 'timeline': {
      const timelineAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'timeline' }
      >;
      assertKnownIds(
        timelineAnswer.orderedEventIds,
        question.events.map((event) => event.id),
      );

      if (timelineAnswer.orderedEventIds.length !== question.events.length) {
        throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
      }

      return buildCorrectionItem({
        question,
        answer: timelineAnswer,
        isCorrect: areStringArraysEqual(
          timelineAnswer.orderedEventIds,
          question.correctOrder,
        ),
        correction: { correctOrder: [...question.correctOrder] },
      });
    }
    case 'date_slider': {
      const dateSliderAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'date_slider' }
      >;
      assertDateSliderYear(dateSliderAnswer.year, question);

      const minAcceptedYear = Math.max(
        question.minYear,
        question.correctYear - question.toleranceYears,
      );
      const maxAcceptedYear = Math.min(
        question.maxYear,
        question.correctYear + question.toleranceYears,
      );

      return buildCorrectionItem({
        question,
        answer: dateSliderAnswer,
        isCorrect:
          Math.abs(dateSliderAnswer.year - question.correctYear) <=
          question.toleranceYears,
        correction: {
          correctYear: question.correctYear,
          minAcceptedYear,
          maxAcceptedYear,
        },
      });
    }
    case 'true_false_grid': {
      const trueFalseAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'true_false_grid' }
      >;
      assertKnownTrueFalseValues(trueFalseAnswer.values, question);

      return buildCorrectionItem({
        question,
        answer: trueFalseAnswer,
        isCorrect: areTrueFalseValuesEqual(
          trueFalseAnswer.values,
          question.correctValues,
        ),
        correction: {
          correctValues: cloneTrueFalseValues(question.correctValues),
        },
      });
    }
    case 'cause_consequence': {
      const causeConsequenceAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'cause_consequence' }
      >;
      assertKnownCauseConsequencePairs(causeConsequenceAnswer.pairs, question);

      return buildCorrectionItem({
        question,
        answer: causeConsequenceAnswer,
        isCorrect: areCauseConsequencePairsEqual(
          causeConsequenceAnswer.pairs,
          question.correctPairs,
        ),
        correction: {
          correctPairs: cloneCauseConsequencePairs(question.correctPairs),
        },
      });
    }
    case 'institution_matrix': {
      const institutionMatrixAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'institution_matrix' }
      >;
      assertKnownInstitutionMatrixValues(
        institutionMatrixAnswer.values,
        question,
      );

      return buildCorrectionItem({
        question,
        answer: institutionMatrixAnswer,
        isCorrect: areInstitutionMatrixValuesEqual(
          institutionMatrixAnswer.values,
          question.correctValues,
        ),
        correction: {
          correctValues: cloneInstitutionMatrixValues(question.correctValues),
        },
      });
    }
    case 'diagram_labeling': {
      const diagramLabelingAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'diagram_labeling' }
      >;
      assertKnownDiagramLabelingValues(diagramLabelingAnswer.values, question);

      return buildCorrectionItem({
        question,
        answer: diagramLabelingAnswer,
        isCorrect: areDiagramLabelingValuesEqual(
          diagramLabelingAnswer.values,
          question.correctValues,
        ),
        correction: {
          correctValues: cloneDiagramLabelingValues(question.correctValues),
        },
      });
    }
    case 'calculation_mcq': {
      const calculationAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'calculation_mcq' }
      >;
      assertKnownId(
        calculationAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );
      const evaluation = evaluateRichClosedCalculationMcq(question.calculation);
      const derivedCorrectChoiceId = deriveCalculationCorrectChoiceId(
        question,
        evaluation.expectedValue,
      );

      return buildCorrectionItem({
        question,
        answer: calculationAnswer,
        isCorrect: calculationAnswer.choiceId === derivedCorrectChoiceId,
        correction: {
          correctChoiceId: derivedCorrectChoiceId,
          expectedValue: evaluation.expectedValue,
          workedSteps: evaluation.workedSteps.map((step) => ({ ...step })),
        },
      });
    }
    case 'image_choice': {
      const imageChoiceAnswer = answer as Extract<
        RichClosedAnswer,
        { questionKind: 'image_choice' }
      >;
      assertKnownId(
        imageChoiceAnswer.choiceId,
        question.choices.map((choice) => choice.id),
      );

      return buildCorrectionItem({
        question,
        answer: imageChoiceAnswer,
        isCorrect: imageChoiceAnswer.choiceId === question.correctChoiceId,
        correction: { correctChoiceId: question.correctChoiceId },
      });
    }
  }
}

function assertKnownId(submittedId: string, knownIds: string[]) {
  if (!knownIds.includes(submittedId)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function deriveCalculationCorrectChoiceId(
  question: RichClosedCalculationMcqQuestion,
  expectedValue: number,
): string {
  const matchingChoices = question.choices.filter(
    (choice) => choice.value === expectedValue,
  );

  if (matchingChoices.length !== 1) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return matchingChoices[0].id;
}

function buildCorrectionItem(input: {
  question: RichClosedQuestion;
  answer: RichClosedAnswer;
  isCorrect: boolean;
  correction: RichClosedCorrectionPayload;
}): RichClosedCorrectionItem {
  return {
    questionId: input.question.id,
    questionKind: input.question.questionKind,
    prompt: input.question.prompt,
    submittedAnswer: cloneAnswer(input.answer),
    isCorrect: input.isCorrect,
    partialScore: input.isCorrect ? 1 : 0,
    explanation: input.question.explanation,
    sourceChunkIds: [...input.question.sourceChunkIds],
    correction: input.correction,
  };
}

function assertKnownIds(submittedIds: string[], knownIds: string[]) {
  if (
    submittedIds.length === 0 ||
    hasDuplicates(submittedIds) ||
    submittedIds.some((id) => !knownIds.includes(id))
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertDateSliderYear(
  year: number,
  question: Extract<RichClosedQuestion, { questionKind: 'date_slider' }>,
) {
  if (
    year < question.minYear ||
    year > question.maxYear ||
    (year - question.minYear) % question.step !== 0
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownPairs(
  pairs: RichClosedPair[],
  question: Extract<RichClosedQuestion, { questionKind: 'matching' }>,
) {
  const leftIds = question.leftItems.map((item) => item.id);
  const rightIds = question.rightItems.map((item) => item.id);
  const submittedLeftIds = pairs.map((pair) => pair.leftId);
  const submittedRightIds = pairs.map((pair) => pair.rightId);

  if (
    pairs.length === 0 ||
    pairs.length !== question.correctPairs.length ||
    hasDuplicates(submittedLeftIds) ||
    hasDuplicates(submittedRightIds) ||
    pairs.some(
      (pair) =>
        !leftIds.includes(pair.leftId) || !rightIds.includes(pair.rightId),
    )
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownTrueFalseValues(
  values: RichClosedTrueFalseValue[],
  question: Extract<RichClosedQuestion, { questionKind: 'true_false_grid' }>,
) {
  const rowIds = question.rows.map((row) => row.id);
  const submittedRowIds = values.map((value) => value.rowId);

  if (
    values.length === 0 ||
    values.length !== question.rows.length ||
    hasDuplicates(submittedRowIds) ||
    values.some((value) => !rowIds.includes(value.rowId))
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownCauseConsequencePairs(
  pairs: RichClosedCauseConsequencePair[],
  question: Extract<RichClosedQuestion, { questionKind: 'cause_consequence' }>,
) {
  const causeIds = question.causes.map((cause) => cause.id);
  const consequenceIds = question.consequences.map(
    (consequence) => consequence.id,
  );
  const submittedCauseIds = pairs.map((pair) => pair.causeId);
  const submittedConsequenceIds = pairs.map((pair) => pair.consequenceId);

  if (
    pairs.length === 0 ||
    pairs.length !== question.causes.length ||
    hasDuplicates(submittedCauseIds) ||
    hasDuplicates(submittedConsequenceIds) ||
    pairs.some(
      (pair) =>
        !causeIds.includes(pair.causeId) ||
        !consequenceIds.includes(pair.consequenceId),
    )
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }
}

function assertKnownInstitutionMatrixValues(
  values: RichClosedInstitutionMatrixValue[],
  question: Extract<RichClosedQuestion, { questionKind: 'institution_matrix' }>,
) {
  const cellIds = question.cells.map((cell) => cell.id);
  const cellsById = new Map(question.cells.map((cell) => [cell.id, cell]));
  const submittedCellIds = values.map((value) => value.cellId);

  if (
    values.length === 0 ||
    values.length !== question.cells.length ||
    hasDuplicates(submittedCellIds)
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  for (const value of values) {
    const cell = cellsById.get(value.cellId);

    if (
      !cellIds.includes(value.cellId) ||
      !cell ||
      !cell.options.some((option) => option.id === value.optionId)
    ) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }
  }
}

function assertKnownDiagramLabelingValues(
  values: RichClosedDiagramLabelingValue[],
  question: Extract<RichClosedQuestion, { questionKind: 'diagram_labeling' }>,
) {
  const slotIds = question.slots.map((slot) => slot.id);
  const slotsById = new Map(question.slots.map((slot) => [slot.id, slot]));
  const submittedSlotIds = values.map((value) => value.slotId);

  if (
    values.length === 0 ||
    values.length !== question.slots.length ||
    hasDuplicates(submittedSlotIds)
  ) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  for (const value of values) {
    const slot = slotsById.get(value.slotId);

    if (
      !slotIds.includes(value.slotId) ||
      !slot ||
      !slot.options.some((option) => option.id === value.optionId)
    ) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }
  }
}

function readRequiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.trim();
}

function readRequiredInteger(value: unknown): number {
  if (!Number.isInteger(value)) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value as number;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map(readRequiredString);
}

function readPairs(value: unknown): RichClosedPair[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((pair) => {
    if (!isRecord(pair)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      leftId: readRequiredString(pair.leftId),
      rightId: readRequiredString(pair.rightId),
    };
  });
}

function readTrueFalseValues(value: unknown): RichClosedTrueFalseValue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((item) => {
    if (!isRecord(item) || typeof item.value !== 'boolean') {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      rowId: readRequiredString(item.rowId),
      value: item.value,
    };
  });
}

function readCauseConsequencePairs(
  value: unknown,
): RichClosedCauseConsequencePair[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((pair) => {
    if (!isRecord(pair)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      causeId: readRequiredString(pair.causeId),
      consequenceId: readRequiredString(pair.consequenceId),
    };
  });
}

function readInstitutionMatrixValues(
  value: unknown,
): RichClosedInstitutionMatrixValue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      cellId: readRequiredString(item.cellId),
      optionId: readRequiredString(item.optionId),
    };
  });
}

function readDiagramLabelingValues(
  value: unknown,
): RichClosedDiagramLabelingValue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    }

    return {
      slotId: readRequiredString(item.slotId),
      optionId: readRequiredString(item.optionId),
    };
  });
}

function hasForbiddenSubmitField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenSubmitField);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => {
    if (
      key.startsWith('correct') ||
      key === 'correction' ||
      key === 'correctionPayload' ||
      key === 'explanation' ||
      key === 'feedback' ||
      key === 'choiceFeedback' ||
      key === 'modelAnswer' ||
      key === 'answerText' ||
      key === 'freeTextAnswer' ||
      key === 'textAnswer' ||
      key === 'score' ||
      key === 'partialScore' ||
      key === 'expectedValue' ||
      key === 'workedSteps' ||
      key === 'answersPayload' ||
      key === 'expectedAnswer' ||
      key === 'expectedAnswers' ||
      key === 'semanticLabel' ||
      key === 'answerHint' ||
      isForbiddenRenderKey(key)
    ) {
      return true;
    }

    return hasForbiddenSubmitField(nestedValue);
  });
}

function cloneAnswer(answer: RichClosedAnswer): RichClosedAnswer {
  switch (answer.questionKind) {
    case 'single_choice':
    case 'case_qualification':
      return { ...answer };
    case 'multiple_choice':
      return { ...answer, choiceIds: [...answer.choiceIds] };
    case 'matching':
      return { ...answer, pairs: clonePairs(answer.pairs) };
    case 'ordering':
      return { ...answer, orderedIds: [...answer.orderedIds] };
    case 'timeline':
      return { ...answer, orderedEventIds: [...answer.orderedEventIds] };
    case 'date_slider':
      return { ...answer };
    case 'true_false_grid':
      return { ...answer, values: cloneTrueFalseValues(answer.values) };
    case 'cause_consequence':
      return { ...answer, pairs: cloneCauseConsequencePairs(answer.pairs) };
    case 'institution_matrix':
      return { ...answer, values: cloneInstitutionMatrixValues(answer.values) };
    case 'diagram_labeling':
      return { ...answer, values: cloneDiagramLabelingValues(answer.values) };
    case 'calculation_mcq':
      return { ...answer };
    case 'image_choice':
      return { ...answer };
    case 'error_detection':
      return { ...answer };
  }
}

function clonePairs(pairs: RichClosedPair[]): RichClosedPair[] {
  return pairs.map((pair) => ({ ...pair }));
}

function cloneTrueFalseValues(
  values: RichClosedTrueFalseValue[],
): RichClosedTrueFalseValue[] {
  return values.map((value) => ({ ...value }));
}

function cloneCauseConsequencePairs(
  pairs: RichClosedCauseConsequencePair[],
): RichClosedCauseConsequencePair[] {
  return pairs.map((pair) => ({ ...pair }));
}

function cloneInstitutionMatrixValues(
  values: RichClosedInstitutionMatrixValue[],
): RichClosedInstitutionMatrixValue[] {
  return values.map((value) => ({ ...value }));
}

function cloneDiagramLabelingValues(
  values: RichClosedDiagramLabelingValue[],
): RichClosedDiagramLabelingValue[] {
  return values.map((value) => ({ ...value }));
}

function areStringSetsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    right.every((value) => left.includes(value))
  );
}

function arePairsEqual(left: RichClosedPair[], right: RichClosedPair[]) {
  return areStringSetsEqual(pairKeys(left), pairKeys(right));
}

function areTrueFalseValuesEqual(
  left: RichClosedTrueFalseValue[],
  right: RichClosedTrueFalseValue[],
) {
  return areStringSetsEqual(
    trueFalseValueKeys(left),
    trueFalseValueKeys(right),
  );
}

function areCauseConsequencePairsEqual(
  left: RichClosedCauseConsequencePair[],
  right: RichClosedCauseConsequencePair[],
) {
  return areStringSetsEqual(
    causeConsequencePairKeys(left),
    causeConsequencePairKeys(right),
  );
}

function areInstitutionMatrixValuesEqual(
  left: RichClosedInstitutionMatrixValue[],
  right: RichClosedInstitutionMatrixValue[],
) {
  return areStringSetsEqual(
    institutionMatrixValueKeys(left),
    institutionMatrixValueKeys(right),
  );
}

function areDiagramLabelingValuesEqual(
  left: RichClosedDiagramLabelingValue[],
  right: RichClosedDiagramLabelingValue[],
) {
  return areStringSetsEqual(
    diagramLabelingValueKeys(left),
    diagramLabelingValueKeys(right),
  );
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function pairKeys(pairs: RichClosedPair[]): string[] {
  return pairs.map((pair) => tupleKey(pair.leftId, pair.rightId));
}

function trueFalseValueKeys(values: RichClosedTrueFalseValue[]): string[] {
  return values.map((value) => tupleKey(value.rowId, value.value));
}

function causeConsequencePairKeys(
  pairs: RichClosedCauseConsequencePair[],
): string[] {
  return pairs.map((pair) => tupleKey(pair.causeId, pair.consequenceId));
}

function institutionMatrixValueKeys(
  values: RichClosedInstitutionMatrixValue[],
): string[] {
  return values.map((value) => tupleKey(value.cellId, value.optionId));
}

function diagramLabelingValueKeys(
  values: RichClosedDiagramLabelingValue[],
): string[] {
  return values.map((value) => tupleKey(value.slotId, value.optionId));
}

function tupleKey(...values: Array<string | boolean>): string {
  return JSON.stringify(values);
}

function isForbiddenRenderKey(key: string): boolean {
  return [
    'html',
    'svg',
    'rawSvg',
    'mermaid',
    'markdown',
    'widget',
    'component',
    'renderPayload',
    'style',
    'css',
    'script',
    'formula',
    'expression',
    'rawFormula',
    'calculationCode',
    'javascript',
    'python',
    'imageUrl',
    'assetUrl',
    'url',
    'remoteUrl',
    'src',
    'href',
    'storagePath',
    'bucketPath',
    'cdnUrl',
    'base64',
    'dataUri',
    'blob',
    'rawImage',
    'assetPath',
    'canvas',
    'code',
    'markup',
  ].includes(key);
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures.ts

~~~~ts
import {
  RICH_CLOSED_EXERCISE_VERSION,
  type RichClosedExercise,
  type RichClosedQuestion,
  type RichClosedCognitiveSkill,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';
import { getRichClosedImageAsset } from './rich-closed-image-assets';

type RichClosedBaseQuestionFields<K extends RichClosedQuestionKind> = Pick<
  Extract<RichClosedQuestion, { questionKind: K }>,
  'id' | 'questionKind' | 'difficulty' | 'cognitiveSkill' | 'sourceChunkIds'
>;

export function richClosedExerciseFixture(): RichClosedExercise {
  return {
    id: 'rich-exercise-1',
    version: RICH_CLOSED_EXERCISE_VERSION,
    title: 'Droit constitutionnel - exercice riche fermé',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    questions: [
      richClosedQuestionFixture('single_choice'),
      richClosedQuestionFixture('multiple_choice'),
      richClosedQuestionFixture('matching'),
      richClosedQuestionFixture('ordering'),
      richClosedQuestionFixture('case_qualification'),
      richClosedQuestionFixture('error_detection'),
    ],
  };
}

export function richClosedV1BExerciseFixture(): RichClosedExercise {
  const v1aFixture = richClosedExerciseFixture();

  return {
    ...v1aFixture,
    id: 'rich-exercise-v1b-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-B',
    questions: [
      ...v1aFixture.questions,
      richClosedQuestionFixture('timeline'),
      richClosedQuestionFixture('date_slider'),
    ],
  };
}

export function richClosedV1BFullExerciseFixture(): RichClosedExercise {
  const v1bFixture = richClosedV1BExerciseFixture();

  return {
    ...v1bFixture,
    id: 'rich-exercise-v1b-full-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-B complet',
    questions: [
      ...v1bFixture.questions,
      richClosedQuestionFixture('true_false_grid'),
      richClosedQuestionFixture('cause_consequence'),
    ],
  };
}

export function richClosedV1CExerciseFixture(): RichClosedExercise {
  const v1bFullFixture = richClosedV1BFullExerciseFixture();

  return {
    ...v1bFullFixture,
    id: 'rich-exercise-v1c-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-C',
    questions: [
      ...v1bFullFixture.questions,
      richClosedQuestionFixture('institution_matrix'),
    ],
  };
}

export function richClosedV1CFullExerciseFixture(): RichClosedExercise {
  const v1cFixture = richClosedV1CExerciseFixture();

  return {
    ...v1cFixture,
    id: 'rich-exercise-v1c-full-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-C complet',
    questions: [
      ...v1cFixture.questions,
      richClosedQuestionFixture('diagram_labeling'),
    ],
  };
}

export function richClosedV1CCalculationExerciseFixture(): RichClosedExercise {
  const v1cFullFixture = richClosedV1CFullExerciseFixture();

  return {
    ...v1cFullFixture,
    id: 'rich-exercise-v1c-calculation-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-C calcul',
    questions: [
      ...v1cFullFixture.questions,
      richClosedQuestionFixture('calculation_mcq'),
    ],
  };
}

export function richClosedV1DImageChoiceExerciseFixture(): RichClosedExercise {
  const v1cCalculationFixture = richClosedV1CCalculationExerciseFixture();

  return {
    ...v1cCalculationFixture,
    id: 'rich-exercise-v1d-image-choice-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-D image',
    questions: [
      ...v1cCalculationFixture.questions,
      richClosedQuestionFixture('image_choice'),
    ],
  };
}

export function richClosedQuestionFixture(
  questionKind: RichClosedQuestionKind,
): RichClosedQuestion {
  switch (questionKind) {
    case 'single_choice':
      return {
        ...baseQuestion('single-1', 'single_choice'),
        prompt:
          'Quel critère institutionnel caractérise le mieux un régime parlementaire ?',
        choices: [
          { id: 'choice-a', label: 'La responsabilité politique' },
          { id: 'choice-b', label: 'La séparation totalement étanche' },
          { id: 'choice-c', label: 'La souveraineté des entités fédérées' },
        ],
        correctChoiceId: 'choice-a',
        explanation:
          'La responsabilité politique du gouvernement devant le Parlement est un critère central.',
      };
    case 'multiple_choice':
      return {
        ...baseQuestion('multiple-1', 'multiple_choice'),
        prompt: 'Quels indices peuvent orienter vers un régime parlementaire ?',
        choices: [
          { id: 'choice-a', label: 'Responsabilité du gouvernement' },
          { id: 'choice-b', label: 'Collaboration des pouvoirs' },
          { id: 'choice-c', label: 'Indépendance organique absolue' },
          { id: 'choice-d', label: 'Absence de Parlement' },
        ],
        minSelections: 2,
        maxSelections: 2,
        correctChoiceIds: ['choice-a', 'choice-b'],
        explanation:
          'Le parlementarisme repose sur la responsabilité et des moyens d’action réciproques.',
      };
    case 'matching':
      return {
        ...baseQuestion('matching-1', 'matching'),
        prompt: 'Associe chaque mécanisme à sa fonction principale.',
        leftItems: [
          { id: 'left-1', label: 'Motion de censure' },
          { id: 'left-2', label: 'Dissolution' },
          { id: 'left-3', label: 'Contrôle constitutionnel' },
        ],
        rightItems: [
          { id: 'right-1', label: 'Responsabilité politique' },
          { id: 'right-2', label: 'Fin anticipée d’une chambre' },
          { id: 'right-3', label: 'Vérification d’une norme' },
        ],
        correctPairs: [
          { leftId: 'left-1', rightId: 'right-1' },
          { leftId: 'left-2', rightId: 'right-2' },
          { leftId: 'left-3', rightId: 'right-3' },
        ],
        explanation:
          'Chaque mécanisme renvoie à une fonction institutionnelle différente.',
      };
    case 'ordering':
      return {
        ...baseQuestion('ordering-1', 'ordering'),
        prompt:
          'Remets dans l’ordre les étapes d’un raisonnement de qualification.',
        items: [
          { id: 'item-1', label: 'Repérer les organes' },
          { id: 'item-2', label: 'Analyser leurs moyens d’action' },
          { id: 'item-3', label: 'Qualifier le régime' },
        ],
        correctOrder: ['item-1', 'item-2', 'item-3'],
        explanation:
          'La qualification vient après l’identification des critères institutionnels.',
      };
    case 'timeline':
      return {
        ...baseQuestion('timeline-1', 'timeline'),
        prompt: 'Remets dans l’ordre ces étapes du contrôle parlementaire.',
        instruction:
          'Classe les événements de la première étape à la dernière.',
        events: [
          {
            id: 'event-1',
            label: 'Dépôt de la motion',
            description: 'Des parlementaires engagent la procédure.',
          },
          {
            id: 'event-2',
            label: 'Débat politique',
            description: 'La chambre discute la responsabilité engagée.',
          },
          {
            id: 'event-3',
            label: 'Vote de la chambre',
            description: 'La chambre décide si la motion est adoptée.',
          },
        ],
        correctOrder: ['event-1', 'event-2', 'event-3'],
        explanation:
          'Le contrôle suit une séquence procédurale : initiative, discussion, puis vote.',
      };
    case 'date_slider':
      return {
        ...baseQuestion('date-slider-1', 'date_slider'),
        prompt:
          'Place approximativement l’adoption de la Constitution de la Ve République.',
        instruction: 'Choisis une année entière dans la période proposée.',
        minYear: 1945,
        maxYear: 1970,
        step: 1,
        correctYear: 1958,
        toleranceYears: 0,
        explanation: 'La Constitution de la Ve République est adoptée en 1958.',
      };
    case 'true_false_grid':
      return {
        ...baseQuestion('true-false-grid-1', 'true_false_grid'),
        prompt:
          'Indique si chaque affirmation sur le régime parlementaire est vraie ou fausse.',
        instruction:
          'Choisis vrai ou faux pour chaque ligne sans laisser de ligne vide.',
        rows: [
          {
            id: 'row-1',
            statement:
              'Le gouvernement peut être politiquement responsable devant le Parlement.',
            context: 'Critère classique du régime parlementaire.',
          },
          {
            id: 'row-2',
            statement:
              'La séparation des pouvoirs y interdit toute collaboration institutionnelle.',
            context: 'Attention à la distinction avec la séparation stricte.',
          },
          {
            id: 'row-3',
            statement: 'La dissolution peut être un moyen d’action réciproque.',
            context: 'Elle équilibre la responsabilité politique.',
          },
        ],
        correctValues: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'row-3', value: true },
        ],
        explanation:
          'Le parlementarisme combine responsabilité politique et collaboration des pouvoirs, dont la dissolution peut faire partie.',
      };
    case 'cause_consequence':
      return {
        ...baseQuestion('cause-consequence-1', 'cause_consequence'),
        prompt:
          'Associe chaque mécanisme institutionnel à sa conséquence politique.',
        instruction:
          'Sélectionne une conséquence différente pour chaque cause proposée.',
        causes: [
          {
            id: 'cause-1',
            label: 'Motion de censure adoptée',
            description: 'La chambre retire sa confiance au gouvernement.',
          },
          {
            id: 'cause-2',
            label: 'Dissolution de l’Assemblée',
            description: 'Le mandat de la chambre prend fin avant terme.',
          },
          {
            id: 'cause-3',
            label: 'Question de confiance rejetée',
            description: 'Le gouvernement engage sa responsabilité.',
          },
        ],
        consequences: [
          {
            id: 'consequence-1',
            label: 'Démission du gouvernement',
            description:
              'La responsabilité politique entraîne la sortie du gouvernement.',
          },
          {
            id: 'consequence-2',
            label: 'Nouvelles élections législatives',
            description: 'Le corps électoral renouvelle la chambre.',
          },
          {
            id: 'consequence-3',
            label: 'Crise politique ou départ du gouvernement',
            description:
              'Le rejet manifeste une perte de confiance parlementaire.',
          },
        ],
        correctPairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-2' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
        explanation:
          'Chaque cause active une conséquence institutionnelle distincte dans la logique parlementaire.',
      };
    case 'institution_matrix':
      return {
        ...baseQuestion('institution-matrix-1', 'institution_matrix'),
        prompt:
          'Complète la matrice comparant trois institutions de la Ve République.',
        instruction:
          'Choisis une option fermée pour chaque cellule demandée, sans réponse libre.',
        rows: [
          {
            id: 'row-president',
            label: 'Président de la République',
            description: 'Chef de l’État sous la Ve République.',
          },
          {
            id: 'row-government',
            label: 'Gouvernement',
            description: 'Organe qui conduit la politique de la Nation.',
          },
          {
            id: 'row-assembly',
            label: 'Assemblée nationale',
            description: 'Chambre élue au suffrage universel direct.',
          },
        ],
        columns: [
          {
            id: 'column-legitimacy',
            label: 'Mode de légitimité',
          },
          {
            id: 'column-action',
            label: 'Moyen d’action',
          },
          {
            id: 'column-responsibility',
            label: 'Responsabilité politique',
          },
        ],
        cells: [
          {
            id: 'cell-president-legitimacy',
            rowId: 'row-president',
            columnId: 'column-legitimacy',
            prompt: 'Quelle légitimité caractérise le Président ?',
            options: [
              {
                id: 'option-legitimacy-election',
                label: 'Élection au suffrage universel',
              },
              {
                id: 'option-legitimacy-confidence',
                label: 'Confiance parlementaire',
              },
              {
                id: 'option-legitimacy-nomination',
                label: 'Nomination par le Gouvernement',
              },
            ],
          },
          {
            id: 'cell-government-responsibility',
            rowId: 'row-government',
            columnId: 'column-responsibility',
            prompt: 'Devant qui le Gouvernement est-il responsable ?',
            options: [
              {
                id: 'option-responsibility-assembly',
                label: 'Assemblée nationale',
              },
              {
                id: 'option-responsibility-senate',
                label: 'Sénat seul',
              },
              {
                id: 'option-responsibility-none',
                label: 'Aucune responsabilité politique',
              },
            ],
          },
          {
            id: 'cell-assembly-action',
            rowId: 'row-assembly',
            columnId: 'column-action',
            prompt: 'Quel moyen d’action appartient à l’Assemblée nationale ?',
            options: [
              {
                id: 'option-action-censure',
                label: 'Motion de censure',
              },
              {
                id: 'option-action-dissolution',
                label: 'Dissolution de sa propre chambre',
              },
              {
                id: 'option-action-promulgation',
                label: 'Promulgation des lois',
              },
            ],
          },
        ],
        correctValues: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
        explanation:
          'La matrice distingue la légitimité présidentielle, la responsabilité du Gouvernement devant l’Assemblée nationale et le moyen de contrôle parlementaire.',
      };
    case 'diagram_labeling':
      return {
        ...baseQuestion('diagram-labeling-1', 'diagram_labeling'),
        prompt:
          'Complète les étiquettes manquantes dans le schéma des rapports institutionnels.',
        instruction:
          'Choisis une option fermée pour chaque emplacement du schéma.',
        diagram: {
          title: 'Rapports institutionnels sous la Ve République',
          description:
            'Schéma sémantique borné entre Président, Gouvernement et Parlement.',
          layout: 'vertical_flow',
          nodes: [
            {
              id: 'node-president',
              label: 'Président de la République',
              description: 'Chef de l’État.',
              groupId: 'group-executive',
            },
            {
              id: 'node-government',
              label: 'Gouvernement',
              description: 'Conduit la politique de la Nation.',
              groupId: 'group-executive',
            },
            {
              id: 'node-assembly',
              label: 'Assemblée nationale',
              description: 'Chambre politiquement déterminante.',
              groupId: 'group-parliament',
            },
            {
              id: 'node-senate',
              label: 'Sénat',
              description: 'Chambre représentant les collectivités.',
              groupId: 'group-parliament',
            },
          ],
          groups: [
            {
              id: 'group-executive',
              label: 'Exécutif',
            },
            {
              id: 'group-parliament',
              label: 'Parlement',
            },
          ],
          edges: [
            {
              id: 'edge-president-government',
              fromNodeId: 'node-president',
              toNodeId: 'node-government',
              label: 'nomination',
            },
            {
              id: 'edge-government-assembly',
              fromNodeId: 'node-government',
              toNodeId: 'node-assembly',
              label: 'responsabilité politique',
            },
            {
              id: 'edge-assembly-government',
              fromNodeId: 'node-assembly',
              toNodeId: 'node-government',
              label: 'contrôle',
            },
          ],
        },
        slots: [
          {
            id: 'slot-government-role',
            anchorType: 'node',
            anchorId: 'node-government',
            prompt: 'Quel organe conduit la politique de la Nation ?',
            options: [
              { id: 'option-government', label: 'Gouvernement' },
              { id: 'option-president', label: 'Président de la République' },
              { id: 'option-senate', label: 'Sénat' },
            ],
          },
          {
            id: 'slot-censure',
            anchorType: 'edge',
            anchorId: 'edge-assembly-government',
            prompt:
              'Quel mécanisme peut renverser politiquement le Gouvernement ?',
            options: [
              { id: 'option-motion-censure', label: 'Motion de censure' },
              { id: 'option-promulgation', label: 'Promulgation' },
              { id: 'option-referendum', label: 'Référendum' },
            ],
          },
          {
            id: 'slot-nomination',
            anchorType: 'edge',
            anchorId: 'edge-president-government',
            prompt: 'Quel pouvoir intervient dans la nomination ?',
            options: [
              { id: 'option-nomination', label: 'Pouvoir de nomination' },
              { id: 'option-censure', label: 'Motion de censure' },
              { id: 'option-amendment', label: 'Droit d’amendement' },
            ],
          },
        ],
        correctValues: [
          {
            slotId: 'slot-government-role',
            optionId: 'option-government',
          },
          {
            slotId: 'slot-censure',
            optionId: 'option-motion-censure',
          },
          {
            slotId: 'slot-nomination',
            optionId: 'option-nomination',
          },
        ],
        explanation:
          'Le schéma relie le rôle du Gouvernement, sa responsabilité devant l’Assemblée nationale et le pouvoir de nomination présidentielle.',
      };
    case 'calculation_mcq':
      return richClosedCalculationMcqAbsoluteMajorityFixture();
    case 'image_choice':
      return richClosedImageChoiceFixture();
    case 'case_qualification':
      return {
        ...baseQuestion('case-1', 'case_qualification'),
        prompt: 'Choisis la qualification juridique la plus pertinente.',
        caseText:
          'Un gouvernement doit conserver la confiance d’une chambre élue qui peut le renverser politiquement.',
        choices: [
          { id: 'choice-a', label: 'Régime parlementaire' },
          { id: 'choice-b', label: 'Régime présidentiel' },
          { id: 'choice-c', label: 'Confédération' },
        ],
        correctChoiceId: 'choice-a',
        explanation:
          'La responsabilité politique devant la chambre élue oriente vers le régime parlementaire.',
      };
    case 'error_detection':
      return {
        ...baseQuestion('error-1', 'error_detection'),
        prompt: 'Repère l’erreur dominante dans le raisonnement.',
        statement:
          'Un régime présidentiel se définit par la responsabilité politique du gouvernement devant le Parlement.',
        errorOptions: [
          { id: 'error-a', label: 'Confusion avec le régime parlementaire' },
          { id: 'error-b', label: 'Confusion avec l’État fédéral' },
          { id: 'error-c', label: 'Confusion avec le contrôle juridictionnel' },
        ],
        correctErrorId: 'error-a',
        explanation:
          'La responsabilité politique du gouvernement devant le Parlement est le critère du parlementarisme.',
      };
  }
}

export function richClosedImageChoiceFixture(): Extract<
  RichClosedQuestion,
  { questionKind: 'image_choice' }
> {
  const assetA = readFixtureImageAsset('image-choice-historical-figure-001-v1');
  const assetB = readFixtureImageAsset('image-choice-historical-figure-002-v1');
  const assetC = readFixtureImageAsset('image-choice-historical-figure-003-v1');

  return {
    ...baseQuestion('image-choice-1', 'image_choice'),
    prompt:
      'Quel portrait correspond au personnage associé à l’appel du 18 juin ?',
    instruction:
      'Choisis uniquement parmi les images du catalogue contrôlé, sans réponse libre.',
    choices: [
      {
        id: 'choice-image-a',
        label: 'Image A',
        imageAssetId: assetA.id,
        altText: assetA.publicAltText,
        caption: 'Portrait historique A',
        creditLabel: assetA.creditLabel,
        license: assetA.license,
      },
      {
        id: 'choice-image-b',
        label: 'Image B',
        imageAssetId: assetB.id,
        altText: assetB.publicAltText,
        caption: 'Portrait historique B',
        creditLabel: assetB.creditLabel,
        license: assetB.license,
      },
      {
        id: 'choice-image-c',
        label: 'Image C',
        imageAssetId: assetC.id,
        altText: assetC.publicAltText,
        caption: 'Portrait historique C',
        creditLabel: assetC.creditLabel,
        license: assetC.license,
      },
    ],
    correctChoiceId: 'choice-image-a',
    explanation: 'L’appel du 18 juin 1940 est associé à Charles de Gaulle.',
  };
}

export function richClosedCalculationMcqAbsoluteMajorityFixture(): Extract<
  RichClosedQuestion,
  { questionKind: 'calculation_mcq' }
> {
  return {
    ...baseQuestion('calculation-mcq-majority-1', 'calculation_mcq'),
    prompt:
      'Calcule le seuil de majorité absolue à partir des suffrages exprimés.',
    instruction:
      'Sélectionne uniquement la valeur correspondant au calcul demandé.',
    scenario:
      'Lors d’un vote avec 577 suffrages exprimés, combien de voix faut-il pour obtenir la majorité absolue ?',
    calculation: {
      mode: 'absolute_majority_threshold',
      validVotes: 577,
    },
    choices: [
      { id: 'choice-288', label: '288 voix', value: 288 },
      { id: 'choice-289', label: '289 voix', value: 289 },
      { id: 'choice-290', label: '290 voix', value: 290 },
    ],
    correctChoiceId: 'choice-289',
    explanation:
      'La majorité absolue correspond à floor(577 / 2) + 1, soit 289 voix.',
  };
}

export function richClosedCalculationMcqLargestRemainderFixture(): Extract<
  RichClosedQuestion,
  { questionKind: 'calculation_mcq' }
> {
  return {
    ...baseQuestion('calculation-mcq-remainder-1', 'calculation_mcq'),
    prompt:
      'Calcule le nombre de sièges obtenu par la liste cible au plus fort reste.',
    instruction:
      'Utilise les données fournies et choisis le résultat fermé correspondant.',
    scenario:
      'Dix sièges sont répartis au quota de Hare entre quatre listes. Combien de sièges obtient la Liste A ?',
    calculation: {
      mode: 'largest_remainder_target_party_seats',
      totalSeats: 10,
      targetPartyId: 'party-a',
      parties: [
        { id: 'party-a', label: 'Liste A', votes: 4300 },
        { id: 'party-b', label: 'Liste B', votes: 3100 },
        { id: 'party-c', label: 'Liste C', votes: 1600 },
        { id: 'party-d', label: 'Liste D', votes: 1000 },
      ],
    },
    choices: [
      { id: 'choice-3', label: '3 sièges', value: 3 },
      { id: 'choice-4', label: '4 sièges', value: 4 },
      { id: 'choice-5', label: '5 sièges', value: 5 },
    ],
    correctChoiceId: 'choice-4',
    explanation:
      'La Liste A obtient quatre sièges après attribution initiale; le siège restant revient à la Liste C.',
  };
}

function baseQuestion<K extends RichClosedQuestionKind>(
  id: string,
  questionKind: K,
): RichClosedBaseQuestionFields<K> {
  const cognitiveSkill: RichClosedCognitiveSkill = (() => {
    switch (questionKind) {
      case 'single_choice':
        return 'comparison';
      case 'timeline':
        return 'procedure';
      case 'date_slider':
        return 'comprehension';
      case 'true_false_grid':
        return 'classification';
      case 'cause_consequence':
        return 'causality';
      case 'institution_matrix':
        return 'comparison';
      case 'diagram_labeling':
        return 'classification';
      case 'image_choice':
        return 'memorization';
      default:
        return 'case_application';
    }
  })();

  return {
    id,
    questionKind,
    difficulty: 'MEDIUM',
    cognitiveSkill,
    sourceChunkIds: ['chunk-1'],
  } as RichClosedBaseQuestionFields<K>;
}

function readFixtureImageAsset(id: string) {
  const asset = getRichClosedImageAsset(id);

  if (asset === null) {
    throw new Error(`Missing fixture image asset ${id}`);
  }

  return asset;
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts

~~~~ts
import type { RichClosedImageAssetLicense } from './rich-closed-image-assets';

export const RICH_CLOSED_EXERCISE_VERSION = 'rich-closed-question-v1';

export type RichClosedExerciseVersion = typeof RICH_CLOSED_EXERCISE_VERSION;

export const RICH_CLOSED_QUESTION_KINDS = [
  'single_choice',
  'multiple_choice',
  'matching',
  'ordering',
  'case_qualification',
  'error_detection',
  'timeline',
  'date_slider',
  'true_false_grid',
  'cause_consequence',
  'institution_matrix',
  'diagram_labeling',
  'calculation_mcq',
  'image_choice',
] as const;

export type RichClosedQuestionKind =
  (typeof RICH_CLOSED_QUESTION_KINDS)[number];

export type RichClosedDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export const RICH_CLOSED_COGNITIVE_SKILLS = [
  'memorization',
  'comprehension',
  'comparison',
  'classification',
  'case_application',
  'procedure',
  'error_detection',
  'causality',
] as const;

export type RichClosedCognitiveSkill =
  (typeof RICH_CLOSED_COGNITIVE_SKILLS)[number];

export interface RichClosedChoice {
  id: string;
  label: string;
  feedback?: string | null;
}

export interface RichClosedPublicChoice {
  id: string;
  label: string;
}

export interface RichClosedPair {
  leftId: string;
  rightId: string;
}

export interface RichClosedLabelItem {
  id: string;
  label: string;
}

export interface RichClosedTimelineEvent {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedTrueFalseRow {
  id: string;
  statement: string;
  context?: string | null;
}

export interface RichClosedTrueFalseValue {
  rowId: string;
  value: boolean;
}

export interface RichClosedCauseConsequenceItem {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedCauseConsequencePair {
  causeId: string;
  consequenceId: string;
}

export interface RichClosedInstitutionMatrixAxisItem {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedInstitutionMatrixOption {
  id: string;
  label: string;
}

export interface RichClosedInstitutionMatrixCell {
  id: string;
  rowId: string;
  columnId: string;
  prompt?: string | null;
  options: RichClosedInstitutionMatrixOption[];
}

export interface RichClosedInstitutionMatrixValue {
  cellId: string;
  optionId: string;
}

export type RichClosedDiagramLayout =
  | 'vertical_flow'
  | 'two_column'
  | 'cycle'
  | 'hierarchy'
  | 'plain';

export type RichClosedDiagramAnchorType = 'node' | 'edge';

export interface RichClosedDiagramGroup {
  id: string;
  label: string;
  description?: string | null;
}

export interface RichClosedDiagramNode {
  id: string;
  label: string;
  description?: string | null;
  groupId?: string | null;
}

export interface RichClosedDiagramEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string | null;
  description?: string | null;
}

export interface RichClosedDiagram {
  title?: string | null;
  description?: string | null;
  layout: RichClosedDiagramLayout;
  nodes: RichClosedDiagramNode[];
  groups?: RichClosedDiagramGroup[];
  edges: RichClosedDiagramEdge[];
}

export interface RichClosedDiagramLabelingOption {
  id: string;
  label: string;
}

export interface RichClosedDiagramLabelingSlot {
  id: string;
  anchorType: RichClosedDiagramAnchorType;
  anchorId: string;
  prompt: string;
  options: RichClosedDiagramLabelingOption[];
}

export interface RichClosedDiagramLabelingValue {
  slotId: string;
  optionId: string;
}

export interface RichClosedCalculationChoice {
  id: string;
  label: string;
  value: number;
}

export interface RichClosedImageChoiceOption {
  id: string;
  label: string;
  imageAssetId: string;
  altText: string;
  caption?: string | null;
  creditLabel?: string | null;
  license?: RichClosedImageAssetLicense;
}

export interface RichClosedCalculationParty {
  id: string;
  label: string;
  votes: number;
}

export interface RichClosedCalculationWorkedStep {
  id: string;
  label: string;
  detail: string;
  value?: number;
}

export interface RichClosedAbsoluteMajorityThresholdCalculation {
  mode: 'absolute_majority_threshold';
  validVotes: number;
}

export interface RichClosedLargestRemainderTargetPartySeatsCalculation {
  mode: 'largest_remainder_target_party_seats';
  totalSeats: number;
  targetPartyId: string;
  parties: RichClosedCalculationParty[];
}

export type RichClosedCalculationData =
  | RichClosedAbsoluteMajorityThresholdCalculation
  | RichClosedLargestRemainderTargetPartySeatsCalculation;

export interface RichClosedQuestionBase {
  id: string;
  questionKind: RichClosedQuestionKind;
  prompt: string;
  difficulty: RichClosedDifficulty;
  cognitiveSkill: RichClosedCognitiveSkill;
  sourceChunkIds: string[];
}

export interface RichClosedSingleChoiceQuestion extends RichClosedQuestionBase {
  questionKind: 'single_choice';
  choices: RichClosedChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedMultipleChoiceQuestion extends RichClosedQuestionBase {
  questionKind: 'multiple_choice';
  choices: RichClosedChoice[];
  minSelections: number;
  maxSelections: number;
  correctChoiceIds: string[];
  explanation: string;
}

export interface RichClosedMatchingQuestion extends RichClosedQuestionBase {
  questionKind: 'matching';
  leftItems: RichClosedLabelItem[];
  rightItems: RichClosedLabelItem[];
  correctPairs: RichClosedPair[];
  explanation: string;
}

export interface RichClosedOrderingQuestion extends RichClosedQuestionBase {
  questionKind: 'ordering';
  items: RichClosedLabelItem[];
  correctOrder: string[];
  explanation: string;
}

export interface RichClosedTimelineQuestion extends RichClosedQuestionBase {
  questionKind: 'timeline';
  instruction?: string | null;
  events: RichClosedTimelineEvent[];
  correctOrder: string[];
  explanation: string;
}

export interface RichClosedDateSliderQuestion extends RichClosedQuestionBase {
  questionKind: 'date_slider';
  instruction?: string | null;
  minYear: number;
  maxYear: number;
  step: number;
  correctYear: number;
  toleranceYears: number;
  explanation: string;
}

export interface RichClosedTrueFalseGridQuestion extends RichClosedQuestionBase {
  questionKind: 'true_false_grid';
  instruction?: string | null;
  rows: RichClosedTrueFalseRow[];
  correctValues: RichClosedTrueFalseValue[];
  explanation: string;
}

export interface RichClosedCauseConsequenceQuestion extends RichClosedQuestionBase {
  questionKind: 'cause_consequence';
  instruction?: string | null;
  causes: RichClosedCauseConsequenceItem[];
  consequences: RichClosedCauseConsequenceItem[];
  correctPairs: RichClosedCauseConsequencePair[];
  explanation: string;
}

export interface RichClosedInstitutionMatrixQuestion extends RichClosedQuestionBase {
  questionKind: 'institution_matrix';
  instruction?: string | null;
  rows: RichClosedInstitutionMatrixAxisItem[];
  columns: RichClosedInstitutionMatrixAxisItem[];
  cells: RichClosedInstitutionMatrixCell[];
  correctValues: RichClosedInstitutionMatrixValue[];
  explanation: string;
}

export interface RichClosedDiagramLabelingQuestion extends RichClosedQuestionBase {
  questionKind: 'diagram_labeling';
  instruction?: string | null;
  diagram: RichClosedDiagram;
  slots: RichClosedDiagramLabelingSlot[];
  correctValues: RichClosedDiagramLabelingValue[];
  explanation: string;
}

export interface RichClosedCalculationMcqQuestion extends RichClosedQuestionBase {
  questionKind: 'calculation_mcq';
  instruction?: string | null;
  scenario: string;
  calculation: RichClosedCalculationData;
  choices: RichClosedCalculationChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedImageChoiceQuestion extends RichClosedQuestionBase {
  questionKind: 'image_choice';
  instruction?: string | null;
  choices: RichClosedImageChoiceOption[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedCaseQualificationQuestion extends RichClosedQuestionBase {
  questionKind: 'case_qualification';
  caseText: string;
  choices: RichClosedChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface RichClosedErrorDetectionQuestion extends RichClosedQuestionBase {
  questionKind: 'error_detection';
  statement: string;
  errorOptions: RichClosedChoice[];
  correctErrorId: string;
  explanation: string;
}

export type RichClosedQuestion =
  | RichClosedSingleChoiceQuestion
  | RichClosedMultipleChoiceQuestion
  | RichClosedMatchingQuestion
  | RichClosedOrderingQuestion
  | RichClosedCaseQualificationQuestion
  | RichClosedErrorDetectionQuestion
  | RichClosedTimelineQuestion
  | RichClosedDateSliderQuestion
  | RichClosedTrueFalseGridQuestion
  | RichClosedCauseConsequenceQuestion
  | RichClosedInstitutionMatrixQuestion
  | RichClosedDiagramLabelingQuestion
  | RichClosedCalculationMcqQuestion
  | RichClosedImageChoiceQuestion;

export interface RichClosedPublicQuestionBase {
  id: string;
  questionKind: RichClosedQuestionKind;
  prompt: string;
  difficulty: RichClosedDifficulty;
  cognitiveSkill: RichClosedCognitiveSkill;
  sourceChunkIds: string[];
}

export interface RichClosedPublicSingleChoiceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'single_choice';
  choices: RichClosedPublicChoice[];
}

export interface RichClosedPublicMultipleChoiceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'multiple_choice';
  choices: RichClosedPublicChoice[];
  minSelections: number;
  maxSelections: number;
}

export interface RichClosedPublicMatchingQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'matching';
  leftItems: RichClosedLabelItem[];
  rightItems: RichClosedLabelItem[];
}

export interface RichClosedPublicOrderingQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'ordering';
  items: RichClosedLabelItem[];
}

export interface RichClosedPublicTimelineQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'timeline';
  instruction?: string | null;
  events: RichClosedTimelineEvent[];
}

export interface RichClosedPublicDateSliderQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'date_slider';
  instruction?: string | null;
  minYear: number;
  maxYear: number;
  step: number;
  toleranceYears: number;
}

export interface RichClosedPublicTrueFalseGridQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'true_false_grid';
  instruction?: string | null;
  rows: RichClosedTrueFalseRow[];
}

export interface RichClosedPublicCauseConsequenceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'cause_consequence';
  instruction?: string | null;
  causes: RichClosedCauseConsequenceItem[];
  consequences: RichClosedCauseConsequenceItem[];
}

export interface RichClosedPublicInstitutionMatrixQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'institution_matrix';
  instruction?: string | null;
  rows: RichClosedInstitutionMatrixAxisItem[];
  columns: RichClosedInstitutionMatrixAxisItem[];
  cells: RichClosedInstitutionMatrixCell[];
}

export interface RichClosedPublicDiagramLabelingQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'diagram_labeling';
  instruction?: string | null;
  diagram: RichClosedDiagram;
  slots: RichClosedDiagramLabelingSlot[];
}

export interface RichClosedPublicCalculationMcqQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'calculation_mcq';
  instruction?: string | null;
  scenario: string;
  calculation: RichClosedCalculationData;
  choices: RichClosedCalculationChoice[];
}

export interface RichClosedPublicImageChoiceQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'image_choice';
  instruction?: string | null;
  choices: RichClosedImageChoiceOption[];
}

export interface RichClosedPublicCaseQualificationQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'case_qualification';
  caseText: string;
  choices: RichClosedPublicChoice[];
}

export interface RichClosedPublicErrorDetectionQuestion extends RichClosedPublicQuestionBase {
  questionKind: 'error_detection';
  statement: string;
  errorOptions: RichClosedPublicChoice[];
}

export type RichClosedPublicQuestion =
  | RichClosedPublicSingleChoiceQuestion
  | RichClosedPublicMultipleChoiceQuestion
  | RichClosedPublicMatchingQuestion
  | RichClosedPublicOrderingQuestion
  | RichClosedPublicCaseQualificationQuestion
  | RichClosedPublicErrorDetectionQuestion
  | RichClosedPublicTimelineQuestion
  | RichClosedPublicDateSliderQuestion
  | RichClosedPublicTrueFalseGridQuestion
  | RichClosedPublicCauseConsequenceQuestion
  | RichClosedPublicInstitutionMatrixQuestion
  | RichClosedPublicDiagramLabelingQuestion
  | RichClosedPublicCalculationMcqQuestion
  | RichClosedPublicImageChoiceQuestion;

export type RichClosedAnswer =
  | {
      questionId: string;
      questionKind: 'single_choice';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'case_qualification';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'multiple_choice';
      choiceIds: string[];
    }
  | {
      questionId: string;
      questionKind: 'matching';
      pairs: RichClosedPair[];
    }
  | {
      questionId: string;
      questionKind: 'ordering';
      orderedIds: string[];
    }
  | {
      questionId: string;
      questionKind: 'timeline';
      orderedEventIds: string[];
    }
  | {
      questionId: string;
      questionKind: 'date_slider';
      year: number;
    }
  | {
      questionId: string;
      questionKind: 'true_false_grid';
      values: RichClosedTrueFalseValue[];
    }
  | {
      questionId: string;
      questionKind: 'cause_consequence';
      pairs: RichClosedCauseConsequencePair[];
    }
  | {
      questionId: string;
      questionKind: 'institution_matrix';
      values: RichClosedInstitutionMatrixValue[];
    }
  | {
      questionId: string;
      questionKind: 'diagram_labeling';
      values: RichClosedDiagramLabelingValue[];
    }
  | {
      questionId: string;
      questionKind: 'calculation_mcq';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'image_choice';
      choiceId: string;
    }
  | {
      questionId: string;
      questionKind: 'error_detection';
      errorId: string;
    };

export interface RichClosedCorrection {
  questionId: string;
  questionKind: RichClosedQuestionKind;
  isCorrect: boolean;
  partialScore?: number;
  explanation: string;
}

export type RichClosedCorrectionPayload =
  | { correctChoiceId: string }
  | { correctChoiceIds: string[] }
  | { correctPairs: RichClosedPair[] }
  | { correctValues: RichClosedTrueFalseValue[] }
  | { correctPairs: RichClosedCauseConsequencePair[] }
  | { correctValues: RichClosedInstitutionMatrixValue[] }
  | { correctValues: RichClosedDiagramLabelingValue[] }
  | {
      correctChoiceId: string;
      expectedValue: number;
      workedSteps: RichClosedCalculationWorkedStep[];
    }
  | { correctOrder: string[] }
  | { correctYear: number; minAcceptedYear: number; maxAcceptedYear: number }
  | { correctErrorId: string };

export interface RichClosedCorrectionItem {
  questionId: string;
  questionKind: RichClosedQuestionKind;
  prompt: string;
  submittedAnswer: RichClosedAnswer | null;
  isCorrect: boolean;
  partialScore: number;
  explanation: string;
  sourceChunkIds: string[];
  correction: RichClosedCorrectionPayload;
}

export interface RichClosedExerciseResult {
  sessionId: string;
  type: 'rich_closed_exercise';
  status: 'completed';
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  items: RichClosedCorrectionItem[];
}

export interface RichClosedExercise {
  id: string;
  version: RichClosedExerciseVersion;
  title: string;
  subjectId?: string;
  documentId?: string | null;
  knowledgeUnitId?: string;
  questions: RichClosedQuestion[];
}

export interface RichClosedPublicExercise {
  id: string;
  version: RichClosedExerciseVersion;
  title: string;
  subjectId?: string;
  documentId?: string | null;
  knowledgeUnitId?: string;
  questions: RichClosedPublicQuestion[];
}

export interface RichClosedPublicExerciseEnvelope extends RichClosedPublicExercise {
  sessionId: string;
  type: 'rich_closed_exercise';
}

export type RichClosedExerciseValidationSeverity = 'error' | 'warning';

export interface RichClosedExerciseValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: RichClosedExerciseValidationSeverity;
}

export interface RichClosedExerciseValidationResult {
  accepted: boolean;
  issues: RichClosedExerciseValidationIssue[];
}

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.spec.ts

~~~~ts
import {
  validateRichClosedExercise,
  validateRichClosedQuestion,
} from './rich-closed-question.validator';
import {
  richClosedExerciseFixture,
  richClosedCalculationMcqLargestRemainderFixture,
  richClosedQuestionFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from './rich-closed-question.fixtures';
import type { RichClosedQuestion } from './rich-closed-question.types';

describe('rich closed question validator', () => {
  it.each([
    'single_choice',
    'multiple_choice',
    'matching',
    'ordering',
    'case_qualification',
    'error_detection',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
    'image_choice',
  ] as const)('accepts a valid rich closed %s question', (questionKind) => {
    const result = validateRichClosedQuestion(
      richClosedQuestionFixture(questionKind),
      { knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'] },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects a kind outside the rich closed allowlist', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      questionKind: 'fill_blank_dropdown',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_KIND_UNSUPPORTED' }),
    );
  });

  it('accepts a valid V1-C institution matrix exercise fixture', () => {
    const result = validateRichClosedExercise(richClosedV1CExerciseFixture(), {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a valid V1-C diagram labeling exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1CFullExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a valid V1-C calculation exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1CCalculationExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a valid V1-D image choice exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1DImageChoiceExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects free answer shaped payloads', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      answerText: 'Réponse libre interdite',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_FREE_ANSWER_FORBIDDEN' }),
    );
  });

  it('rejects cognitive skills outside the rich closed allowlist', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      cognitiveSkill: 'creative_writing',
    } as unknown as RichClosedQuestion;

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
      }),
    );
  });

  it('accepts a cognitive skill from the rich closed allowlist', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      cognitiveSkill: 'comparison',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(true);
  });

  it('requires single_choice to have exactly one valid correct choice', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      correctChoiceId: 'missing-choice',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_CORRECTION_INVALID' }),
    );
  });

  it('requires multiple_choice to have at least two valid correct answers', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      correctChoiceIds: ['choice-a'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_MULTIPLE_TOO_FEW_CORRECT' }),
    );
  });

  it('rejects decimal multiple_choice selection bounds', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      minSelections: 1.5,
      maxSelections: 2.5,
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_SELECTION_BOUNDS_INVALID',
      }),
    );
  });

  it('rejects multiple_choice bounds that exclude the correct answer count', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      minSelections: 1,
      maxSelections: 1,
      correctChoiceIds: ['choice-a', 'choice-b'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_SELECTION_BOUNDS_INVALID',
      }),
    );
  });

  it('accepts multiple_choice bounds that include the correct answer count', () => {
    const question = {
      ...richClosedQuestionFixture('multiple_choice'),
      minSelections: 1,
      maxSelections: 3,
      correctChoiceIds: ['choice-a', 'choice-b'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(true);
  });

  it('rejects matching questions with fewer than three pairs', () => {
    const question = {
      ...richClosedQuestionFixture('matching'),
      leftItems: [
        { id: 'left-1', label: 'Motion de censure' },
        { id: 'left-2', label: 'Dissolution' },
      ],
      rightItems: [
        { id: 'right-1', label: 'Responsabilité politique' },
        { id: 'right-2', label: 'Fin anticipée' },
      ],
      correctPairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
      ],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_MATCHING_TOO_SMALL' }),
    );
  });

  it('rejects matching questions with duplicate pair sides', () => {
    const question = {
      ...richClosedQuestionFixture('matching'),
      correctPairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-1', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_MATCHING_DUPLICATE_PAIR' }),
    );
  });

  it('requires ordering questions to have at least three items and a complete order', () => {
    const question = {
      ...richClosedQuestionFixture('ordering'),
      correctOrder: ['item-1', 'item-2'],
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_ORDERING_INCOMPLETE' }),
    );
  });

  it('requires timeline questions to have at least three unique events', () => {
    const tooSmall = {
      ...richClosedQuestionFixture('timeline'),
      events: [
        { id: 'event-1', label: 'Dépôt de la motion' },
        { id: 'event-2', label: 'Débat politique' },
      ],
      correctOrder: ['event-1', 'event-2'],
    };
    const duplicateIds = {
      ...richClosedQuestionFixture('timeline'),
      events: [
        { id: 'event-1', label: 'Dépôt de la motion' },
        { id: 'event-1', label: 'Débat politique' },
        { id: 'event-3', label: 'Vote de la chambre' },
      ],
    };

    expect(validateRichClosedQuestion(tooSmall).issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_TIMELINE_TOO_SMALL' }),
    );
    expect(validateRichClosedQuestion(duplicateIds).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TIMELINE_EVENTS_INVALID',
      }),
    );
  });

  it('requires timeline correctOrder to contain each event exactly once', () => {
    const incomplete = {
      ...richClosedQuestionFixture('timeline'),
      correctOrder: ['event-1', 'event-2'],
    };
    const unknownId = {
      ...richClosedQuestionFixture('timeline'),
      correctOrder: ['event-1', 'event-2', 'unknown-event'],
    };

    expect(validateRichClosedQuestion(incomplete).issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_TIMELINE_INCOMPLETE' }),
    );
    expect(validateRichClosedQuestion(unknownId).issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_TIMELINE_INCOMPLETE' }),
    );
  });

  it('requires date_slider to define a valid integer range and correction', () => {
    const invalidRange = {
      ...richClosedQuestionFixture('date_slider'),
      minYear: 1970,
      maxYear: 1970,
    };
    const invalidStep = {
      ...richClosedQuestionFixture('date_slider'),
      step: 0,
    };
    const invalidCorrection = {
      ...richClosedQuestionFixture('date_slider'),
      correctYear: 1971,
    };
    const invalidTolerance = {
      ...richClosedQuestionFixture('date_slider'),
      toleranceYears: -1,
    };

    expect(validateRichClosedQuestion(invalidRange).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_RANGE_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(invalidStep).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_STEP_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(invalidCorrection).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(invalidTolerance).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_DATE_SLIDER_TOLERANCE_INVALID',
      }),
    );
  });

  it('requires true_false_grid rows to be bounded and unique', () => {
    const tooSmall = {
      ...richClosedQuestionFixture('true_false_grid'),
      rows: [
        { id: 'row-1', statement: 'Le gouvernement est responsable.' },
        { id: 'row-2', statement: 'La dissolution est impossible.' },
      ],
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
      ],
    };
    const tooLarge = {
      ...richClosedQuestionFixture('true_false_grid'),
      rows: Array.from({ length: 9 }, (_, index) => ({
        id: `row-${index + 1}`,
        statement: `Affirmation ${index + 1}`,
      })),
      correctValues: Array.from({ length: 9 }, (_, index) => ({
        rowId: `row-${index + 1}`,
        value: index % 2 === 0,
      })),
    };
    const duplicateRows = {
      ...richClosedQuestionFixture('true_false_grid'),
      rows: [
        { id: 'row-1', statement: 'Affirmation A' },
        { id: 'row-1', statement: 'Affirmation B' },
        { id: 'row-3', statement: 'Affirmation C' },
      ],
    };

    expect(validateRichClosedQuestion(tooSmall).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_GRID_SIZE_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(tooLarge).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_GRID_SIZE_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(duplicateRows).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_ROWS_INVALID',
      }),
    );
  });

  it('requires true_false_grid correction to cover rows with strict booleans', () => {
    const incomplete = {
      ...richClosedQuestionFixture('true_false_grid'),
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
      ],
    };
    const unknownRow = {
      ...richClosedQuestionFixture('true_false_grid'),
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'unknown-row', value: true },
      ],
    };
    const nonBoolean = {
      ...richClosedQuestionFixture('true_false_grid'),
      correctValues: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: 'true' },
      ],
    };

    expect(validateRichClosedQuestion(incomplete).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(unknownRow).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
      }),
    );
    expect(validateRichClosedQuestion(nonBoolean).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
      }),
    );
  });

  it('requires cause_consequence items and corrections to be complete and univocal', () => {
    const tooFewCauses = {
      ...richClosedQuestionFixture('cause_consequence'),
      causes: [
        { id: 'cause-1', label: 'Motion adoptée' },
        { id: 'cause-2', label: 'Dissolution' },
      ],
    };
    const tooFewConsequences = {
      ...richClosedQuestionFixture('cause_consequence'),
      consequences: [
        { id: 'consequence-1', label: 'Démission' },
        { id: 'consequence-2', label: 'Élections' },
      ],
    };
    const duplicateIds = {
      ...richClosedQuestionFixture('cause_consequence'),
      causes: [
        { id: 'cause-1', label: 'Motion adoptée' },
        { id: 'cause-1', label: 'Question rejetée' },
        { id: 'cause-3', label: 'Dissolution' },
      ],
    };
    const incomplete = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
      ],
    };
    const unknownId = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'unknown-consequence' },
      ],
    };
    const duplicateCause = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-1', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    };
    const duplicateConsequence = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-1' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    };
    const malformedExtraPair = {
      ...richClosedQuestionFixture('cause_consequence'),
      correctPairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
        { causeId: 'cause-2' },
      ],
    };

    for (const question of [tooFewCauses, tooFewConsequences]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_CAUSE_CONSEQUENCE_TOO_SMALL',
        }),
      );
    }
    expect(validateRichClosedQuestion(duplicateIds).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_CAUSE_CONSEQUENCE_ITEMS_INVALID',
      }),
    );
    for (const question of [
      incomplete,
      unknownId,
      duplicateCause,
      duplicateConsequence,
      malformedExtraPair,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        }),
      );
    }
  });

  it('requires institution_matrix rows, columns, cells and corrections to be bounded and coherent', () => {
    const base = richClosedQuestionFixture('institution_matrix') as Extract<
      RichClosedQuestion,
      { questionKind: 'institution_matrix' }
    >;
    const tooFewRows = {
      ...base,
      rows: [{ id: 'row-1', label: 'Président' }],
    };
    const tooManyRows = {
      ...base,
      rows: Array.from({ length: 6 }, (_, index) => ({
        id: `row-${index + 1}`,
        label: `Institution ${index + 1}`,
      })),
    };
    const tooFewColumns = {
      ...base,
      columns: [{ id: 'column-1', label: 'Légitimité' }],
    };
    const tooManyColumns = {
      ...base,
      columns: Array.from({ length: 6 }, (_, index) => ({
        id: `column-${index + 1}`,
        label: `Propriété ${index + 1}`,
      })),
    };
    const unknownRow = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          rowId: 'unknown-row',
        },
        ...base.cells.slice(1),
      ],
    };
    const unknownColumn = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          columnId: 'unknown-column',
        },
        ...base.cells.slice(1),
      ],
    };
    const tooFewOptions = {
      ...base,
      cells: [
        { ...base.cells[0], options: [{ id: 'option-1', label: 'Oui' }] },
      ],
    };
    const tooManyOptions = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          options: Array.from({ length: 7 }, (_, index) => ({
            id: `option-${index + 1}`,
            label: `Option ${index + 1}`,
          })),
        },
      ],
    };
    const duplicateCells = {
      ...base,
      cells: [
        { ...base.cells[0] },
        { ...base.cells[0] },
        ...base.cells.slice(2),
      ],
    };
    const duplicateCellCoordinates = {
      ...base,
      cells: [
        { ...base.cells[0] },
        {
          ...base.cells[1],
          rowId: base.cells[0].rowId,
          columnId: base.cells[0].columnId,
        },
        ...base.cells.slice(2),
      ],
    };
    const duplicateOptions = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          options: [
            { id: 'option-a', label: 'Option A' },
            { id: 'option-a', label: 'Option B' },
          ],
        },
        ...base.cells.slice(1),
      ],
    };
    const incompleteCorrection = {
      ...base,
      correctValues: base.correctValues.slice(0, -1),
    };
    const unknownCellCorrection = {
      ...base,
      correctValues: [
        ...base.correctValues.slice(0, -1),
        { cellId: 'unknown-cell', optionId: 'option-legitimacy-election' },
      ],
    };
    const unknownOptionCorrection = {
      ...base,
      correctValues: [
        { cellId: base.cells[0].id, optionId: 'unknown-option' },
        ...base.correctValues.slice(1),
      ],
    };

    for (const question of [tooFewRows, tooManyRows]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID',
        }),
      );
    }
    for (const question of [tooFewColumns, tooManyColumns]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        }),
      );
    }
    for (const question of [
      unknownRow,
      unknownColumn,
      tooFewOptions,
      tooManyOptions,
      duplicateCells,
      duplicateCellCoordinates,
      duplicateOptions,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        }),
      );
    }
    for (const question of [
      incompleteCorrection,
      unknownCellCorrection,
      unknownOptionCorrection,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        }),
      );
    }
  });

  it('requires diagram_labeling diagram, slots and corrections to be bounded and coherent', () => {
    const base = richClosedQuestionFixture('diagram_labeling') as Extract<
      RichClosedQuestion,
      { questionKind: 'diagram_labeling' }
    >;
    const tooFewNodes = {
      ...base,
      diagram: { ...base.diagram, nodes: base.diagram.nodes.slice(0, 1) },
    };
    const tooManyNodes = {
      ...base,
      diagram: {
        ...base.diagram,
        nodes: Array.from({ length: 9 }, (_, index) => ({
          id: `node-${index + 1}`,
          label: `Noeud ${index + 1}`,
        })),
      },
    };
    const tooManyEdges = {
      ...base,
      diagram: {
        ...base.diagram,
        edges: Array.from({ length: 13 }, (_, index) => ({
          id: `edge-${index + 1}`,
          fromNodeId: 'node-president',
          toNodeId: 'node-government',
        })),
      },
    };
    const tooManyGroups = {
      ...base,
      diagram: {
        ...base.diagram,
        groups: Array.from({ length: 5 }, (_, index) => ({
          id: `group-${index + 1}`,
          label: `Groupe ${index + 1}`,
        })),
      },
    };
    const unknownFromNode = {
      ...base,
      diagram: {
        ...base.diagram,
        edges: [
          { ...base.diagram.edges[0], fromNodeId: 'unknown-node' },
          ...base.diagram.edges.slice(1),
        ],
      },
    };
    const unknownToNode = {
      ...base,
      diagram: {
        ...base.diagram,
        edges: [
          { ...base.diagram.edges[0], toNodeId: 'unknown-node' },
          ...base.diagram.edges.slice(1),
        ],
      },
    };
    const unknownGroup = {
      ...base,
      diagram: {
        ...base.diagram,
        nodes: [
          { ...base.diagram.nodes[0], groupId: 'unknown-group' },
          ...base.diagram.nodes.slice(1),
        ],
      },
    };
    const tooFewSlots = {
      ...base,
      slots: base.slots.slice(0, 1),
    };
    const tooManySlots = {
      ...base,
      slots: Array.from({ length: 9 }, (_, index) => ({
        ...base.slots[0],
        id: `slot-${index + 1}`,
      })),
    };
    const invalidAnchorType = {
      ...base,
      slots: [{ ...base.slots[0], anchorType: 'area' }, ...base.slots.slice(1)],
    };
    const unknownAnchor = {
      ...base,
      slots: [
        { ...base.slots[0], anchorId: 'unknown-anchor' },
        ...base.slots.slice(1),
      ],
    };
    const tooFewOptions = {
      ...base,
      slots: [
        { ...base.slots[0], options: [{ id: 'option-1', label: 'Oui' }] },
        ...base.slots.slice(1),
      ],
    };
    const tooManyOptions = {
      ...base,
      slots: [
        {
          ...base.slots[0],
          options: Array.from({ length: 7 }, (_, index) => ({
            id: `option-${index + 1}`,
            label: `Option ${index + 1}`,
          })),
        },
        ...base.slots.slice(1),
      ],
    };
    const duplicateSlots = {
      ...base,
      slots: [{ ...base.slots[0] }, { ...base.slots[0] }],
    };
    const duplicateOptions = {
      ...base,
      slots: [
        {
          ...base.slots[0],
          options: [
            { id: 'option-a', label: 'Option A' },
            { id: 'option-a', label: 'Option B' },
          ],
        },
        ...base.slots.slice(1),
      ],
    };
    const incompleteCorrection = {
      ...base,
      correctValues: base.correctValues.slice(0, -1),
    };
    const unknownSlotCorrection = {
      ...base,
      correctValues: [
        ...base.correctValues.slice(0, -1),
        { slotId: 'unknown-slot', optionId: 'option-government' },
      ],
    };
    const unknownOptionCorrection = {
      ...base,
      correctValues: [
        { slotId: base.slots[0].id, optionId: 'unknown-option' },
        ...base.correctValues.slice(1),
      ],
    };

    for (const question of [
      tooFewNodes,
      tooManyNodes,
      tooManyEdges,
      tooManyGroups,
      unknownFromNode,
      unknownToNode,
      unknownGroup,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_DIAGRAM_LABELING_DIAGRAM_INVALID',
        }),
      );
    }
    for (const question of [
      tooFewSlots,
      tooManySlots,
      invalidAnchorType,
      unknownAnchor,
      tooFewOptions,
      tooManyOptions,
      duplicateSlots,
      duplicateOptions,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        }),
      );
    }
    for (const question of [
      incompleteCorrection,
      unknownSlotCorrection,
      unknownOptionCorrection,
    ]) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        }),
      );
    }
  });

  it.each(['html', 'svg', 'mermaid', 'widget', 'renderPayload'] as const)(
    'rejects arbitrary render field %s',
    (field) => {
      const question = {
        ...richClosedQuestionFixture('diagram_labeling'),
        [field]: '<unsafe>',
      };

      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN',
        }),
      );
    },
  );

  it('requires calculation_mcq absolute majority data and correction to match the deterministic result', () => {
    const base = richClosedQuestionFixture('calculation_mcq') as Extract<
      RichClosedQuestion,
      { questionKind: 'calculation_mcq' }
    >;

    expect(validateRichClosedQuestion(base).accepted).toBe(true);

    const cases = [
      {
        question: {
          ...base,
          calculation: { mode: 'absolute_majority_threshold', validVotes: 0 },
        },
        code: 'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { mode: 'absolute_majority_threshold', validVotes: 1.5 },
        },
        code: 'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            mode: 'absolute_majority_threshold',
            validVotes: 1_000_001,
          },
        },
        code: 'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
      },
      {
        question: { ...base, correctChoiceId: 'choice-288' },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
      {
        question: {
          ...base,
          choices: base.choices.filter((choice) => choice.value !== 289),
        },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
      {
        question: {
          ...base,
          choices: [
            ...base.choices,
            { id: 'choice-289-bis', label: '289 aussi', value: 289 },
          ],
        },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
      {
        question: {
          ...base,
          choices: [
            { id: 'choice-a', label: 'A', value: 288 },
            { id: 'choice-b', label: 'B', value: 288 },
          ],
        },
        code: 'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
      },
    ];

    for (const { question, code } of cases) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it('requires calculation_mcq largest remainder data to be bounded and unambiguous', () => {
    const base = richClosedCalculationMcqLargestRemainderFixture();
    const baseCalculation = base.calculation;
    if (baseCalculation.mode !== 'largest_remainder_target_party_seats') {
      throw new Error('Expected largest remainder calculation fixture');
    }
    const cases = [
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, totalSeats: 0 },
        },
        code: 'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, totalSeats: 1.5 },
        },
        code: 'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, totalSeats: 201 },
        },
        code: 'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: baseCalculation.parties.slice(0, 1),
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: Array.from({ length: 9 }, (_, index) => ({
              id: `party-${index}`,
              label: `Liste ${index}`,
              votes: index + 1,
            })),
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: [
              { id: 'party-a', label: 'Liste A', votes: 4300 },
              { id: 'party-a', label: 'Liste B', votes: 3100 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: { ...baseCalculation, targetPartyId: 'unknown-party' },
        },
        code: 'RICH_CLOSED_CALCULATION_TARGET_PARTY_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: [
              { id: 'party-a', label: 'Liste A', votes: -1 },
              { id: 'party-b', label: 'Liste B', votes: 1 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            ...baseCalculation,
            parties: [
              { id: 'party-a', label: 'Liste A', votes: 0 },
              { id: 'party-b', label: 'Liste B', votes: 0 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_TOTAL_VOTES_INVALID',
      },
      {
        question: {
          ...base,
          calculation: {
            mode: 'largest_remainder_target_party_seats',
            totalSeats: 2,
            targetPartyId: 'party-a',
            parties: [
              { id: 'party-a', label: 'Liste A', votes: 100 },
              { id: 'party-b', label: 'Liste B', votes: 100 },
              { id: 'party-c', label: 'Liste C', votes: 100 },
            ],
          },
        },
        code: 'RICH_CLOSED_CALCULATION_INVALID',
      },
      {
        question: { ...base, correctChoiceId: 'choice-3' },
        code: 'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
      },
    ];

    expect(validateRichClosedQuestion(base).accepted).toBe(true);
    for (const { question, code } of cases) {
      expect(validateRichClosedQuestion(question).issues).toContainEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it.each([
    'formula',
    'expression',
    'rawFormula',
    'calculationCode',
    'script',
    'code',
    'renderPayload',
  ] as const)('rejects calculation free-form field %s', (field) => {
    const question = {
      ...richClosedQuestionFixture('calculation_mcq'),
      [field]: 'unsafe',
    };

    expect(validateRichClosedQuestion(question).issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN',
      }),
    );
  });

  it.each([
    ['choices', []],
    [
      'choices',
      [
        {
          id: 'choice-image-a',
          label: 'Image A',
          imageAssetId: 'image-choice-historical-figure-001-v1',
          altText:
            'Portrait historique en noir et blanc d’un homme en uniforme.',
        },
      ],
    ],
    [
      'choices',
      [
        {
          id: 'choice-a',
          label: 'Image A',
          imageAssetId: 'image-choice-historical-figure-001-v1',
          altText:
            'Portrait historique en noir et blanc d’un homme en uniforme.',
        },
        {
          id: 'choice-a',
          label: 'Image B',
          imageAssetId: 'image-choice-historical-figure-002-v1',
          altText: 'Portrait peint d’un homme en tenue impériale.',
        },
      ],
    ],
  ] as const)('rejects invalid image_choice %s contract', (field, value) => {
    const question = {
      ...richClosedQuestionFixture('image_choice'),
      [field]: value,
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_IMAGE_CHOICE_INVALID' }),
    );
  });

  it.each([
    {
      name: 'unknown asset id',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          { ...question.choices[0], imageAssetId: 'unknown-asset' },
          question.choices[1],
        ],
      }),
    },
    {
      name: 'duplicate asset ids',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          question.choices[0],
          {
            ...question.choices[1],
            imageAssetId: question.choices[0].imageAssetId,
            altText: question.choices[0].altText,
          },
        ],
      }),
    },
    {
      name: 'empty alt text',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [{ ...question.choices[0], altText: '' }, question.choices[1]],
      }),
    },
    {
      name: 'alt text different from catalog',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          { ...question.choices[0], altText: 'Portrait de Charles de Gaulle' },
          question.choices[1],
        ],
      }),
    },
    {
      name: 'public label revealing semantic label',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          { ...question.choices[0], label: 'Charles de Gaulle' },
          question.choices[1],
          question.choices[2],
        ],
      }),
    },
    {
      name: 'public caption revealing semantic label',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        choices: [
          question.choices[0],
          question.choices[1],
          { ...question.choices[2], caption: 'Simone Veil' },
        ],
      }),
    },
    {
      name: 'unknown correctChoiceId',
      mutate: (
        question: Extract<RichClosedQuestion, { questionKind: 'image_choice' }>,
      ) => ({
        ...question,
        correctChoiceId: 'unknown-choice',
      }),
    },
  ])('rejects image_choice with $name', ({ mutate }) => {
    const question = mutate(
      richClosedQuestionFixture('image_choice') as Extract<
        RichClosedQuestion,
        { questionKind: 'image_choice' }
      >,
    );

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_IMAGE_CHOICE_INVALID' }),
    );
  });

  it.each([
    'imageUrl',
    'url',
    'remoteUrl',
    'src',
    'href',
    'storagePath',
    'bucketPath',
    'cdnUrl',
    'base64',
    'dataUri',
    'blob',
    'rawImage',
    'renderPayload',
    'semanticLabel',
    'answerHint',
  ] as const)('rejects image_choice carrying forbidden field %s', (field) => {
    const question = {
      ...richClosedQuestionFixture('image_choice'),
      [field]: field === 'renderPayload' ? { widget: 'free' } : 'forbidden',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN' }),
    );
  });

  it('requires case_qualification to have a short case and a unique correction', () => {
    const question = {
      ...richClosedQuestionFixture('case_qualification'),
      caseText: 'x'.repeat(901),
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_CASE_TEXT_INVALID' }),
    );
  });

  it('requires error_detection to have one dominant valid error', () => {
    const question = {
      ...richClosedQuestionFixture('error_detection'),
      correctErrorId: 'missing-error',
    };

    const result = validateRichClosedQuestion(question);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_CORRECTION_INVALID' }),
    );
  });

  it('rejects unknown source chunks when a known source set is provided', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      sourceChunkIds: ['chunk-unknown'],
    };

    const result = validateRichClosedQuestion(question, {
      knownSourceChunkIds: ['chunk-1'],
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_SOURCE_UNKNOWN' }),
    );
  });

  it('validates a complete V1-A exercise', () => {
    const result = validateRichClosedExercise(richClosedExerciseFixture(), {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('validates a complete V1-B exercise fixture', () => {
    const result = validateRichClosedExercise(richClosedV1BExerciseFixture(), {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('validates a complete V1-B full exercise fixture', () => {
    const result = validateRichClosedExercise(
      richClosedV1BFullExerciseFixture(),
      {
        knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

~~~~

### src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.ts

~~~~ts
import {
  RICH_CLOSED_CALCULATION_INVALID,
  evaluateRichClosedCalculationMcq,
} from './rich-closed-question-calculation';
import {
  RICH_CLOSED_EXERCISE_VERSION,
  RICH_CLOSED_COGNITIVE_SKILLS,
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedCalculationChoice,
  type RichClosedCalculationData,
  type RichClosedCalculationParty,
  type RichClosedChoice,
  type RichClosedCauseConsequencePair,
  type RichClosedDiagram,
  type RichClosedDiagramAnchorType,
  type RichClosedDiagramEdge,
  type RichClosedDiagramGroup,
  type RichClosedDiagramLabelingSlot,
  type RichClosedDiagramLabelingValue,
  type RichClosedDiagramLayout,
  type RichClosedDiagramNode,
  type RichClosedExerciseValidationIssue,
  type RichClosedExerciseValidationResult,
  type RichClosedImageChoiceOption,
  type RichClosedInstitutionMatrixCell,
  type RichClosedInstitutionMatrixValue,
  type RichClosedPair,
  type RichClosedQuestionKind,
  type RichClosedTrueFalseValue,
} from './rich-closed-question.types';
import { getRichClosedImageAsset } from './rich-closed-image-assets';

const MAX_PROMPT_LENGTH = 700;
const MAX_CASE_TEXT_LENGTH = 900;
const MAX_STATEMENT_LENGTH = 900;
const MAX_EXPLANATION_LENGTH = 1200;
const MAX_INSTRUCTION_LENGTH = 400;
const MAX_TIMELINE_EVENT_DESCRIPTION_LENGTH = 500;
const MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH = 500;
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;
const MIN_STRUCTURED_ITEMS = 3;
const MAX_TRUE_FALSE_ROWS = 8;
const MIN_MATRIX_AXIS_ITEMS = 2;
const MAX_MATRIX_AXIS_ITEMS = 5;
const MIN_MATRIX_CELLS = 3;
const MAX_MATRIX_CELL_OPTIONS = 6;
const MIN_DIAGRAM_NODES = 2;
const MAX_DIAGRAM_NODES = 8;
const MAX_DIAGRAM_EDGES = 12;
const MAX_DIAGRAM_GROUPS = 4;
const MIN_DIAGRAM_SLOTS = 2;
const MAX_DIAGRAM_SLOTS = 8;
const MAX_DIAGRAM_SLOT_OPTIONS = 6;
const MAX_CALCULATION_VOTES = 1_000_000;
const MAX_CALCULATION_TOTAL_SEATS = 200;
const MIN_CALCULATION_PARTIES = 2;
const MAX_CALCULATION_PARTIES = 8;
const DIAGRAM_LAYOUTS = [
  'vertical_flow',
  'two_column',
  'cycle',
  'hierarchy',
  'plain',
] as const;

const FORBIDDEN_RICH_CLOSED_RENDER_KEYS = new Set([
  'html',
  'svg',
  'rawSvg',
  'mermaid',
  'markdown',
  'widget',
  'component',
  'renderPayload',
  'expectedValue',
  'workedSteps',
  'style',
  'css',
  'script',
  'formula',
  'expression',
  'rawFormula',
  'calculationCode',
  'javascript',
  'python',
  'imageUrl',
  'assetUrl',
  'url',
  'remoteUrl',
  'src',
  'href',
  'storagePath',
  'bucketPath',
  'cdnUrl',
  'base64',
  'dataUri',
  'blob',
  'rawImage',
  'assetPath',
  'semanticLabel',
  'answerHint',
  'canvas',
  'code',
  'markup',
]);

export interface RichClosedQuestionValidationOptions {
  knownSourceChunkIds?: readonly string[] | ReadonlySet<string>;
}

export function validateRichClosedExercise(
  exercise: unknown,
  options: RichClosedQuestionValidationOptions = {},
): RichClosedExerciseValidationResult {
  const issues: RichClosedExerciseValidationIssue[] = [];

  if (!isRecord(exercise)) {
    return rejected([
      issue('RICH_CLOSED_EXERCISE_INVALID', 'Exercise must be an object'),
    ]);
  }

  if (exercise.version !== RICH_CLOSED_EXERCISE_VERSION) {
    issues.push(
      issue(
        'RICH_CLOSED_VERSION_INVALID',
        'Exercise version must be rich-closed-question-v1',
        'version',
      ),
    );
  }

  if (!plainString(exercise.id)) {
    issues.push(
      issue('RICH_CLOSED_ID_INVALID', 'Exercise id is required', 'id'),
    );
  }

  if (!boundedString(exercise.title, 1, 160)) {
    issues.push(
      issue('RICH_CLOSED_TITLE_INVALID', 'Exercise title is invalid', 'title'),
    );
  }

  if (!Array.isArray(exercise.questions) || exercise.questions.length === 0) {
    issues.push(
      issue(
        'RICH_CLOSED_QUESTIONS_INVALID',
        'Exercise must contain at least one question',
        'questions',
      ),
    );
  } else {
    exercise.questions.forEach((question, index) => {
      const result = validateRichClosedQuestion(question, options);
      issues.push(
        ...result.issues.map((questionIssue) => ({
          ...questionIssue,
          path: `questions.${index}${
            questionIssue.path === undefined ? '' : `.${questionIssue.path}`
          }`,
        })),
      );
    });
  }

  return {
    accepted: issues.length === 0,
    issues,
  };
}

export function validateRichClosedQuestion(
  question: unknown,
  options: RichClosedQuestionValidationOptions = {},
): RichClosedExerciseValidationResult {
  const issues: RichClosedExerciseValidationIssue[] = [];

  if (!isRecord(question)) {
    return rejected([
      issue('RICH_CLOSED_QUESTION_INVALID', 'Question must be an object'),
    ]);
  }

  if (containsFreeAnswerField(question)) {
    issues.push(
      issue(
        'RICH_CLOSED_FREE_ANSWER_FORBIDDEN',
        'Rich closed questions cannot contain free-answer fields',
      ),
    );
  }

  if (containsForbiddenRenderField(question)) {
    issues.push(
      issue(
        'RICH_CLOSED_RENDER_PAYLOAD_FORBIDDEN',
        'Rich closed questions cannot contain arbitrary render payload fields',
      ),
    );
  }

  const questionKind = question.questionKind;
  if (!isRichClosedQuestionKind(questionKind)) {
    issues.push(
      issue(
        'RICH_CLOSED_KIND_UNSUPPORTED',
        'Question kind is not part of the rich closed allowlist',
        'questionKind',
      ),
    );
    return {
      accepted: false,
      issues,
    };
  }

  validateCommonQuestionFields(question, issues, options);

  switch (questionKind) {
    case 'single_choice':
      validateSingleChoiceQuestion(question, issues);
      break;
    case 'multiple_choice':
      validateMultipleChoiceQuestion(question, issues);
      break;
    case 'matching':
      validateMatchingQuestion(question, issues);
      break;
    case 'ordering':
      validateOrderingQuestion(question, issues);
      break;
    case 'timeline':
      validateTimelineQuestion(question, issues);
      break;
    case 'date_slider':
      validateDateSliderQuestion(question, issues);
      break;
    case 'true_false_grid':
      validateTrueFalseGridQuestion(question, issues);
      break;
    case 'cause_consequence':
      validateCauseConsequenceQuestion(question, issues);
      break;
    case 'institution_matrix':
      validateInstitutionMatrixQuestion(question, issues);
      break;
    case 'diagram_labeling':
      validateDiagramLabelingQuestion(question, issues);
      break;
    case 'calculation_mcq':
      validateCalculationMcqQuestion(question, issues);
      break;
    case 'image_choice':
      validateImageChoiceQuestion(question, issues);
      break;
    case 'case_qualification':
      validateCaseQualificationQuestion(question, issues);
      break;
    case 'error_detection':
      validateErrorDetectionQuestion(question, issues);
      break;
  }

  return {
    accepted: issues.length === 0,
    issues,
  };
}

function validateCommonQuestionFields(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
  options: RichClosedQuestionValidationOptions,
) {
  if (!plainString(question.id)) {
    issues.push(
      issue('RICH_CLOSED_ID_INVALID', 'Question id is required', 'id'),
    );
  }

  if (!boundedString(question.prompt, 1, MAX_PROMPT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_PROMPT_INVALID',
        'Question prompt is invalid',
        'prompt',
      ),
    );
  }

  if (
    question.difficulty !== 'LOW' &&
    question.difficulty !== 'MEDIUM' &&
    question.difficulty !== 'HIGH'
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIFFICULTY_INVALID',
        'Question difficulty is invalid',
        'difficulty',
      ),
    );
  }

  if (!isRichClosedCognitiveSkill(question.cognitiveSkill)) {
    issues.push(
      issue(
        'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
        'Question cognitive skill is not part of the rich closed allowlist',
        'cognitiveSkill',
      ),
    );
  }

  validateSources(question.sourceChunkIds, issues, options);
}

function validateSingleChoiceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readChoices(question.choices, issues, 'choices');

  if (!choiceIds(choices).has(readString(question.correctChoiceId))) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Single choice correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateMultipleChoiceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readChoices(question.choices, issues, 'choices');
  const knownChoiceIds = choiceIds(choices);
  const correctChoiceIds = readStringArray(question.correctChoiceIds);
  const minSelections = question.minSelections;
  const maxSelections = question.maxSelections;

  if (correctChoiceIds.length < 2) {
    issues.push(
      issue(
        'RICH_CLOSED_MULTIPLE_TOO_FEW_CORRECT',
        'Multiple choice requires at least two correct answers',
        'correctChoiceIds',
      ),
    );
  }

  if (
    hasDuplicates(correctChoiceIds) ||
    correctChoiceIds.some((choiceId) => !knownChoiceIds.has(choiceId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Multiple choice correction must reference existing choices once',
        'correctChoiceIds',
      ),
    );
  }

  if (
    typeof minSelections !== 'number' ||
    typeof maxSelections !== 'number' ||
    !Number.isInteger(minSelections) ||
    !Number.isInteger(maxSelections) ||
    minSelections < 1 ||
    maxSelections < minSelections ||
    maxSelections > choices.length ||
    correctChoiceIds.length < minSelections ||
    correctChoiceIds.length > maxSelections
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_SELECTION_BOUNDS_INVALID',
        'Multiple choice selection bounds are invalid',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateMatchingQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const leftItems = readLabelItems(question.leftItems, issues, 'leftItems');
  const rightItems = readLabelItems(question.rightItems, issues, 'rightItems');
  const pairs = readPairs(question.correctPairs);

  if (
    leftItems.length < MIN_STRUCTURED_ITEMS ||
    rightItems.length < MIN_STRUCTURED_ITEMS ||
    pairs.length < MIN_STRUCTURED_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_MATCHING_TOO_SMALL',
        'Matching requires at least three pairs',
      ),
    );
  }

  const leftIds = idSet(leftItems);
  const rightIds = idSet(rightItems);
  const pairedLeftIds = pairs.map((pair) => pair.leftId);
  const pairedRightIds = pairs.map((pair) => pair.rightId);

  if (hasDuplicates(pairedLeftIds) || hasDuplicates(pairedRightIds)) {
    issues.push(
      issue(
        'RICH_CLOSED_MATCHING_DUPLICATE_PAIR',
        'Matching pairs cannot reuse a side',
        'correctPairs',
      ),
    );
  }

  if (
    pairs.some(
      (pair) => !leftIds.has(pair.leftId) || !rightIds.has(pair.rightId),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Matching correction must reference existing items',
        'correctPairs',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateOrderingQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const items = readLabelItems(question.items, issues, 'items');
  const itemIds = [...idSet(items)];
  const correctOrder = readStringArray(question.correctOrder);

  if (items.length < MIN_STRUCTURED_ITEMS) {
    issues.push(
      issue(
        'RICH_CLOSED_ORDERING_TOO_SMALL',
        'Ordering requires at least three items',
        'items',
      ),
    );
  }

  if (
    correctOrder.length !== itemIds.length ||
    hasDuplicates(correctOrder) ||
    correctOrder.some((itemId) => !itemIds.includes(itemId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_ORDERING_INCOMPLETE',
        'Ordering correction must contain each item exactly once',
        'correctOrder',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateTimelineQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const events = readTimelineEvents(question.events, issues, 'events');
  const eventIds = [...idSet(events)];
  const correctOrder = readStringArray(question.correctOrder);

  if (events.length < MIN_STRUCTURED_ITEMS) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_TOO_SMALL',
        'Timeline requires at least three events',
        'events',
      ),
    );
  }

  if (
    correctOrder.length !== eventIds.length ||
    hasDuplicates(correctOrder) ||
    correctOrder.some((eventId) => !eventIds.includes(eventId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_INCOMPLETE',
        'Timeline correction must contain each event exactly once',
        'correctOrder',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateDateSliderQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const minYear = readInteger(question.minYear);
  const maxYear = readInteger(question.maxYear);
  const step = readInteger(question.step);
  const correctYear = readInteger(question.correctYear);
  const toleranceYears = readInteger(question.toleranceYears);

  if (minYear === null || maxYear === null || minYear >= maxYear) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_RANGE_INVALID',
        'Date slider must define an increasing integer year range',
      ),
    );
  }

  if (step === null || step < 1) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_STEP_INVALID',
        'Date slider step must be an integer greater than or equal to one',
        'step',
      ),
    );
  }

  if (
    correctYear === null ||
    minYear === null ||
    maxYear === null ||
    correctYear < minYear ||
    correctYear > maxYear
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
        'Date slider correction must be within the public year range',
        'correctYear',
      ),
    );
  }

  if (toleranceYears === null || toleranceYears < 0) {
    issues.push(
      issue(
        'RICH_CLOSED_DATE_SLIDER_TOLERANCE_INVALID',
        'Date slider tolerance must be a positive or zero integer',
        'toleranceYears',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateTrueFalseGridQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const rows = readTrueFalseRows(question.rows, issues, 'rows');
  const rowIds = [...idSet(rows)];
  const correctValues = readTrueFalseValues(
    question.correctValues,
    issues,
    'correctValues',
  );
  const correctedRowIds = correctValues.map((value) => value.rowId);

  if (rows.length < MIN_STRUCTURED_ITEMS || rows.length > MAX_TRUE_FALSE_ROWS) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_GRID_SIZE_INVALID',
        'True/false grid requires between three and eight rows',
        'rows',
      ),
    );
  }

  if (
    correctValues.length !== rowIds.length ||
    hasDuplicates(correctedRowIds) ||
    correctedRowIds.some((rowId) => !rowIds.includes(rowId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
        'True/false grid correction must contain one boolean value per row',
        'correctValues',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateCauseConsequenceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const causes = readCauseConsequenceItems(question.causes, issues, 'causes');
  const consequences = readCauseConsequenceItems(
    question.consequences,
    issues,
    'consequences',
  );
  const pairs = readCauseConsequencePairs(
    question.correctPairs,
    issues,
    'correctPairs',
  );
  const causeIds = [...idSet(causes)];
  const consequenceIds = [...idSet(consequences)];
  const pairedCauseIds = pairs.map((pair) => pair.causeId);
  const pairedConsequenceIds = pairs.map((pair) => pair.consequenceId);

  if (
    causes.length < MIN_STRUCTURED_ITEMS ||
    consequences.length < MIN_STRUCTURED_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_TOO_SMALL',
        'Cause/consequence requires at least three causes and consequences',
      ),
    );
  }

  if (
    pairs.length !== causeIds.length ||
    hasDuplicates(pairedCauseIds) ||
    hasDuplicates(pairedConsequenceIds) ||
    pairs.some(
      (pair) =>
        !causeIds.includes(pair.causeId) ||
        !consequenceIds.includes(pair.consequenceId),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        'Cause/consequence correction must pair every cause with a unique existing consequence',
        'correctPairs',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateInstitutionMatrixQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const rows = readInstitutionMatrixAxisItems(question.rows, issues, 'rows');
  const columns = readInstitutionMatrixAxisItems(
    question.columns,
    issues,
    'columns',
  );
  const rowIds = [...idSet(rows)];
  const columnIds = [...idSet(columns)];
  const cells = readInstitutionMatrixCells(question.cells, issues, 'cells');
  const correctValues = readInstitutionMatrixValues(
    question.correctValues,
    issues,
    'correctValues',
  );
  const cellIds = [...idSet(cells)];
  const correctedCellIds = correctValues.map((value) => value.cellId);

  if (
    rows.length < MIN_MATRIX_AXIS_ITEMS ||
    rows.length > MAX_MATRIX_AXIS_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID',
        'Institution matrix requires between two and five rows',
        'rows',
      ),
    );
  }

  if (
    columns.length < MIN_MATRIX_AXIS_ITEMS ||
    columns.length > MAX_MATRIX_AXIS_ITEMS
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        'Institution matrix requires between two and five columns',
        'columns',
      ),
    );
  }

  if (
    cells.length < MIN_MATRIX_CELLS ||
    cells.length > rows.length * columns.length ||
    hasDuplicates(cells.map((cell) => cell.id)) ||
    hasDuplicateInstitutionMatrixCoordinates(cells) ||
    cells.some(
      (cell) =>
        !rowIds.includes(cell.rowId) ||
        !columnIds.includes(cell.columnId) ||
        cell.options.length < MIN_CHOICES ||
        cell.options.length > MAX_MATRIX_CELL_OPTIONS ||
        hasDuplicates(cell.options.map((option) => option.id)),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        'Institution matrix cells must reference existing rows/columns and carry bounded unique options',
        'cells',
      ),
    );
  }

  if (
    correctValues.length !== cellIds.length ||
    hasDuplicates(correctedCellIds) ||
    correctValues.some((value) => {
      const cell = cells.find((candidate) => candidate.id === value.cellId);

      return (
        cell === undefined ||
        !cell.options.some((option) => option.id === value.optionId)
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        'Institution matrix correction must contain one existing option per cell',
        'correctValues',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function hasDuplicateInstitutionMatrixCoordinates(
  cells: readonly RichClosedInstitutionMatrixCell[],
): boolean {
  const coordinates = new Set<string>();

  for (const cell of cells) {
    const coordinate = `${cell.rowId}\u0000${cell.columnId}`;
    if (coordinates.has(coordinate)) {
      return true;
    }
    coordinates.add(coordinate);
  }

  return false;
}

function validateDiagramLabelingQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const diagram = readDiagram(question.diagram, issues, 'diagram');
  const slots = readDiagramLabelingSlots(question.slots, issues, 'slots');
  const correctValues = readDiagramLabelingValues(
    question.correctValues,
    issues,
    'correctValues',
  );

  const groups = diagram?.groups ?? [];
  const nodes = diagram?.nodes ?? [];
  const edges = diagram?.edges ?? [];
  const groupIds = [...idSet(groups)];
  const nodeIds = [...idSet(nodes)];
  const edgeIds = [...idSet(edges)];
  const slotIds = [...idSet(slots)];
  const correctedSlotIds = correctValues.map((value) => value.slotId);

  if (
    diagram === null ||
    nodes.length < MIN_DIAGRAM_NODES ||
    nodes.length > MAX_DIAGRAM_NODES ||
    hasDuplicates(nodes.map((node) => node.id)) ||
    groups.length > MAX_DIAGRAM_GROUPS ||
    hasDuplicates(groups.map((group) => group.id)) ||
    nodes.some(
      (node) =>
        node.groupId !== undefined &&
        node.groupId !== null &&
        !groupIds.includes(node.groupId),
    ) ||
    edges.length > MAX_DIAGRAM_EDGES ||
    hasDuplicates(edges.map((edge) => edge.id)) ||
    edges.some(
      (edge) =>
        !nodeIds.includes(edge.fromNodeId) || !nodeIds.includes(edge.toNodeId),
    )
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_DIAGRAM_INVALID',
        'Diagram labeling diagram must contain bounded semantic nodes, groups and edges',
        'diagram',
      ),
    );
  }

  if (
    slots.length < MIN_DIAGRAM_SLOTS ||
    slots.length > MAX_DIAGRAM_SLOTS ||
    hasDuplicates(slots.map((slot) => slot.id)) ||
    slots.some((slot) => {
      const knownAnchorIds = slot.anchorType === 'node' ? nodeIds : edgeIds;

      return (
        !knownAnchorIds.includes(slot.anchorId) ||
        slot.options.length < MIN_CHOICES ||
        slot.options.length > MAX_DIAGRAM_SLOT_OPTIONS ||
        hasDuplicates(slot.options.map((option) => option.id))
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        'Diagram labeling slots must target known nodes/edges and carry bounded unique options',
        'slots',
      ),
    );
  }

  if (
    correctValues.length !== slotIds.length ||
    hasDuplicates(correctedSlotIds) ||
    correctValues.some((value) => {
      const slot = slots.find((candidate) => candidate.id === value.slotId);

      return (
        slot === undefined ||
        !slot.options.some((option) => option.id === value.optionId)
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        'Diagram labeling correction must contain one existing option per slot',
        'correctValues',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateCalculationMcqQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (!boundedString(question.scenario, 1, MAX_CASE_TEXT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_SCENARIO_INVALID',
        'Calculation MCQ requires a bounded scenario',
        'scenario',
      ),
    );
  }

  const calculation = readCalculationData(
    question.calculation,
    issues,
    'calculation',
  );
  const choices = readCalculationChoices(question.choices, issues, 'choices');
  const correctChoiceId = readString(question.correctChoiceId);
  const correctChoice = choices.find((choice) => choice.id === correctChoiceId);

  if (!correctChoice) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
        'Calculation MCQ correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  if (hasDuplicates(choices.map((choice) => String(choice.value)))) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
        'Calculation MCQ choices must have unique integer values',
        'choices',
      ),
    );
  }

  if (calculation !== null) {
    try {
      const evaluation = evaluateRichClosedCalculationMcq(calculation);
      const expectedChoices = choices.filter(
        (choice) => choice.value === evaluation.expectedValue,
      );

      if (
        expectedChoices.length !== 1 ||
        correctChoice?.value !== evaluation.expectedValue
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_CORRECTION_INVALID',
            'Calculation MCQ correct choice must match the deterministic expected value',
            'correctChoiceId',
          ),
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === RICH_CLOSED_CALCULATION_INVALID
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_INVALID',
            'Calculation MCQ data cannot be evaluated deterministically',
            'calculation',
          ),
        );
      } else {
        throw error;
      }
    }
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function validateImageChoiceQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readImageChoices(question.choices, issues, 'choices');
  const choiceIds = choices.map((choice) => choice.id);
  const imageAssetIds = choices.map((choice) => choice.imageAssetId);
  const correctChoiceId = readString(question.correctChoiceId);

  if (
    choices.length < MIN_CHOICES ||
    choices.length > MAX_CHOICES ||
    hasDuplicates(choiceIds) ||
    hasDuplicates(imageAssetIds) ||
    choices.some((choice) => {
      const asset = getRichClosedImageAsset(choice.imageAssetId);

      return (
        asset === null ||
        choice.altText !== asset.publicAltText ||
        (choice.creditLabel !== undefined &&
          choice.creditLabel !== asset.creditLabel) ||
        (choice.license !== undefined && choice.license !== asset.license) ||
        imageChoicePublicTextRevealsSemanticLabel(choice.label, asset) ||
        imageChoicePublicTextRevealsSemanticLabel(choice.caption, asset)
      );
    })
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice must use bounded choices from the controlled image asset catalog',
        'choices',
      ),
    );
  }

  if (!choiceIds.includes(correctChoiceId)) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  validateOptionalInstruction(question.instruction, issues);
  validateExplanation(question.explanation, issues);
}

function imageChoicePublicTextRevealsSemanticLabel(
  value: string | null | undefined,
  asset: NonNullable<ReturnType<typeof getRichClosedImageAsset>>,
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  const normalizedValueTokens = new Set(
    normalizeImageChoicePublicText(value)
      .split(' ')
      .filter((token) => token.length > 0),
  );
  const semanticTokens = normalizeImageChoicePublicText(asset.semanticLabel)
    .split(' ')
    .filter((token) => token.length >= 4);

  if (semanticTokens.length === 0 || normalizedValueTokens.size === 0) {
    return false;
  }

  return semanticTokens.some((token) => normalizedValueTokens.has(token));
}

function normalizeImageChoicePublicText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function validateCaseQualificationQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const choices = readChoices(question.choices, issues, 'choices');

  if (!boundedString(question.caseText, 1, MAX_CASE_TEXT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_CASE_TEXT_INVALID',
        'Case qualification requires a short case text',
        'caseText',
      ),
    );
  }

  if (!choiceIds(choices).has(readString(question.correctChoiceId))) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Case qualification correction must target one existing choice',
        'correctChoiceId',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateErrorDetectionQuestion(
  question: Record<string, unknown>,
  issues: RichClosedExerciseValidationIssue[],
) {
  const errorOptions = readChoices(
    question.errorOptions,
    issues,
    'errorOptions',
  );

  if (!boundedString(question.statement, 1, MAX_STATEMENT_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_STATEMENT_INVALID',
        'Error detection requires a bounded statement',
        'statement',
      ),
    );
  }

  if (!choiceIds(errorOptions).has(readString(question.correctErrorId))) {
    issues.push(
      issue(
        'RICH_CLOSED_CORRECTION_INVALID',
        'Error detection correction must target one existing error option',
        'correctErrorId',
      ),
    );
  }

  validateExplanation(question.explanation, issues);
}

function validateSources(
  sourceChunkIds: unknown,
  issues: RichClosedExerciseValidationIssue[],
  options: RichClosedQuestionValidationOptions,
) {
  const sourceIds = readStringArray(sourceChunkIds);

  if (
    !Array.isArray(sourceChunkIds) ||
    sourceIds.length !== sourceChunkIds.length
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_SOURCES_INVALID',
        'Question sources must be an array of non-empty chunk ids',
        'sourceChunkIds',
      ),
    );
    return;
  }

  if (hasDuplicates(sourceIds)) {
    issues.push(
      issue(
        'RICH_CLOSED_SOURCES_DUPLICATE',
        'Question sources cannot contain duplicates',
        'sourceChunkIds',
      ),
    );
  }

  const knownSourceChunkIds = toStringSet(options.knownSourceChunkIds);
  if (
    knownSourceChunkIds !== null &&
    sourceIds.some((sourceChunkId) => !knownSourceChunkIds.has(sourceChunkId))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_SOURCE_UNKNOWN',
        'Question references a source chunk outside the known source set',
        'sourceChunkIds',
      ),
    );
  }
}

function readChoices(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedChoice[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_CHOICES ||
    value.length > MAX_CHOICES
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CHOICES_INVALID',
        'Question choices must contain between two and six items',
        path,
      ),
    );
    return [];
  }

  const choices = value.filter(isChoice);
  if (
    choices.length !== value.length ||
    hasDuplicates(choices.map((choice) => choice.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CHOICES_INVALID',
        'Question choices must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return choices;
}

function readLabelItems(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_ITEMS_INVALID',
        'Structured items must be an array',
        path,
      ),
    );
    return [];
  }

  const items = value.filter(isLabelItem);
  if (
    items.length !== value.length ||
    hasDuplicates(items.map((item) => item.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_ITEMS_INVALID',
        'Structured items must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return items;
}

function readTimelineEvents(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_EVENTS_INVALID',
        'Timeline events must be an array',
        path,
      ),
    );
    return [];
  }

  const events = value.filter(isTimelineEvent);
  if (
    events.length !== value.length ||
    hasDuplicates(events.map((event) => event.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TIMELINE_EVENTS_INVALID',
        'Timeline events must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return events;
}

function readTrueFalseRows(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_ROWS_INVALID',
        'True/false rows must be an array',
        path,
      ),
    );
    return [];
  }

  const rows = value.filter(isTrueFalseRow);
  if (
    rows.length !== value.length ||
    hasDuplicates(rows.map((row) => row.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_ROWS_INVALID',
        'True/false rows must have unique non-empty ids and statements',
        path,
      ),
    );
  }

  return rows;
}

function readTrueFalseValues(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedTrueFalseValue[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
        'True/false correction must be an array',
        path,
      ),
    );
    return [];
  }

  const values = value.filter(isTrueFalseValue);
  if (values.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_TRUE_FALSE_CORRECTION_INVALID',
        'True/false correction values must be strict booleans',
        path,
      ),
    );
  }

  return values;
}

function readCauseConsequenceItems(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_ITEMS_INVALID',
        'Cause/consequence items must be an array',
        path,
      ),
    );
    return [];
  }

  const items = value.filter(isDescribedLabelItem);
  if (
    items.length !== value.length ||
    hasDuplicates(items.map((item) => item.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_ITEMS_INVALID',
        'Cause/consequence items must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return items;
}

function readPairs(value: unknown): RichClosedPair[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (pair): pair is RichClosedPair =>
      isRecord(pair) && plainString(pair.leftId) && plainString(pair.rightId),
  );
}

function readCauseConsequencePairs(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCauseConsequencePair[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        'Cause/consequence correction must be an array',
        path,
      ),
    );
    return [];
  }

  const pairs = value.filter(
    (pair): pair is RichClosedCauseConsequencePair =>
      isRecord(pair) &&
      plainString(pair.causeId) &&
      plainString(pair.consequenceId),
  );
  if (pairs.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_CAUSE_CONSEQUENCE_CORRECTION_INVALID',
        'Cause/consequence correction pairs must have causeId and consequenceId',
        path,
      ),
    );
  }

  return pairs;
}

function readInstitutionMatrixAxisItems(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: 'rows' | 'columns',
) {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        path === 'rows'
          ? 'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID'
          : 'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        'Institution matrix axis items must be an array',
        path,
      ),
    );
    return [];
  }

  const items = value.filter(isDescribedLabelItem);
  if (
    items.length !== value.length ||
    hasDuplicates(items.map((item) => item.id))
  ) {
    issues.push(
      issue(
        path === 'rows'
          ? 'RICH_CLOSED_INSTITUTION_MATRIX_ROWS_INVALID'
          : 'RICH_CLOSED_INSTITUTION_MATRIX_COLUMNS_INVALID',
        'Institution matrix axis items must have unique non-empty ids and labels',
        path,
      ),
    );
  }

  return items;
}

function readInstitutionMatrixCells(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedInstitutionMatrixCell[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        'Institution matrix cells must be an array',
        path,
      ),
    );
    return [];
  }

  const cells = value.filter(isInstitutionMatrixCell);
  if (cells.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CELLS_INVALID',
        'Institution matrix cells must have ids, rowId, columnId and bounded options',
        path,
      ),
    );
  }

  return cells;
}

function readInstitutionMatrixValues(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedInstitutionMatrixValue[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        'Institution matrix correction must be an array',
        path,
      ),
    );
    return [];
  }

  const values = value.filter(isInstitutionMatrixValue);
  if (values.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTITUTION_MATRIX_CORRECTION_INVALID',
        'Institution matrix correction values must have cellId and optionId',
        path,
      ),
    );
  }

  return values;
}

function readDiagram(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedDiagram | null {
  if (!isDiagram(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_DIAGRAM_INVALID',
        'Diagram labeling diagram must be a bounded semantic object',
        path,
      ),
    );
    return null;
  }

  return value;
}

function readDiagramLabelingSlots(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedDiagramLabelingSlot[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        'Diagram labeling slots must be an array',
        path,
      ),
    );
    return [];
  }

  const slots = value.filter(isDiagramLabelingSlot);
  if (slots.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_SLOTS_INVALID',
        'Diagram labeling slots must have ids, anchors, prompts and bounded options',
        path,
      ),
    );
  }

  return slots;
}

function readDiagramLabelingValues(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedDiagramLabelingValue[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        'Diagram labeling correction must be an array',
        path,
      ),
    );
    return [];
  }

  const values = value.filter(isDiagramLabelingValue);
  if (values.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_DIAGRAM_LABELING_CORRECTION_INVALID',
        'Diagram labeling correction values must have slotId and optionId',
        path,
      ),
    );
  }

  return values;
}

function readCalculationChoices(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCalculationChoice[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_CHOICES ||
    value.length > MAX_CHOICES
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
        'Calculation MCQ choices must contain between two and six items',
        path,
      ),
    );
    return [];
  }

  const choices = value.filter(isCalculationChoice);
  if (
    choices.length !== value.length ||
    hasDuplicates(choices.map((choice) => choice.id))
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_CHOICES_INVALID',
        'Calculation MCQ choices must have unique non-empty ids, labels and integer values',
        path,
      ),
    );
  }

  return choices;
}

function readImageChoices(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedImageChoiceOption[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_CHOICES ||
    value.length > MAX_CHOICES
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice choices must contain between two and six items',
        path,
      ),
    );
    return [];
  }

  const choices = value.filter(isImageChoiceOption);
  if (choices.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_IMAGE_CHOICE_INVALID',
        'Image choice choices must have ids, labels, catalog asset ids and public alt text',
        path,
      ),
    );
  }

  return choices;
}

function readCalculationData(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCalculationData | null {
  if (!isRecord(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_INVALID',
        'Calculation MCQ calculation must be an object',
        path,
      ),
    );
    return null;
  }

  switch (value.mode) {
    case 'absolute_majority_threshold': {
      const validVotes = value.validVotes;
      if (
        typeof validVotes !== 'number' ||
        !Number.isInteger(validVotes) ||
        validVotes < 1 ||
        validVotes > MAX_CALCULATION_VOTES
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_ABSOLUTE_MAJORITY_INVALID',
            'Absolute majority calculation requires bounded positive integer valid votes',
            `${path}.validVotes`,
          ),
        );
        return null;
      }

      return {
        mode: 'absolute_majority_threshold',
        validVotes,
      };
    }
    case 'largest_remainder_target_party_seats': {
      const parties = readCalculationParties(
        value.parties,
        issues,
        `${path}.parties`,
      );
      const totalSeats = value.totalSeats;
      const targetPartyId = value.targetPartyId;
      const totalVotes = parties.reduce((sum, party) => sum + party.votes, 0);
      const validTotalSeats =
        typeof totalSeats === 'number' &&
        Number.isInteger(totalSeats) &&
        totalSeats >= 1 &&
        totalSeats <= MAX_CALCULATION_TOTAL_SEATS;
      const validTargetPartyId = plainString(targetPartyId);
      const validPartySet =
        parties.length >= MIN_CALCULATION_PARTIES &&
        parties.length <= MAX_CALCULATION_PARTIES &&
        !hasDuplicates(parties.map((party) => party.id)) &&
        parties.length ===
          (Array.isArray(value.parties) ? value.parties.length : -1);

      if (!validTotalSeats) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_LARGEST_REMAINDER_SEATS_INVALID',
            'Largest remainder calculation requires bounded positive integer total seats',
            `${path}.totalSeats`,
          ),
        );
      }

      if (!validTargetPartyId) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_TARGET_PARTY_INVALID',
            'Largest remainder calculation requires a target party id',
            `${path}.targetPartyId`,
          ),
        );
      }

      if (!validPartySet) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
            'Largest remainder calculation requires two to eight parties with unique ids',
            `${path}.parties`,
          ),
        );
      }

      if (totalVotes <= 0) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_TOTAL_VOTES_INVALID',
            'Largest remainder calculation requires at least one vote',
            `${path}.parties`,
          ),
        );
      }

      if (
        validTargetPartyId &&
        !parties.some((party) => party.id === targetPartyId)
      ) {
        issues.push(
          issue(
            'RICH_CLOSED_CALCULATION_TARGET_PARTY_INVALID',
            'Largest remainder target party must exist',
            `${path}.targetPartyId`,
          ),
        );
      }

      if (
        !validTotalSeats ||
        !validTargetPartyId ||
        !validPartySet ||
        totalVotes <= 0 ||
        !parties.some((party) => party.id === targetPartyId)
      ) {
        return null;
      }

      return {
        mode: 'largest_remainder_target_party_seats',
        totalSeats,
        targetPartyId,
        parties,
      };
    }
    default:
      issues.push(
        issue(
          'RICH_CLOSED_CALCULATION_MODE_INVALID',
          'Calculation MCQ mode is not supported',
          `${path}.mode`,
        ),
      );
      return null;
  }
}

function readCalculationParties(
  value: unknown,
  issues: RichClosedExerciseValidationIssue[],
  path: string,
): RichClosedCalculationParty[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
        'Largest remainder parties must be an array',
        path,
      ),
    );
    return [];
  }

  const parties = value.filter(isCalculationParty);
  if (parties.length !== value.length) {
    issues.push(
      issue(
        'RICH_CLOSED_CALCULATION_PARTIES_INVALID',
        'Largest remainder parties must have ids, labels and bounded integer votes',
        path,
      ),
    );
  }

  return parties;
}

function validateOptionalInstruction(
  instruction: unknown,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (
    instruction !== undefined &&
    instruction !== null &&
    !boundedString(instruction, 1, MAX_INSTRUCTION_LENGTH)
  ) {
    issues.push(
      issue(
        'RICH_CLOSED_INSTRUCTION_INVALID',
        'Optional instruction must be bounded when provided',
        'instruction',
      ),
    );
  }
}

function validateExplanation(
  explanation: unknown,
  issues: RichClosedExerciseValidationIssue[],
) {
  if (!boundedString(explanation, 1, MAX_EXPLANATION_LENGTH)) {
    issues.push(
      issue(
        'RICH_CLOSED_EXPLANATION_INVALID',
        'Private correction explanation is required and bounded',
        'explanation',
      ),
    );
  }
}

function isRichClosedQuestionKind(
  value: unknown,
): value is RichClosedQuestionKind {
  return (
    typeof value === 'string' &&
    RICH_CLOSED_QUESTION_KINDS.includes(value as RichClosedQuestionKind)
  );
}

function isRichClosedCognitiveSkill(
  value: unknown,
): value is (typeof RICH_CLOSED_COGNITIVE_SKILLS)[number] {
  return (
    typeof value === 'string' &&
    RICH_CLOSED_COGNITIVE_SKILLS.includes(
      value as (typeof RICH_CLOSED_COGNITIVE_SKILLS)[number],
    )
  );
}

function isChoice(value: unknown): value is RichClosedChoice {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isLabelItem(value: unknown): value is { id: string; label: string } {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isTimelineEvent(value: unknown): value is {
  id: string;
  label: string;
  description?: string | null;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_TIMELINE_EVENT_DESCRIPTION_LENGTH,
      ))
  );
}

function isTrueFalseRow(value: unknown): value is {
  id: string;
  statement: string;
  context?: string | null;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.statement, 1, MAX_STATEMENT_LENGTH) &&
    (value.context === undefined ||
      value.context === null ||
      boundedString(value.context, 1, MAX_STATEMENT_LENGTH))
  );
}

function isTrueFalseValue(value: unknown): value is RichClosedTrueFalseValue {
  return (
    isRecord(value) &&
    plainString(value.rowId) &&
    typeof value.value === 'boolean'
  );
}

function isDescribedLabelItem(value: unknown): value is {
  id: string;
  label: string;
  description?: string | null;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH,
      ))
  );
}

function isInstitutionMatrixOption(value: unknown): value is {
  id: string;
  label: string;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isInstitutionMatrixCell(
  value: unknown,
): value is RichClosedInstitutionMatrixCell {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    plainString(value.rowId) &&
    plainString(value.columnId) &&
    (value.prompt === undefined ||
      value.prompt === null ||
      boundedString(value.prompt, 1, MAX_INSTRUCTION_LENGTH)) &&
    Array.isArray(value.options) &&
    value.options.every(isInstitutionMatrixOption)
  );
}

function isInstitutionMatrixValue(
  value: unknown,
): value is RichClosedInstitutionMatrixValue {
  return (
    isRecord(value) && plainString(value.cellId) && plainString(value.optionId)
  );
}

function isDiagram(value: unknown): value is RichClosedDiagram {
  return (
    isRecord(value) &&
    (value.title === undefined ||
      value.title === null ||
      boundedString(value.title, 1, 180)) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH,
      )) &&
    isDiagramLayout(value.layout) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isDiagramNode) &&
    (value.groups === undefined ||
      (Array.isArray(value.groups) && value.groups.every(isDiagramGroup))) &&
    Array.isArray(value.edges) &&
    value.edges.every(isDiagramEdge)
  );
}

function isDiagramLayout(value: unknown): value is RichClosedDiagramLayout {
  return (
    typeof value === 'string' &&
    DIAGRAM_LAYOUTS.includes(value as RichClosedDiagramLayout)
  );
}

function isDiagramGroup(value: unknown): value is RichClosedDiagramGroup {
  return isDescribedLabelItem(value);
}

function isDiagramNode(value: unknown): value is RichClosedDiagramNode {
  if (!isRecord(value) || !isDescribedLabelItem(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.groupId === undefined ||
    record.groupId === null ||
    plainString(record.groupId)
  );
}

function isDiagramEdge(value: unknown): value is RichClosedDiagramEdge {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    plainString(value.fromNodeId) &&
    plainString(value.toNodeId) &&
    (value.label === undefined ||
      value.label === null ||
      boundedString(value.label, 1, 220)) &&
    (value.description === undefined ||
      value.description === null ||
      boundedString(
        value.description,
        1,
        MAX_DESCRIBED_ITEM_DESCRIPTION_LENGTH,
      ))
  );
}

function isDiagramAnchorType(
  value: unknown,
): value is RichClosedDiagramAnchorType {
  return value === 'node' || value === 'edge';
}

function isDiagramLabelingOption(value: unknown): value is {
  id: string;
  label: string;
} {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220)
  );
}

function isDiagramLabelingSlot(
  value: unknown,
): value is RichClosedDiagramLabelingSlot {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    isDiagramAnchorType(value.anchorType) &&
    plainString(value.anchorId) &&
    boundedString(value.prompt, 1, MAX_INSTRUCTION_LENGTH) &&
    Array.isArray(value.options) &&
    value.options.every(isDiagramLabelingOption)
  );
}

function isDiagramLabelingValue(
  value: unknown,
): value is RichClosedDiagramLabelingValue {
  return (
    isRecord(value) && plainString(value.slotId) && plainString(value.optionId)
  );
}

function isCalculationChoice(
  value: unknown,
): value is RichClosedCalculationChoice {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    Number.isInteger(value.value)
  );
}

function isImageChoiceOption(
  value: unknown,
): value is RichClosedImageChoiceOption {
  return (
    isRecord(value) &&
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    plainString(value.imageAssetId) &&
    boundedString(value.altText, 1, 320) &&
    (value.caption === undefined ||
      value.caption === null ||
      boundedString(value.caption, 1, 220)) &&
    (value.creditLabel === undefined ||
      value.creditLabel === null ||
      boundedString(value.creditLabel, 1, 220)) &&
    (value.license === undefined ||
      value.license === 'public_domain' ||
      value.license === 'own_generated' ||
      value.license === 'open_license' ||
      value.license === 'internal_placeholder')
  );
}

function isCalculationParty(
  value: unknown,
): value is RichClosedCalculationParty {
  if (!isRecord(value)) {
    return false;
  }

  const votes = value.votes;

  return (
    plainString(value.id) &&
    boundedString(value.label, 1, 220) &&
    typeof votes === 'number' &&
    Number.isInteger(votes) &&
    votes >= 0 &&
    votes <= MAX_CALCULATION_VOTES
  );
}

function containsFreeAnswerField(value: Record<string, unknown>): boolean {
  // Closed questions may contain private corrections, but never text-answer
  // shaped fields. This keeps V1-A separate from the open_question activity.
  return ['answerText', 'freeTextAnswer', 'textAnswer', 'modelAnswer'].some(
    (key) => Object.prototype.hasOwnProperty.call(value, key),
  );
}

function containsForbiddenRenderField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenRenderField);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      FORBIDDEN_RICH_CLOSED_RENDER_KEYS.has(key) ||
      containsForbiddenRenderField(nestedValue),
  );
}

function choiceIds(choices: RichClosedChoice[]): Set<string> {
  return new Set(choices.map((choice) => choice.id));
}

function idSet(items: Array<{ id: string }>): Set<string> {
  return new Set(items.map((item) => item.id));
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readInteger(value: unknown): number | null {
  return Number.isInteger(value) ? (value as number) : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(plainString);
}

function toStringSet(
  value: readonly string[] | ReadonlySet<string> | undefined,
): ReadonlySet<string> | null {
  if (value === undefined) {
    return null;
  }

  return value instanceof Set ? value : new Set(value);
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function plainString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function boundedString(value: unknown, minLength: number, maxLength: number) {
  return (
    typeof value === 'string' &&
    value.trim().length >= minLength &&
    value.length <= maxLength
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: string,
  message: string,
  path?: string,
): RichClosedExerciseValidationIssue {
  return {
    code,
    message,
    ...(path === undefined ? {} : { path }),
    severity: 'error',
  };
}

function rejected(
  issues: RichClosedExerciseValidationIssue[],
): RichClosedExerciseValidationResult {
  return {
    accepted: false,
    issues,
  };
}

~~~~

### src/modules/activities/infrastructure/genkit-rich-closed-question.generator.spec.ts

~~~~ts
type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenkitInput = {
  plugins: unknown[];
  model: string;
};

type OpenAICompatibleInput = {
  name: string;
  apiKey?: string;
  baseURL?: string;
};

const mockMistralPlugin = { name: 'mistral-plugin' };
const mockGooglePlugin = { name: 'google-plugin' };
const mockGenerate = jest.fn<Promise<{ output?: unknown }>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockOpenAICompatible = jest.fn<unknown, [OpenAICompatibleInput]>(
  () => mockMistralPlugin,
);
const mockGoogleAI = jest.fn<unknown, []>(() => mockGooglePlugin);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
}));

jest.mock('@genkit-ai/compat-oai', () => ({
  __esModule: true,
  default: mockOpenAICompatible,
  openAICompatible: mockOpenAICompatible,
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: mockGoogleAI,
}));

import { Logger } from '@nestjs/common';
import {
  GenkitRichClosedQuestionGenerator,
  RICH_CLOSED_GENERATION_CONTRACT_INVALID,
  RICH_CLOSED_GENERATION_QUALITY_REJECTED,
  RICH_CLOSED_GENERATION_SCHEMA_INVALID,
  RICH_CLOSED_GENERATION_SOURCE_INVALID,
  RICH_CLOSED_PROMPT_VERSION,
} from './genkit-rich-closed-question.generator';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from '../application/rich-closed-questions/rich-closed-question.fixtures';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import type { RichClosedExercise } from '../application/rich-closed-questions/rich-closed-question.types';

describe('GenkitRichClosedQuestionGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalMistralFallbackModel = process.env.MISTRAL_FALLBACK_MODEL;
  const originalMistralRichClosedFallbackModel =
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL;
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.RICH_CLOSED_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.RICH_CLOSED_GENERATION_MAX_CHARS;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('MISTRAL_FALLBACK_MODEL', originalMistralFallbackModel);
    restoreEnv(
      'MISTRAL_RICH_CLOSED_FALLBACK_MODEL',
      originalMistralRichClosedFallbackModel,
    );
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('RICH_CLOSED_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('RICH_CLOSED_GENERATION_MAX_CHARS', originalMaxChars);
    mockOpenAICompatible.mockClear();
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('does not initialize Genkit when imported or constructed', () => {
    new GenkitRichClosedQuestionGenerator();

    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGoogleAI).not.toHaveBeenCalled();
    expect(mockGenkit).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('generates a validated V1-A rich closed exercise with metadata only observations', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockResolvedValue({ output: generatedExercise() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInput());

    expect(mockOpenAICompatible).toHaveBeenCalledWith({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(mockGenkit).toHaveBeenCalledWith({
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-small-latest',
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('rich-closed-question-v1');
    expect(generateInput?.prompt).toContain('questionTypeMix');
    expect(generateInput?.prompt).toContain('single_choice');
    expect(generateInput?.prompt).toContain('case_qualification');
    expect(generateInput?.prompt).toContain('error_detection');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire des questions fermées.',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais inclure de modelAnswer',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre',
    );
    expect(generateInput?.prompt).toContain('JSON object only');
    expect(generateInput?.prompt).toContain('sans Markdown');
    expect(generateInput?.prompt).toContain('sans code fences');
    expect(generateInput?.prompt).toContain(
      'cognitiveSkill autorisés: memorization, comprehension, comparison, classification, case_application, procedure, error_detection, causality',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes single_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, correctChoiceId, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Aucun champ additionnel n’est autorisé.',
    );
    expect(generateInput?.output.schema).toBeDefined();
    expect(exercise).toMatchObject({
      id: 'rich-exercise-1',
      version: 'rich-closed-question-v1',
      metadata: {
        flowName: 'richClosedQuestionGeneration',
        provider: 'mistral',
        model: 'mistral/mistral-small-latest',
        promptVersion: RICH_CLOSED_PROMPT_VERSION,
        schemaVersion: 'rich-closed-question-v1',
      },
    });
    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('success');
    expect(observation.flowName).toBe('richClosedQuestionGeneration');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('generates a validated V1-B rich closed exercise when the mix requests timeline and date_slider', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1B() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1B());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
      ],
    );
    expect(generateInput?.prompt).toContain('timeline');
    expect(generateInput?.prompt).toContain('date_slider');
    expect(generateInput?.prompt).toContain(
      'timeline, date_slider, true_false_grid et cause_consequence sont des types V1-B fermés',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire true_false, fill_blank_dropdown',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes timeline: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, events, correctOrder, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes date_slider: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, minYear, maxYear, step, correctYear, toleranceYears, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-B rich closed exercise when the mix requests true_false_grid and cause_consequence', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1BFull() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1BFull());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
      ],
    );
    expect(generateInput?.prompt).toContain('true_false_grid');
    expect(generateInput?.prompt).toContain('cause_consequence');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire true_false_grid avec 3 à 8 rows',
    );
    expect(generateInput?.prompt).toContain(
      'Tu dois produire cause_consequence avec 3 à 6 causes/consequences',
    );
    expect(generateInput?.prompt).toContain('institution_matrix');
    expect(generateInput?.prompt).toContain(
      'institution_matrix, diagram_labeling et calculation_mcq sont des types V1-C fermés',
    );
    expect(generateInput?.prompt).toContain('aucun type V1-023 ou suivant');
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes true_false_grid: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, correctValues, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes cause_consequence: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, causes, consequences, correctPairs, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-C rich closed exercise when the mix requests institution_matrix', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1C() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1C());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
      ],
    );
    expect(generateInput?.prompt).toContain('institution_matrix');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire institution_matrix avec 2 à 5 rows',
    );
    expect(generateInput?.prompt).toContain('3 à 12 cells idéalement');
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre.',
    );
    expect(generateInput?.prompt).toContain('Types V1-023+ interdits');
    expect(generateInput?.prompt).toContain(
      'Clés exactes institution_matrix: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, columns, cells, correctValues, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-C rich closed exercise when the mix requests diagram_labeling', async () => {
    mockGenerate.mockResolvedValue({ output: generatedExerciseV1CFull() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1CFull());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
      ],
    );
    expect(generateInput?.prompt).toContain('diagram_labeling');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire diagram_labeling avec un diagramme sémantique simple',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire un diagramme sous forme de code',
    );
    expect(generateInput?.prompt).toContain(
      'Types V1-023+ interdits: fill_blank_dropdown.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes diagram_labeling: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, diagram, slots, correctValues, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-C rich closed exercise when the mix requests calculation_mcq', async () => {
    mockGenerate.mockResolvedValue({
      output: generatedExerciseV1CCalculation(),
    });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1CCalculation());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
        'calculation_mcq',
      ],
    );
    expect(generateInput?.prompt).toContain('calculation_mcq');
    expect(generateInput?.prompt).toContain(
      'absolute_majority_threshold ou largest_remainder_target_party_seats',
    );
    expect(generateInput?.prompt).toContain('formule libre');
    expect(generateInput?.prompt).toContain('D’Hondt');
    expect(generateInput?.prompt).toContain(
      'Types V1-023+ interdits: fill_blank_dropdown.',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes calculation_mcq: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, scenario, calculation, choices, correctChoiceId, explanation.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('generates a validated V1-D rich closed exercise when the mix requests image_choice', async () => {
    mockGenerate.mockResolvedValue({
      output: generatedExerciseV1DImageChoice(),
    });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInputV1DImageChoice());
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];

    expect(exercise.questions.map((question) => question.questionKind)).toEqual(
      [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
        'calculation_mcq',
        'image_choice',
      ],
    );
    expect(generateInput?.prompt).toContain('image_choice');
    expect(generateInput?.prompt).toContain(
      'image_choice est un type V1-D fermé',
    );
    expect(generateInput?.prompt).toContain('Catalogue image contrôlé V1-D');
    expect(generateInput?.prompt).toContain(
      'image-choice-historical-figure-001-v1',
    );
    expect(generateInput?.prompt).toContain('sans URL, image générée');
    expect(generateInput?.prompt).toContain('base64, blob, storagePath');
    expect(generateInput?.prompt).toContain(
      'label et caption sont publics et ne doivent jamais contenir ni recopier le semanticLabel',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes image_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, choices, correctChoiceId, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Types V1-023+ interdits: fill_blank_dropdown.',
    );
    expect(getObservedObservation(observer).status).toBe('success');
  });

  it('logs metadata-only diagnostics when generated question count is wrong', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: generatedExercise().questions.slice(0, 5),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'count',
      expectedQuestionCount: 6,
      actualQuestionCount: 5,
      expectedQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
      actualQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 0,
      },
    });
    expect(errorLog.diagnostic.questionKinds).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
    ]);
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('logs metadata-only diagnostics when generated question type mix is wrong', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('multiple_choice'),
            id: 'multiple-mix-1',
          },
          richClosedQuestionFixture('matching'),
          richClosedQuestionFixture('ordering'),
          richClosedQuestionFixture('case_qualification'),
          richClosedQuestionFixture('error_detection'),
          {
            ...richClosedQuestionFixture('case_qualification'),
            id: 'case-mix-2',
          },
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'mix',
      expectedQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
      actualQuestionTypeMix: {
        single_choice: 0,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 2,
        error_detection: 1,
      },
    });
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('rejects output with a question kind outside the rich closed allowlist', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            questionKind: 'fill_blank_dropdown',
          },
        ],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRichClosedQuestionGenerator(observer).generate(
        generationInput(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    expect(getObservedObservation(observer).errorCode).toBe(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
    );
  });

  it('rejects V1-B output carrying free-answer fields', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExerciseV1B(),
        questions: generatedExerciseV1B().questions.map((question) =>
          question.questionKind === 'timeline'
            ? { ...question, answerText: 'réponse libre interdite' }
            : question,
        ),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInputV1B()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it.each(['html', 'svg', 'mermaid', 'widget', 'renderPayload'] as const)(
    'rejects diagram_labeling output carrying arbitrary render field %s',
    async (field) => {
      mockGenerate.mockResolvedValue({
        output: {
          ...generatedExerciseV1CFull(),
          questions: generatedExerciseV1CFull().questions.map((question) =>
            question.questionKind === 'diagram_labeling'
              ? { ...question, [field]: '<unsafe>' }
              : question,
          ),
        },
      });

      await expect(
        new GenkitRichClosedQuestionGenerator().generate(
          generationInputV1CFull(),
        ),
      ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
    },
  );

  it.each([
    'formula',
    'expression',
    'script',
    'code',
    'renderPayload',
  ] as const)(
    'rejects calculation_mcq output carrying free-form calculation field %s',
    async (field) => {
      mockGenerate.mockResolvedValue({
        output: {
          ...generatedExerciseV1CCalculation(),
          questions: generatedExerciseV1CCalculation().questions.map(
            (question) =>
              question.questionKind === 'calculation_mcq'
                ? { ...question, [field]: 'unsafe' }
                : question,
          ),
        },
      });

      await expect(
        new GenkitRichClosedQuestionGenerator().generate(
          generationInputV1CCalculation(),
        ),
      ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
    },
  );

  it.each([
    'imageUrl',
    'url',
    'storagePath',
    'base64',
    'blob',
    'semanticLabel',
    'answerHint',
    'renderPayload',
  ] as const)(
    'rejects image_choice output carrying arbitrary/private image field %s',
    async (field) => {
      mockGenerate.mockResolvedValue({
        output: {
          ...generatedExerciseV1DImageChoice(),
          questions: generatedExerciseV1DImageChoice().questions.map(
            (question) =>
              question.questionKind === 'image_choice'
                ? { ...question, [field]: 'unsafe' }
                : question,
          ),
        },
      });

      await expect(
        new GenkitRichClosedQuestionGenerator().generate(
          generationInputV1DImageChoice(),
        ),
      ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
    },
  );

  it('rejects calculation_mcq output with an unsupported mode', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExerciseV1CCalculation(),
        questions: generatedExerciseV1CCalculation().questions.map(
          (question) =>
            question.questionKind === 'calculation_mcq'
              ? {
                  ...question,
                  calculation: {
                    mode: 'dhondt_highest_average',
                    totalSeats: 10,
                  },
                }
              : question,
        ),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(
        generationInputV1CCalculation(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it('logs schema diagnostics from direct issues without leaking sensitive context', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    const schemaError = new Error('Schema parser saw SENTINEL_FULL_CHUNK_TEXT');
    Object.assign(schemaError, {
      issues: [
        {
          code: 'invalid_type',
          path: ['questions', 0, 'choices'],
        },
      ],
    });
    mockGenerate.mockRejectedValue(schemaError);

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'schema',
      schemaErrorName: 'Error',
      schemaIssueCount: 1,
      validationIssues: [
        {
          code: 'invalid_type',
          path: 'questions.0.choices',
          severity: 'error',
        },
      ],
    });
    expect(JSON.stringify(errorLog)).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(JSON.stringify(errorLog)).not.toContain('test-mistral-key');
  });

  it('logs schema diagnostics from nested cause issues', async () => {
    const schemaError = new Error('Wrapper output error');
    Object.assign(schemaError, {
      cause: {
        issues: [
          {
            code: 'unrecognized_keys',
            path: ['questions', 2, 'extra'],
          },
        ],
      },
    });
    mockGenerate.mockRejectedValue(schemaError);

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'schema',
      schemaIssueCount: 1,
      validationIssues: [
        {
          code: 'unrecognized_keys',
          path: 'questions.2.extra',
          severity: 'error',
        },
      ],
    });
  });

  it('logs a scrubbed and truncated schema message when no issues are available', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockRejectedValue(
      new Error(
        `JSON output invalid ${'x'.repeat(300)} SENTINEL_FULL_CHUNK_TEXT test-mistral-key`,
      ),
    );

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'schema',
      schemaErrorName: 'Error',
      schemaIssueCount: 0,
    });
    expect(JSON.stringify(errorLog)).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(JSON.stringify(errorLog)).not.toContain('test-mistral-key');
    expect(
      String(
        (errorLog.diagnostic as { schemaErrorMessagePreview?: string })
          .schemaErrorMessagePreview,
      ).length,
    ).toBeLessThanOrEqual(220);
  });

  it('rejects output dominated by single_choice through the quality gate', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: Array.from({ length: 6 }, (_value, index) => ({
          ...richClosedQuestionFixture('single_choice'),
          id: `single-${index + 1}`,
          prompt: `Question de choix unique ${index + 1}`,
        })),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_QUALITY_REJECTED });
  });

  it('rejects output containing feedback on choices', async () => {
    const exercise = generatedExercise();
    const firstQuestion = exercise.questions[0];
    if (firstQuestion.questionKind !== 'single_choice') {
      throw new Error('Fixture first question must be single_choice');
    }
    mockGenerate.mockResolvedValue({
      output: {
        ...exercise,
        questions: [
          {
            ...firstQuestion,
            choices: [
              {
                ...firstQuestion.choices[0],
                feedback: 'Feedback privé interdit dans la sortie Genkit V1-A.',
              },
              ...firstQuestion.choices.slice(1),
            ],
          },
          ...exercise.questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it('rejects output with unknown source chunks', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['chunk-unknown'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SOURCE_INVALID });
  });

  it('rejects output with invalid cognitiveSkill through contract validation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            cognitiveSkill: 'creative_writing',
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'contract',
      validationIssues: [
        {
          code: 'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
          path: 'questions.0.cognitiveSkill',
        },
      ],
    });
  });

  it('rejects output with invalid multiple_choice bounds through contract validation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          richClosedQuestionFixture('single_choice'),
          {
            ...richClosedQuestionFixture('multiple_choice'),
            minSelections: 1,
            maxSelections: 1,
            correctChoiceIds: ['choice-a', 'choice-b'],
          },
          ...generatedExercise().questions.slice(2),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });
  });

  it('logs quality gate issue codes when quality rejects the generation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: Array.from({ length: 6 }, (_value, index) => ({
          ...richClosedQuestionFixture('single_choice'),
          id: `single-quality-${index + 1}`,
          prompt: `Question de choix unique ${index + 1}`,
        })),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_QUALITY_REJECTED });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    const diagnostic = errorLog.diagnostic as {
      failureType?: string;
      qualityIssues?: Array<{ code: string }>;
    };
    expect(diagnostic.failureType).toBe('quality');
    expect(diagnostic.qualityIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        }),
      ]),
    );
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('keeps source invalid categorized and logs source issue paths', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['chunk-unknown'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SOURCE_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'source',
      validationIssues: [
        {
          code: 'RICH_CLOSED_SOURCE_UNKNOWN',
          path: 'questions.0.sourceChunkIds',
        },
      ],
    });
  });

  it('retries with a stricter repair prompt when fallback model is configured after contract invalid output', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate
      .mockResolvedValueOnce({
        output: {
          ...generatedExercise(),
          questions: generatedExercise().questions.slice(0, 5),
        },
      })
      .mockResolvedValueOnce({ output: generatedExercise() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInput());

    expect(exercise.id).toBe('rich-exercise-1');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[1][0].prompt).toContain(
      'Tentative de réparation stricte',
    );
    expect(mockGenerate.mock.calls[1][0].prompt).toContain('Question count: 6');
    expect(mockGenerate.mock.calls[1][0].prompt).toContain('questionTypeMix');
    expect(
      observer.observe.mock.calls.map(([observation]) => observation),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
        model: 'mistral/mistral-small-latest',
      }),
      expect.objectContaining({
        status: 'success',
        model: 'mistral/mistral-large-latest',
      }),
    ]);
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(loggerWarnSpy.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(loggerWarnSpy.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('returns the final controlled error when fallback model also fails', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: generatedExercise().questions.slice(0, 5),
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRichClosedQuestionGenerator(observer).generate(
        generationInput(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(
      observer.observe.mock.calls.map(([observation]) => observation),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      }),
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      }),
    ]);
    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'count',
      expectedQuestionCount: 6,
      actualQuestionCount: 5,
    });
  });

  it('returns controlled errors without leaking generated payloads', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['SENTINEL_SECRET_CHUNK'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({
      code: RICH_CLOSED_GENERATION_SOURCE_INVALID,
      message: RICH_CLOSED_GENERATION_SOURCE_INVALID,
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.not.toThrow('SENTINEL_SECRET_CHUNK');
  });
});

function generatedExercise(): RichClosedExercise {
  return richClosedExerciseFixture();
}

function generatedExerciseV1B(): RichClosedExercise {
  return richClosedV1BExerciseFixture();
}

function generatedExerciseV1BFull(): RichClosedExercise {
  return richClosedV1BFullExerciseFixture();
}

function generatedExerciseV1C(): RichClosedExercise {
  return richClosedV1CExerciseFixture();
}

function generatedExerciseV1CFull(): RichClosedExercise {
  return richClosedV1CFullExerciseFixture();
}

function generatedExerciseV1CCalculation(): RichClosedExercise {
  return richClosedV1CCalculationExerciseFixture();
}

function generatedExerciseV1DImageChoice(): RichClosedExercise {
  return richClosedV1DImageChoiceExerciseFixture();
}

function generationInput() {
  return {
    studentId: 'student-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnit: {
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Régime parlementaire rationalisé',
      summary:
        'La responsabilité politique du gouvernement et les mécanismes de rationalisation encadrent les rapports entre Parlement et exécutif.',
      difficulty: 'MEDIUM' as const,
      sourceChunkIds: ['chunk-1'],
    },
    chunks: [
      {
        id: 'chunk-1',
        index: 0,
        text: 'SENTINEL_FULL_CHUNK_TEXT',
        pageNumber: null,
      },
    ],
    questionCount: 6,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
    },
    complexityProfile: 'exam' as const,
  };
}

function generationInputV1B() {
  return {
    ...generationInput(),
    questionCount: 8,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
    },
  };
}

function generationInputV1BFull() {
  return {
    ...generationInput(),
    questionCount: 10,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
    },
  };
}

function generationInputV1C() {
  return {
    ...generationInput(),
    questionCount: 11,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
    },
  };
}

function generationInputV1CFull() {
  return {
    ...generationInput(),
    questionCount: 12,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
    },
  };
}

function generationInputV1CCalculation() {
  return {
    ...generationInput(),
    questionCount: 13,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
    },
  };
}

function generationInputV1DImageChoice() {
  return {
    ...generationInput(),
    questionCount: 14,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
      timeline: 1,
      date_slider: 1,
      true_false_grid: 1,
      cause_consequence: 1,
      institution_matrix: 1,
      diagram_labeling: 1,
      calculation_mcq: 1,
      image_choice: 1,
    },
  };
}

function createObserver() {
  return {
    observe: jest.fn<void, [AiGenerationObservation]>(),
  } satisfies AiGenerationObserver & {
    observe: jest.Mock<void, [AiGenerationObservation]>;
  };
}

function getObservedObservation(
  observer: ReturnType<typeof createObserver>,
): AiGenerationObservation {
  expect(observer.observe).toHaveBeenCalledTimes(1);

  return observer.observe.mock.calls[0][0];
}

function getLastRichClosedErrorLog(loggerWarnSpy: jest.SpyInstance): {
  diagnostic?: unknown;
  [key: string]: unknown;
} {
  const parsedLogs = loggerWarnSpy.mock.calls.flatMap(([message]) => {
    const parsed: unknown = JSON.parse(String(message));

    return isLogRecord(parsed) ? [parsed] : [];
  });
  const errorLogs = parsedLogs.filter(
    (log) => log.event === 'rich.closed.generation.error',
  );

  expect(errorLogs.length).toBeGreaterThan(0);

  return errorLogs[errorLogs.length - 1];
}

function isLogRecord(
  value: unknown,
): value is { event?: string; diagnostic?: unknown; [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectNoSensitiveDiagnosticLog(log: unknown) {
  const serialized = JSON.stringify(log);

  expect(serialized).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
  expect(serialized).not.toContain('test-mistral-key');
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

~~~~

### src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts

~~~~ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { genkit, z } from 'genkit';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import {
  type ResolvedArtifactGenkitMetadata,
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
  resolveArtifactMistralFallbackMetadata,
} from '../../ai/infrastructure/document-artifact-genkit-config';
import { isInvalidAiOutputError } from '../../ai/infrastructure/mistral-model-fallback';
import { evaluateRichClosedExerciseQuality } from '../application/rich-closed-questions/rich-closed-question-quality-gate';
import { validateRichClosedExercise } from '../application/rich-closed-questions/rich-closed-question.validator';
import {
  RICH_CLOSED_EXERCISE_VERSION,
  RICH_CLOSED_COGNITIVE_SKILLS,
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedExercise,
  type RichClosedExerciseValidationIssue,
  type RichClosedQuestionKind,
} from '../application/rich-closed-questions/rich-closed-question.types';
import type {
  GeneratedRichClosedExercise,
  RichClosedQuestionGenerationInput,
  RichClosedQuestionGenerator,
} from '../application/rich-closed-questions/rich-closed-question-generator';
import {
  RICH_CLOSED_QUESTION_COUNT_INVALID,
  resolveRichClosedQuestionTypeMix,
} from '../application/rich-closed-questions/rich-closed-question-generation-profile';
import {
  RICH_CLOSED_IMAGE_ASSET_IDS,
  RICH_CLOSED_IMAGE_ASSETS,
} from '../application/rich-closed-questions/rich-closed-image-assets';

export const RICH_CLOSED_FLOW_NAME = 'richClosedQuestionGeneration';
export const RICH_CLOSED_PROMPT_VERSION = 'rich-closed-v1d-004';
export const RICH_CLOSED_SCHEMA_VERSION = RICH_CLOSED_EXERCISE_VERSION;
export const RICH_CLOSED_GENERATION_FAILED = 'RICH_CLOSED_GENERATION_FAILED';
export const RICH_CLOSED_GENERATION_SCHEMA_INVALID =
  'RICH_CLOSED_GENERATION_SCHEMA_INVALID';
export const RICH_CLOSED_GENERATION_CONTRACT_INVALID =
  'RICH_CLOSED_GENERATION_CONTRACT_INVALID';
export const RICH_CLOSED_GENERATION_QUALITY_REJECTED =
  'RICH_CLOSED_GENERATION_QUALITY_REJECTED';
export const RICH_CLOSED_GENERATION_SOURCE_INVALID =
  'RICH_CLOSED_GENERATION_SOURCE_INVALID';

const DEFAULT_MAX_CHUNKS = 8;
const DEFAULT_MAX_CHARS = 8000;
const MAX_QUESTION_COUNT = 20;

const NonEmptyStringSchema = z.string().trim().min(1);
const DifficultySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const SourceChunkIdsSchema = z.array(NonEmptyStringSchema).min(1);
const ImageAssetIdSchema = z.enum(RICH_CLOSED_IMAGE_ASSET_IDS);
const ImageAssetLicenseSchema = z.enum([
  'public_domain',
  'own_generated',
  'open_license',
  'internal_placeholder',
]);

const ChoiceSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const LabelItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const TimelineEventSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const TrueFalseRowSchema = z
  .object({
    id: NonEmptyStringSchema,
    statement: NonEmptyStringSchema,
    context: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const TrueFalseValueSchema = z
  .object({
    rowId: NonEmptyStringSchema,
    value: z.boolean(),
  })
  .strict();

const CauseConsequenceItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const CauseConsequencePairSchema = z
  .object({
    causeId: NonEmptyStringSchema,
    consequenceId: NonEmptyStringSchema,
  })
  .strict();

const InstitutionMatrixAxisItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const InstitutionMatrixOptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const InstitutionMatrixCellSchema = z
  .object({
    id: NonEmptyStringSchema,
    rowId: NonEmptyStringSchema,
    columnId: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema.nullable().optional(),
    options: z.array(InstitutionMatrixOptionSchema).min(2).max(6),
  })
  .strict();

const InstitutionMatrixValueSchema = z
  .object({
    cellId: NonEmptyStringSchema,
    optionId: NonEmptyStringSchema,
  })
  .strict();

const DiagramLayoutSchema = z.enum([
  'vertical_flow',
  'two_column',
  'cycle',
  'hierarchy',
  'plain',
]);

const DiagramGroupSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const DiagramNodeSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
    groupId: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const DiagramEdgeSchema = z
  .object({
    id: NonEmptyStringSchema,
    fromNodeId: NonEmptyStringSchema,
    toNodeId: NonEmptyStringSchema,
    label: NonEmptyStringSchema.nullable().optional(),
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const DiagramSchema = z
  .object({
    title: NonEmptyStringSchema.nullable().optional(),
    description: NonEmptyStringSchema.nullable().optional(),
    layout: DiagramLayoutSchema,
    nodes: z.array(DiagramNodeSchema).min(2).max(8),
    groups: z.array(DiagramGroupSchema).max(4).optional(),
    edges: z.array(DiagramEdgeSchema).max(12),
  })
  .strict();

const DiagramLabelingOptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const DiagramLabelingSlotSchema = z
  .object({
    id: NonEmptyStringSchema,
    anchorType: z.enum(['node', 'edge']),
    anchorId: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema,
    options: z.array(DiagramLabelingOptionSchema).min(2).max(6),
  })
  .strict();

const DiagramLabelingValueSchema = z
  .object({
    slotId: NonEmptyStringSchema,
    optionId: NonEmptyStringSchema,
  })
  .strict();

const CalculationChoiceSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    value: z.number().int(),
  })
  .strict();

const ImageChoiceOptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    imageAssetId: ImageAssetIdSchema,
    altText: NonEmptyStringSchema,
    caption: NonEmptyStringSchema.nullable().optional(),
    creditLabel: NonEmptyStringSchema.nullable().optional(),
    license: ImageAssetLicenseSchema.optional(),
  })
  .strict();

const AbsoluteMajorityThresholdCalculationSchema = z
  .object({
    mode: z.literal('absolute_majority_threshold'),
    validVotes: z.number().int().min(1).max(1_000_000),
  })
  .strict();

const CalculationPartySchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    votes: z.number().int().min(0).max(1_000_000),
  })
  .strict();

const LargestRemainderTargetPartySeatsCalculationSchema = z
  .object({
    mode: z.literal('largest_remainder_target_party_seats'),
    totalSeats: z.number().int().min(1).max(200),
    targetPartyId: NonEmptyStringSchema,
    parties: z.array(CalculationPartySchema).min(2).max(8),
  })
  .strict();

const CalculationDataSchema = z.discriminatedUnion('mode', [
  AbsoluteMajorityThresholdCalculationSchema,
  LargestRemainderTargetPartySeatsCalculationSchema,
]);

const PairSchema = z
  .object({
    leftId: NonEmptyStringSchema,
    rightId: NonEmptyStringSchema,
  })
  .strict();

const QuestionBaseSchema = {
  id: NonEmptyStringSchema,
  prompt: z.string().trim().min(8),
  difficulty: DifficultySchema,
  cognitiveSkill: NonEmptyStringSchema,
  sourceChunkIds: SourceChunkIdsSchema,
};

const SingleChoiceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('single_choice'),
    choices: z.array(ChoiceSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const MultipleChoiceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('multiple_choice'),
    choices: z.array(ChoiceSchema).min(2).max(6),
    minSelections: z.number().int().min(1),
    maxSelections: z.number().int().min(1),
    correctChoiceIds: z.array(NonEmptyStringSchema).min(2),
    explanation: z.string().trim().min(8),
  })
  .strict();

const MatchingQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('matching'),
    leftItems: z.array(LabelItemSchema).min(3),
    rightItems: z.array(LabelItemSchema).min(3),
    correctPairs: z.array(PairSchema).min(3),
    explanation: z.string().trim().min(8),
  })
  .strict();

const OrderingQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('ordering'),
    items: z.array(LabelItemSchema).min(3),
    correctOrder: z.array(NonEmptyStringSchema).min(3),
    explanation: z.string().trim().min(8),
  })
  .strict();

const TimelineQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('timeline'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    events: z.array(TimelineEventSchema).min(3).max(6),
    correctOrder: z.array(NonEmptyStringSchema).min(3).max(6),
    explanation: z.string().trim().min(8),
  })
  .strict();

const DateSliderQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('date_slider'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    minYear: z.number().int(),
    maxYear: z.number().int(),
    step: z.number().int().min(1),
    correctYear: z.number().int(),
    toleranceYears: z.number().int().min(0),
    explanation: z.string().trim().min(8),
  })
  .strict();

const TrueFalseGridQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('true_false_grid'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    rows: z.array(TrueFalseRowSchema).min(3).max(8),
    correctValues: z.array(TrueFalseValueSchema).min(3).max(8),
    explanation: z.string().trim().min(8),
  })
  .strict();

const CauseConsequenceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('cause_consequence'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    causes: z.array(CauseConsequenceItemSchema).min(3).max(6),
    consequences: z.array(CauseConsequenceItemSchema).min(3).max(6),
    correctPairs: z.array(CauseConsequencePairSchema).min(3).max(6),
    explanation: z.string().trim().min(8),
  })
  .strict();

const InstitutionMatrixQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('institution_matrix'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    rows: z.array(InstitutionMatrixAxisItemSchema).min(2).max(5),
    columns: z.array(InstitutionMatrixAxisItemSchema).min(2).max(5),
    cells: z.array(InstitutionMatrixCellSchema).min(3).max(25),
    correctValues: z.array(InstitutionMatrixValueSchema).min(3).max(25),
    explanation: z.string().trim().min(8),
  })
  .strict();

const DiagramLabelingQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('diagram_labeling'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    diagram: DiagramSchema,
    slots: z.array(DiagramLabelingSlotSchema).min(2).max(8),
    correctValues: z.array(DiagramLabelingValueSchema).min(2).max(8),
    explanation: z.string().trim().min(8),
  })
  .strict();

const CalculationMcqQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('calculation_mcq'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    scenario: z.string().trim().min(8).max(900),
    calculation: CalculationDataSchema,
    choices: z.array(CalculationChoiceSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const ImageChoiceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('image_choice'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    choices: z.array(ImageChoiceOptionSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const CaseQualificationQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('case_qualification'),
    caseText: z.string().trim().min(8).max(900),
    choices: z.array(ChoiceSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const ErrorDetectionQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('error_detection'),
    statement: z.string().trim().min(8).max(900),
    errorOptions: z.array(ChoiceSchema).min(2).max(6),
    correctErrorId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const RichClosedQuestionSchema = z.discriminatedUnion('questionKind', [
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  MatchingQuestionSchema,
  OrderingQuestionSchema,
  CaseQualificationQuestionSchema,
  ErrorDetectionQuestionSchema,
  TimelineQuestionSchema,
  DateSliderQuestionSchema,
  TrueFalseGridQuestionSchema,
  CauseConsequenceQuestionSchema,
  InstitutionMatrixQuestionSchema,
  DiagramLabelingQuestionSchema,
  CalculationMcqQuestionSchema,
  ImageChoiceQuestionSchema,
]);

const GeneratedRichClosedExerciseSchema = z
  .object({
    id: NonEmptyStringSchema,
    version: z.literal(RICH_CLOSED_EXERCISE_VERSION),
    title: NonEmptyStringSchema,
    subjectId: NonEmptyStringSchema,
    documentId: NonEmptyStringSchema.nullable(),
    knowledgeUnitId: NonEmptyStringSchema,
    questions: z.array(RichClosedQuestionSchema).min(1).max(MAX_QUESTION_COUNT),
  })
  .strict();

type RichClosedPromptChunk = {
  id: string;
  index: number;
  text: string;
  pageNumber: number | null;
};

type RichClosedGenerationFailureType =
  | 'schema'
  | 'count'
  | 'mix'
  | 'contract'
  | 'quality'
  | 'source';

interface RichClosedGenerationDiagnosticIssue {
  code: string;
  path?: string;
  severity?: RichClosedExerciseValidationIssue['severity'];
}

interface RichClosedGenerationDiagnostic {
  failureType: RichClosedGenerationFailureType;
  schemaErrorName?: string;
  schemaErrorMessagePreview?: string;
  schemaIssueCount?: number;
  expectedQuestionCount?: number;
  actualQuestionCount?: number | null;
  expectedQuestionTypeMix?: Record<RichClosedQuestionKind, number>;
  actualQuestionTypeMix?: Record<RichClosedQuestionKind, number>;
  validationIssues?: RichClosedGenerationDiagnosticIssue[];
  qualityIssues?: RichClosedGenerationDiagnosticIssue[];
  questionIds?: string[];
  questionKinds?: RichClosedQuestionKind[];
  sourceChunkIds?: string[];
}

@Injectable()
export class GenkitRichClosedQuestionGenerator implements RichClosedQuestionGenerator {
  private readonly logger = new Logger(GenkitRichClosedQuestionGenerator.name);
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedArtifactGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: RichClosedQuestionGenerationInput,
  ): Promise<GeneratedRichClosedExercise> {
    const primaryMetadata = this.resolveMetadata();
    const fallbackMetadata = resolveArtifactMistralFallbackMetadata(
      primaryMetadata,
      'MISTRAL_RICH_CLOSED_FALLBACK_MODEL',
    );
    const attempts = fallbackMetadata
      ? [primaryMetadata, fallbackMetadata]
      : [primaryMetadata];
    const chunks = selectRichClosedChunks(input);
    const questionTypeMix = resolveRequestedQuestionTypeMix(input);
    const prompt = buildRichClosedPrompt({
      input,
      chunks,
      questionTypeMix,
    });
    const inputSize = prompt.length;
    let previousDiagnostic: RichClosedGenerationDiagnostic | undefined;

    this.logger.log(
      JSON.stringify(
        buildRichClosedContextLog({
          input,
          chunks,
          metadata: primaryMetadata,
          inputSize,
          questionTypeMix,
        }),
      ),
    );

    for (const [index, metadata] of attempts.entries()) {
      const startedAt = Date.now();
      const attemptPrompt =
        index === 0
          ? prompt
          : buildRichClosedRepairPrompt({
              input,
              chunks,
              questionTypeMix,
              previousDiagnostic,
            });
      const attemptInputSize = attemptPrompt.length;

      try {
        const { output } = await this.getAi(metadata).generate({
          prompt: attemptPrompt,
          output: {
            schema: GeneratedRichClosedExerciseSchema,
          },
        });
        const exercise = normalizeGeneratedRichClosedExercise({
          output,
          input,
          chunks,
          metadata,
          inputSize: attemptInputSize,
          questionTypeMix,
        });

        this.logger.log(
          JSON.stringify(
            buildRichClosedOutputLog({ input, exercise, metadata }),
          ),
        );

        this.observer.observe({
          flowName: RICH_CLOSED_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: RICH_CLOSED_PROMPT_VERSION,
          schemaVersion: RICH_CLOSED_SCHEMA_VERSION,
          inputSize: attemptInputSize,
          durationMs: Date.now() - startedAt,
          status: 'success',
          documentId: input.documentId ?? undefined,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId,
          studentId: input.studentId,
        });

        return exercise;
      } catch (error) {
        const controlledError = toRichClosedGenerationError(error);
        previousDiagnostic = controlledError.diagnostic;

        this.logger.warn(
          JSON.stringify(
            buildRichClosedErrorLog({
              input,
              metadata,
              errorCode: controlledError.code,
              diagnostic: controlledError.diagnostic,
            }),
          ),
        );

        this.observer.observe({
          flowName: RICH_CLOSED_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: RICH_CLOSED_PROMPT_VERSION,
          schemaVersion: RICH_CLOSED_SCHEMA_VERSION,
          inputSize: attemptInputSize,
          durationMs: Date.now() - startedAt,
          status: 'error',
          errorCode: controlledError.code,
          documentId: input.documentId ?? undefined,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId,
          studentId: input.studentId,
        });

        if (
          index === 0 &&
          attempts.length > 1 &&
          isInvalidAiOutputError(controlledError, [
            RICH_CLOSED_GENERATION_SCHEMA_INVALID,
            RICH_CLOSED_GENERATION_CONTRACT_INVALID,
            RICH_CLOSED_GENERATION_QUALITY_REJECTED,
            RICH_CLOSED_GENERATION_SOURCE_INVALID,
          ])
        ) {
          continue;
        }

        throw controlledError;
      }
    }

    throw new RichClosedQuestionGenerationError(RICH_CLOSED_GENERATION_FAILED);
  }

  private getAi(
    metadata: ResolvedArtifactGenkitMetadata,
  ): ReturnType<typeof genkit> {
    const cacheKey = `${metadata.provider}:${metadata.model}`;
    const existingAi = this.aiByModel.get(cacheKey);

    if (existingAi) {
      return existingAi;
    }

    const ai = genkit(resolveArtifactGenkitConfig(metadata).config);
    this.aiByModel.set(cacheKey, ai);

    return ai;
  }

  private resolveMetadata(): ResolvedArtifactGenkitMetadata {
    this.resolvedMetadata ??= resolveArtifactGenkitMetadata();
    return this.resolvedMetadata;
  }
}

export class RichClosedQuestionGenerationError extends Error {
  constructor(
    readonly code: string,
    readonly diagnostic?: RichClosedGenerationDiagnostic,
  ) {
    super(code);
    this.name = 'RichClosedQuestionGenerationError';
  }
}

function normalizeGeneratedRichClosedExercise(input: {
  output: unknown;
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  metadata: ResolvedArtifactGenkitMetadata;
  inputSize: number;
  questionTypeMix: Record<RichClosedQuestionKind, number>;
}): GeneratedRichClosedExercise {
  const parsed = parseRichClosedGenerationOutput(input.output);
  const exercise: RichClosedExercise = {
    id: parsed.id,
    version: parsed.version,
    title: parsed.title,
    subjectId: input.input.subjectId,
    documentId: input.input.documentId ?? null,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    questions: parsed.questions,
  };
  const knownSourceChunkIds = new Set(input.chunks.map((chunk) => chunk.id));

  if (exercise.questions.length !== input.input.questionCount) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: 'count',
      }),
    );
  }

  const validation = validateRichClosedExercise(exercise, {
    knownSourceChunkIds,
  });

  if (!validation.accepted) {
    const sourceIssue = hasSourceIssue(validation.issues);

    throw new RichClosedQuestionGenerationError(
      sourceIssue
        ? RICH_CLOSED_GENERATION_SOURCE_INVALID
        : RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: sourceIssue ? 'source' : 'contract',
        validationIssues: validation.issues,
      }),
    );
  }

  const quality = evaluateRichClosedExerciseQuality(exercise, {
    knownSourceChunkIds,
  });

  if (!quality.accepted) {
    const sourceIssue = hasSourceIssue(quality.issues);

    throw new RichClosedQuestionGenerationError(
      sourceIssue
        ? RICH_CLOSED_GENERATION_SOURCE_INVALID
        : RICH_CLOSED_GENERATION_QUALITY_REJECTED,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: sourceIssue ? 'source' : 'quality',
        qualityIssues: quality.issues,
      }),
    );
  }

  if (!matchesQuestionTypeMix(exercise, input.questionTypeMix)) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: 'mix',
      }),
    );
  }

  return {
    ...exercise,
    metadata: {
      flowName: RICH_CLOSED_FLOW_NAME,
      provider: input.metadata.provider,
      model: input.metadata.model,
      promptVersion: RICH_CLOSED_PROMPT_VERSION,
      schemaVersion: RICH_CLOSED_SCHEMA_VERSION,
      inputSize: input.inputSize,
    },
  };
}

function parseRichClosedGenerationOutput(output: unknown): RichClosedExercise {
  if (output === undefined || output === null) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
      { failureType: 'schema', actualQuestionCount: null },
    );
  }

  try {
    return GeneratedRichClosedExerciseSchema.parse(
      output,
    ) as RichClosedExercise;
  } catch (error) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
      buildSchemaGenerationDiagnostic(error),
    );
  }
}

function hasSourceIssue(issues: RichClosedExerciseValidationIssue[]): boolean {
  return issues.some((issue) => issue.code.includes('SOURCE'));
}

function matchesQuestionTypeMix(
  exercise: RichClosedExercise,
  questionTypeMix: Record<RichClosedQuestionKind, number>,
): boolean {
  const actualCounts = countQuestionTypeMix(exercise);

  return RICH_CLOSED_QUESTION_KINDS.every(
    (kind) => actualCounts[kind] === questionTypeMix[kind],
  );
}

function countQuestionTypeMix(
  exercise: RichClosedExercise,
): Record<RichClosedQuestionKind, number> {
  const actualCounts = Object.fromEntries(
    RICH_CLOSED_QUESTION_KINDS.map((kind) => [kind, 0]),
  ) as Record<RichClosedQuestionKind, number>;

  for (const question of exercise.questions) {
    actualCounts[question.questionKind] += 1;
  }

  return actualCounts;
}

function resolveRequestedQuestionTypeMix(
  input: RichClosedQuestionGenerationInput,
): Record<RichClosedQuestionKind, number> {
  const fallbackMix = resolveRichClosedQuestionTypeMix({
    questionCount: input.questionCount,
    complexityProfile: input.complexityProfile,
  });
  const requestedEntries = Object.entries(input.questionTypeMix);

  if (requestedEntries.length === 0) {
    return fallbackMix;
  }

  const mix = { ...fallbackMix };
  for (const kind of RICH_CLOSED_QUESTION_KINDS) {
    mix[kind] = input.questionTypeMix[kind] ?? 0;
  }

  if (
    Object.values(mix).some((count) => !Number.isInteger(count) || count < 0) ||
    Object.values(mix).reduce((total, count) => total + count, 0) !==
      input.questionCount
  ) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
    );
  }

  return mix;
}

function buildRichClosedPrompt(input: {
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  questionTypeMix: Record<RichClosedQuestionKind, number>;
}): string {
  return [
    'Tu es un tuteur universitaire qui génère un exercice de questions fermées riches en français.',
    `Tu dois générer un exercice rich closed ${RICH_CLOSED_EXERCISE_VERSION}.`,
    'Tu dois respecter exactement les questionKind demandés.',
    'Tu dois respecter questionTypeMix.',
    `questionTypeMix: ${JSON.stringify(input.questionTypeMix)}`,
    'Tu dois produire uniquement les types rich closed autorisés: single_choice, multiple_choice, matching, ordering, case_qualification, error_detection, timeline, date_slider, true_false_grid, cause_consequence, institution_matrix, diagram_labeling, calculation_mcq, image_choice.',
    'timeline, date_slider, true_false_grid et cause_consequence sont des types V1-B fermés: ils ne doivent jamais demander une réponse libre.',
    'institution_matrix, diagram_labeling et calculation_mcq sont des types V1-C fermés: ils ne doivent jamais demander une réponse libre.',
    'image_choice est un type V1-D fermé: il doit choisir une image dans le catalogue contrôlé, sans réponse libre.',
    'Tu dois produire des questions fermées.',
    'Tu dois interdire toute réponse libre.',
    'Tu dois utiliser les chunks fournis comme seule source de vérité.',
    'Tu dois référencer uniquement des sourceChunkIds existants.',
    'Tu dois inclure au moins une source par question quand des chunks existent.',
    'Tu dois produire des distracteurs plausibles mais non ambigus.',
    'Tu dois produire case_qualification avec un cas court et qualifiable.',
    'Tu dois produire error_detection avec une erreur dominante unique.',
    'Tu dois produire matching avec au moins 3 paires univoques.',
    'Tu dois produire ordering avec au moins 3 items et un ordre complet.',
    'Tu dois produire timeline avec 3 à 6 events, des ids uniques, et un correctOrder complet.',
    'Tu dois produire date_slider avec des années entières, minYear < maxYear, step >= 1, correctYear dans les bornes et toleranceYears >= 0.',
    'Tu dois produire true_false_grid avec 3 à 8 rows, des ids uniques, et un correctValues booléen complet.',
    'Tu dois produire cause_consequence avec 3 à 6 causes/consequences, des ids uniques, et des correctPairs univoques.',
    'Tu dois produire institution_matrix avec 2 à 5 rows, 2 à 5 columns, 3 à 12 cells idéalement, des options fermées par cellule, et sans matrice encyclopédique.',
    'Tu dois produire diagram_labeling avec un diagramme sémantique simple: 2 à 8 nodes, 0 à 12 edges, 2 à 8 slots, 2 à 6 options fermées par slot, et des slots ancrés à des nodes ou edges existants.',
    'Tu dois produire calculation_mcq uniquement avec les modes absolute_majority_threshold ou largest_remainder_target_party_seats, des petits nombres lisibles, des choices à value uniques, une seule choice dont value correspond au calcul, et sans égalité de reste ambiguë.',
    'Pour calculation_mcq, le backend recalculera expectedValue: correctChoiceId doit pointer vers la choice dont value correspond au résultat déterministe.',
    'Tu dois produire image_choice uniquement avec imageAssetId issus du catalogue image contrôlé, des choices fermées, un altText exactement égal au publicAltText du catalogue, un correctChoiceId privé, et sans URL, image générée, base64, blob, storagePath, semanticLabel ni widget.',
    'Pour image_choice, label et caption sont publics et ne doivent jamais contenir ni recopier le semanticLabel: utilise des labels neutres comme “Image A”, “Image B”, et des captions non révélatrices.',
    `Catalogue image contrôlé V1-D: ${formatImageAssetCatalogForPrompt()}`,
    'Tu ne dois jamais produire de formule libre, expression, rawFormula, calculationCode, eval, Function, JavaScript, Python, D’Hondt, Sainte-Laguë, plus forte moyenne, seuil électoral, votes blancs ou votes nuls.',
    'Tu dois produire multiple_choice avec au moins 2 bonnes réponses.',
    'Tu dois éviter les questions de pure restitution.',
    'Tu dois éviter les prompts commençant par “Qui”, “Quand”, “Quelle date”, “Quelle est la définition”, sauf nécessité exceptionnelle.',
    'Tu dois produire des explications privées de correction.',
    'Les corrections privées correctChoiceId, correctChoiceIds, correctPairs, correctOrder, correctValues, correctErrorId et correctYear ne doivent jamais être exposées dans un payload public pré-submit.',
    'Tu ne dois jamais inclure de semanticLabel ni answerHint dans une question générée.',
    'Tu ne dois jamais inclure de modelAnswer, answerText, freeTextAnswer, textAnswer, HTML, SVG, Mermaid, markdown rendu libre, widget libre, renderPayload, imageUrl, assetUrl, url, remoteUrl, src, href, storagePath, bucketPath, cdnUrl, base64, dataUri, blob, rawImage, assetPath, canvas, code, formula, expression, rawFormula, calculationCode, script ou markup.',
    'Tu ne dois jamais produire de widget libre.',
    'Tu ne dois jamais produire un diagramme sous forme de code, balisage, HTML, SVG, Mermaid, Canvas, image URL ou widget libre.',
    'Tu ne dois jamais produire true_false, fill_blank_dropdown, widget libre, ni aucun type V1-023 ou suivant.',
    'Types V1-023+ interdits: fill_blank_dropdown.',
    'Tu dois retourner un JSON object only: un objet JSON brut, sans Markdown, sans code fences, sans texte avant ou après.',
    'Aucun champ additionnel n’est autorisé.',
    `cognitiveSkill autorisés: ${RICH_CLOSED_COGNITIVE_SKILLS.join(', ')}`,
    'Clés communes exactes par question: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds.',
    'Clés exactes single_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, correctChoiceId, explanation.',
    'Clés exactes multiple_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, minSelections, maxSelections, correctChoiceIds, explanation.',
    'Clés exactes matching: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, leftItems, rightItems, correctPairs, explanation.',
    'Clés exactes ordering: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, items, correctOrder, explanation.',
    'Clés exactes timeline: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, events, correctOrder, explanation.',
    'Clés exactes date_slider: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, minYear, maxYear, step, correctYear, toleranceYears, explanation.',
    'Clés exactes true_false_grid: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, correctValues, explanation.',
    'Clés exactes cause_consequence: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, causes, consequences, correctPairs, explanation.',
    'Clés exactes institution_matrix: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, columns, cells, correctValues, explanation.',
    'Clés exactes diagram_labeling: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, diagram, slots, correctValues, explanation.',
    'Clés exactes calculation_mcq: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, scenario, calculation, choices, correctChoiceId, explanation.',
    'Clés exactes image_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, choices, correctChoiceId, explanation. Chaque choice contient seulement id, label, imageAssetId, altText, caption optionnel, creditLabel optionnel, license optionnel.',
    'Clés exactes calculation absolute_majority_threshold: mode, validVotes.',
    'Clés exactes calculation largest_remainder_target_party_seats: mode, totalSeats, targetPartyId, parties; chaque party a id, label, votes.',
    'Clés exactes case_qualification: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, caseText, choices, correctChoiceId, explanation.',
    'Clés exactes error_detection: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, statement, errorOptions, correctErrorId, explanation.',
    'Tu dois retourner uniquement du JSON strict conforme au schema demandé.',
    `Prompt version: ${RICH_CLOSED_PROMPT_VERSION}.`,
    `Schema version: ${RICH_CLOSED_SCHEMA_VERSION}.`,
    `Question count: ${input.input.questionCount}.`,
    `Complexity profile: ${input.input.complexityProfile}.`,
    `Titre de la notion: ${input.input.knowledgeUnit.title}`,
    `Résumé de la notion: ${input.input.knowledgeUnit.summary}`,
    JSON.stringify(toPromptPayload(input.input, input.chunks)),
  ].join('\n\n');
}

function buildRichClosedRepairPrompt(input: {
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  questionTypeMix: Record<RichClosedQuestionKind, number>;
  previousDiagnostic?: RichClosedGenerationDiagnostic;
}): string {
  return [
    'Tentative de réparation stricte de génération rich closed.',
    'La tentative précédente a été rejetée avant toute utilisation.',
    'Tu dois corriger uniquement la structure de sortie, sans inventer de source et sans relâcher le contrat.',
    `Diagnostic metadata-only précédent: ${JSON.stringify(input.previousDiagnostic ?? {})}`,
    'Rappels de structure par type:',
    '- single_choice: choices, correctChoiceId, explanation.',
    '- multiple_choice: choices, minSelections, maxSelections, correctChoiceIds, explanation.',
    '- matching: leftItems, rightItems, correctPairs, explanation.',
    '- ordering: items, correctOrder, explanation.',
    '- timeline: events (3 à 6), correctOrder complet, explanation.',
    '- date_slider: minYear, maxYear, step, correctYear, toleranceYears, explanation.',
    '- true_false_grid: rows (3 à 8), correctValues booléens complets, explanation.',
    '- cause_consequence: causes, consequences, correctPairs univoques, explanation.',
    '- institution_matrix: rows (2 à 5), columns (2 à 5), cells (3 à 12 idéalement), options fermées par cellule, correctValues complets, explanation.',
    '- diagram_labeling: diagram sémantique (2 à 8 nodes, 0 à 12 edges), slots (2 à 8) ancrés à des nodes/edges existants, options fermées par slot, correctValues complets, explanation, sans HTML/SVG/Mermaid/widget.',
    '- calculation_mcq: scenario, calculation en mode absolute_majority_threshold ou largest_remainder_target_party_seats, choices avec value uniques, correctChoiceId, explanation, sans formule libre, sans D’Hondt, sans code.',
    '- image_choice: choices (2 à 6) avec imageAssetId du catalogue contrôlé, altText public exact, label/caption neutres qui ne recopient pas semanticLabel, correctChoiceId, explanation, sans URL, image générée, base64, blob, storagePath, semanticLabel ni widget.',
    '- case_qualification: caseText, choices, correctChoiceId, explanation.',
    '- error_detection: statement, errorOptions, correctErrorId, explanation.',
    'Tu dois respecter le nombre exact de questions, le mix exact, et uniquement les sourceChunkIds autorisés.',
    buildRichClosedPrompt(input),
  ].join('\n\n');
}

function formatImageAssetCatalogForPrompt(): string {
  return JSON.stringify(
    RICH_CLOSED_IMAGE_ASSETS.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      semanticLabel: asset.semanticLabel,
      publicAltText: asset.publicAltText,
      creditLabel: asset.creditLabel ?? null,
      license: asset.license,
    })),
  );
}

function toPromptPayload(
  input: RichClosedQuestionGenerationInput,
  chunks: RichClosedPromptChunk[],
) {
  return {
    subjectId: input.subjectId,
    documentId: input.documentId ?? null,
    knowledgeUnit: {
      id: input.knowledgeUnit.id,
      subjectId: input.knowledgeUnit.subjectId,
      title: input.knowledgeUnit.title,
      summary: input.knowledgeUnit.summary,
      difficulty: input.knowledgeUnit.difficulty ?? null,
      sourceChunkIds: input.knowledgeUnit.sourceChunkIds ?? [],
    },
    allowedSourceChunkIds: chunks.map((chunk) => chunk.id),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
    })),
  };
}

function selectRichClosedChunks(
  input: RichClosedQuestionGenerationInput,
): RichClosedPromptChunk[] {
  const chunks = deduplicateChunks(input.chunks);
  const sourceChunkIds = new Set(input.knowledgeUnit.sourceChunkIds ?? []);
  const prioritizedChunks = [
    ...chunks.filter((chunk) => sourceChunkIds.has(chunk.id)),
    ...chunks.filter((chunk) => !sourceChunkIds.has(chunk.id)),
  ];
  const maxChunks = resolvePositiveInteger(
    process.env.RICH_CLOSED_GENERATION_MAX_CHUNKS,
    DEFAULT_MAX_CHUNKS,
  );
  const maxChars = resolvePositiveInteger(
    process.env.RICH_CLOSED_GENERATION_MAX_CHARS,
    DEFAULT_MAX_CHARS,
  );
  let remainingChars = maxChars;

  return prioritizedChunks.slice(0, maxChunks).flatMap((chunk) => {
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

function deduplicateChunks(
  chunks: RichClosedQuestionGenerationInput['chunks'],
): RichClosedPromptChunk[] {
  const chunksById = new Map<
    string,
    RichClosedQuestionGenerationInput['chunks'][number]
  >();

  for (const chunk of chunks) {
    if (chunk.text.trim().length > 0 && !chunksById.has(chunk.id)) {
      chunksById.set(chunk.id, chunk);
    }
  }

  return [...chunksById.values()].sort(
    (left, right) => left.index - right.index,
  );
}

function buildRichClosedContextLog(input: {
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  metadata: ResolvedArtifactGenkitMetadata;
  inputSize: number;
  questionTypeMix: Record<RichClosedQuestionKind, number>;
}) {
  return {
    event: 'rich.closed.generation.context',
    flowName: RICH_CLOSED_FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    requestedQuestionCount: input.input.questionCount,
    questionTypeMix: input.questionTypeMix,
    complexityProfile: input.input.complexityProfile,
    providedChunkCount: input.input.chunks.length,
    selectedChunkCount: input.chunks.length,
    selectedChunkCharCount: input.chunks.reduce(
      (total, chunk) => total + chunk.text.length,
      0,
    ),
    inputSize: input.inputSize,
    documentId: input.input.documentId ?? undefined,
    subjectId: input.input.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    studentId: input.input.studentId,
  };
}

function buildRichClosedOutputLog(input: {
  input: RichClosedQuestionGenerationInput;
  exercise: GeneratedRichClosedExercise;
  metadata: ResolvedArtifactGenkitMetadata;
}) {
  const quality = evaluateRichClosedExerciseQuality(input.exercise);

  return {
    event: 'rich.closed.generation.output',
    flowName: RICH_CLOSED_FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    outputQuestionCount: input.exercise.questions.length,
    questionKindCounts: quality.metrics.questionKindCounts,
    difficultyCounts: quality.metrics.difficultyCounts,
    cognitiveSkillCounts: quality.metrics.cognitiveSkillCounts,
    sourcedQuestionCount: quality.metrics.sourcedQuestionCount,
    documentId: input.input.documentId ?? undefined,
    subjectId: input.input.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    studentId: input.input.studentId,
  };
}

function buildRichClosedErrorLog(input: {
  input: RichClosedQuestionGenerationInput;
  metadata: ResolvedArtifactGenkitMetadata;
  errorCode: string;
  diagnostic?: RichClosedGenerationDiagnostic;
}) {
  return {
    event: 'rich.closed.generation.error',
    flowName: RICH_CLOSED_FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    errorCode: input.errorCode,
    ...(input.diagnostic === undefined ? {} : { diagnostic: input.diagnostic }),
    documentId: input.input.documentId ?? undefined,
    subjectId: input.input.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    studentId: input.input.studentId,
  };
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function toRichClosedGenerationError(
  error: unknown,
): RichClosedQuestionGenerationError {
  if (error instanceof RichClosedQuestionGenerationError) {
    return error;
  }

  if (
    error instanceof Error &&
    error.message === RICH_CLOSED_QUESTION_COUNT_INVALID
  ) {
    return new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      { failureType: 'count' },
    );
  }

  if (
    error instanceof Error &&
    (error.name === 'ZodError' ||
      error.message.toLowerCase().includes('schema') ||
      error.message.toLowerCase().includes('json') ||
      error.message.toLowerCase().includes('output'))
  ) {
    return new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
      buildSchemaGenerationDiagnostic(error),
    );
  }

  return new RichClosedQuestionGenerationError(RICH_CLOSED_GENERATION_FAILED);
}

function buildRichClosedGenerationDiagnostic(input: {
  exercise: RichClosedExercise;
  expectedQuestionCount: number;
  expectedQuestionTypeMix: Record<RichClosedQuestionKind, number>;
  failureType: RichClosedGenerationFailureType;
  validationIssues?: RichClosedExerciseValidationIssue[];
  qualityIssues?: RichClosedExerciseValidationIssue[];
}): RichClosedGenerationDiagnostic {
  return {
    failureType: input.failureType,
    expectedQuestionCount: input.expectedQuestionCount,
    actualQuestionCount: input.exercise.questions.length,
    expectedQuestionTypeMix: input.expectedQuestionTypeMix,
    actualQuestionTypeMix: countQuestionTypeMix(input.exercise),
    ...(input.validationIssues === undefined
      ? {}
      : { validationIssues: toDiagnosticIssues(input.validationIssues) }),
    ...(input.qualityIssues === undefined
      ? {}
      : { qualityIssues: toDiagnosticIssues(input.qualityIssues) }),
    questionIds: input.exercise.questions.map((question) => question.id),
    questionKinds: input.exercise.questions.map(
      (question) => question.questionKind,
    ),
    sourceChunkIds: Array.from(
      new Set(
        input.exercise.questions.flatMap((question) => question.sourceChunkIds),
      ),
    ),
  };
}

function buildSchemaGenerationDiagnostic(
  error: unknown,
): RichClosedGenerationDiagnostic {
  const schemaIssues = findSchemaIssues(error);
  const errorName = error instanceof Error ? error.name : typeof error;
  const messagePreview =
    error instanceof Error ? scrubSchemaErrorMessage(error.message) : undefined;

  return {
    failureType: 'schema',
    schemaErrorName: errorName,
    schemaIssueCount: schemaIssues.length,
    ...(messagePreview === undefined
      ? {}
      : { schemaErrorMessagePreview: messagePreview }),
    ...(schemaIssues.length === 0 ? {} : { validationIssues: schemaIssues }),
  };
}

function findSchemaIssues(
  error: unknown,
): RichClosedGenerationDiagnosticIssue[] {
  const seen = new Set<unknown>();
  const pending: unknown[] = [error];

  while (pending.length > 0) {
    const current = pending.shift();

    if (current === null || current === undefined || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (current instanceof z.ZodError) {
      return current.issues.map(toSchemaDiagnosticIssue);
    }

    if (typeof current !== 'object') {
      continue;
    }

    const record = current as Record<string, unknown>;
    const issues = readUnknownIssues(record.issues);

    if (issues.length > 0) {
      return issues;
    }

    pending.push(record.cause, record.error, record.details);
  }

  return [];
}

function readUnknownIssues(
  issues: unknown,
): RichClosedGenerationDiagnosticIssue[] {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.flatMap((issue) => {
    if (typeof issue !== 'object' || issue === null || Array.isArray(issue)) {
      return [];
    }

    const record = issue as Record<string, unknown>;
    const code =
      typeof record.code === 'string' && record.code.trim().length > 0
        ? record.code
        : 'schema_issue';
    const path = normalizeSchemaIssuePath(record.path);

    return [
      {
        code,
        ...(path === undefined ? {} : { path }),
        severity: 'error' as const,
      },
    ];
  });
}

function toSchemaDiagnosticIssue(
  issue: z.ZodIssue,
): RichClosedGenerationDiagnosticIssue {
  return {
    code: issue.code,
    path: issue.path.join('.'),
    severity: 'error',
  };
}

function normalizeSchemaIssuePath(path: unknown): string | undefined {
  if (Array.isArray(path)) {
    return path.map(String).join('.');
  }

  if (typeof path === 'string' && path.trim().length > 0) {
    return path;
  }

  return undefined;
}

function scrubSchemaErrorMessage(message: string): string | undefined {
  const scrubbed = redactKnownSensitiveFragments(message)
    .replace(/SENTINEL_[A-Z0-9_]+/g, '[redacted-sentinel]')
    .replace(/\s+/g, ' ')
    .trim();

  if (scrubbed.length === 0) {
    return undefined;
  }

  return scrubbed.slice(0, 220);
}

function redactKnownSensitiveFragments(value: string): string {
  const secretValues = [
    process.env.MISTRAL_API_KEY,
    process.env.DATABASE_URL,
    process.env.REDIS_URL,
    process.env.FIREBASE_PRIVATE_KEY,
  ].filter(
    (secret): secret is string =>
      typeof secret === 'string' && secret.trim().length > 0,
  );

  return secretValues.reduce(
    (scrubbed, secret) => scrubbed.split(secret).join('[redacted-secret]'),
    value,
  );
}

function toDiagnosticIssues(
  issues: RichClosedExerciseValidationIssue[],
): RichClosedGenerationDiagnosticIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    ...(issue.path === undefined ? {} : { path: issue.path }),
    severity: issue.severity,
  }));
}

~~~~

### src/modules/activities/interfaces/activities.controller.ts

~~~~ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import {
  DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID,
  resolveDiagnosticQuizMaxQuestionCount,
  resolveDiagnosticQuizQuestionCount,
} from '../application/diagnostic-quiz-question-count';
import { StartOpenQuestionActivityUseCase } from '../application/start-open-question-activity.use-case';
import { StartNextActivityUseCase } from '../application/start-next-activity.use-case';
import { SubmitOpenAnswerUseCase } from '../application/submit-open-answer.use-case';
import { SubmitActivityResultUseCase } from '../application/submit-activity-result.use-case';
import {
  RICH_CLOSED_GENERATION_CONTRACT_INVALID,
  RICH_CLOSED_GENERATION_FAILED,
  RICH_CLOSED_GENERATION_QUALITY_REJECTED,
  RICH_CLOSED_GENERATION_SCHEMA_INVALID,
  RICH_CLOSED_GENERATION_SOURCE_INVALID,
  RICH_CLOSED_SESSION_ALREADY_COMPLETED,
  RICH_CLOSED_SESSION_NOT_COMPLETED,
  RICH_CLOSED_SESSION_NOT_FOUND,
  RICH_CLOSED_SOURCE_CONTEXT_EMPTY,
  RICH_CLOSED_START_INVALID_INPUT,
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
} from '../application/rich-closed-questions/rich-closed-question-errors';
import { GetRichClosedExerciseResultUseCase } from '../application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from '../application/rich-closed-questions/get-rich-closed-exercise.use-case';
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedAnswer,
  type RichClosedQuestionKind,
} from '../application/rich-closed-questions/rich-closed-question.types';
import {
  assertRichClosedQuestionTypeMix,
  StartRichClosedExerciseUseCase,
} from '../application/rich-closed-questions/start-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from '../application/rich-closed-questions/submit-rich-closed-exercise.use-case';
import type {
  DiagnosticQuizSelectionMode,
  DiagnosticQuizVisualType,
} from '../application/diagnostic-quiz-generator';

class StartActivityDto {
  subjectId!: string;
  knowledgeUnitId?: string;
  questionCount?: number;
  visualsEnabled?: boolean;
  visualTypes?: string[];
  selectionModes?: string[];
}

class SubmitActivityDto {
  answers!: Array<{
    questionId: string;
    choiceId?: string;
    choiceIds?: string[];
  }>;
}

class StartOpenQuestionDto {
  subjectId!: string;
  knowledgeUnitId!: string;
}

class SubmitOpenAnswerDto {
  answerText!: string;
}

class StartRichClosedExerciseDto {
  subjectId!: string;
  documentId?: string | null;
  knowledgeUnitId!: string;
  questionCount?: number;
  complexityProfile?: string;
  questionTypeMix?: Record<string, unknown>;
}

class SubmitRichClosedExerciseDto {
  answers!: unknown[];
}

interface ValidatedActivityAnswer {
  questionId: string;
  choiceId?: string;
  choiceIds?: string[];
}

interface ValidatedStartActivityBody {
  subjectId: string;
  knowledgeUnitId?: string;
  questionCount?: number;
  visualsEnabled?: boolean;
  visualTypes?: DiagnosticQuizVisualType[];
  selectionModes?: DiagnosticQuizSelectionMode[];
}

interface ValidatedStartRichClosedBody {
  subjectId: string;
  documentId?: string | null;
  knowledgeUnitId: string;
  questionCount: number;
  complexityProfile: 'standard' | 'exam' | 'advanced';
  questionTypeMix?: Partial<Record<RichClosedQuestionKind, number>>;
}

@Controller('activities')
@UseGuards(FirebaseAuthGuard)
export class ActivitiesController {
  constructor(
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
    private readonly submitActivityResult: SubmitActivityResultUseCase,
    private readonly submitOpenAnswer: SubmitOpenAnswerUseCase,
    private readonly startRichClosedExercise: StartRichClosedExerciseUseCase,
    private readonly getRichClosedExercise: GetRichClosedExerciseUseCase,
    private readonly submitRichClosedExercise: SubmitRichClosedExerciseUseCase,
    private readonly getRichClosedExerciseResult: GetRichClosedExerciseResultUseCase,
  ) {}

  @Post('next')
  start(
    @CurrentStudent() student: { id: string },
    @Body() body: StartActivityDto,
  ) {
    const validatedBody = validateStartActivityBody(body);

    return this.startNextActivity
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        questionCount: validatedBody.questionCount,
        visualsEnabled: validatedBody.visualsEnabled,
        visualTypes: validatedBody.visualTypes,
        selectionModes: validatedBody.selectionModes,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post('open-question')
  startOpenQuestion(
    @CurrentStudent() student: { id: string },
    @Body() body: StartOpenQuestionDto,
  ) {
    const validatedBody = validateStartOpenQuestionBody(body);

    return this.startOpenQuestionActivity
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post('rich-closed/start')
  startRichClosed(
    @CurrentStudent() student: { id: string },
    @Body() body: StartRichClosedExerciseDto,
  ) {
    const validatedBody = validateStartRichClosedBody(body);

    return this.startRichClosedExercise
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        documentId: validatedBody.documentId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        questionCount: validatedBody.questionCount,
        complexityProfile: validatedBody.complexityProfile,
        questionTypeMix: validatedBody.questionTypeMix,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Get('rich-closed/:sessionId')
  getRichClosed(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );

    return this.getRichClosedExercise
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post('rich-closed/:sessionId/submit')
  submitRichClosed(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitRichClosedExerciseDto,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );
    const validatedBody = validateSubmitRichClosedBody(body);

    return this.submitRichClosedExercise
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        answers: validatedBody.answers,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Get('rich-closed/:sessionId/result')
  getRichClosedResult(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );

    return this.getRichClosedExerciseResult
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post(':sessionId/result')
  submit(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitActivityDto,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );
    const validatedBody = validateSubmitActivityBody(body);

    return this.submitActivityResult
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        answers: validatedBody.answers,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }

  @Post(':sessionId/open-answer')
  submitOpenQuestionAnswer(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitOpenAnswerDto,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Activity session id',
    );
    const validatedBody = validateSubmitOpenAnswerBody(body);

    return this.submitOpenAnswer
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
        answerText: validatedBody.answerText,
      })
      .catch((error: unknown) => {
        normalizeActivityError(error);
      });
  }
}

function validateStartActivityBody(
  input: StartActivityDto,
): ValidatedStartActivityBody {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    knowledgeUnitId:
      input?.knowledgeUnitId === undefined
        ? undefined
        : validateRequiredId(input.knowledgeUnitId, 'Knowledge unit id'),
    questionCount: validateQuestionCount(input?.questionCount),
    visualsEnabled: validateOptionalBoolean(
      input?.visualsEnabled,
      'Visuals enabled',
    ),
    visualTypes: validateVisualTypes(input?.visualTypes),
    selectionModes: validateSelectionModes(input?.selectionModes),
  };
}

function validateSubmitActivityBody(input: SubmitActivityDto): {
  answers: ValidatedActivityAnswer[];
} {
  if (!Array.isArray(input?.answers)) {
    throw new BadRequestException('Activity answers must be an array');
  }

  const seenQuestionIds = new Set<string>();
  const answers = input.answers.map((answer) => {
    const questionId = validateRequiredId(answer?.questionId, 'Question id');
    const choiceId =
      answer?.choiceId === undefined
        ? undefined
        : validateRequiredId(answer.choiceId, 'Choice id');
    const choiceIds =
      answer?.choiceIds === undefined
        ? undefined
        : validateChoiceIds(answer.choiceIds);

    if ((choiceId === undefined) === (choiceIds === undefined)) {
      throw new BadRequestException(
        'Exactly one of choiceId or choiceIds is required',
      );
    }

    if (seenQuestionIds.has(questionId)) {
      throw new BadRequestException('Duplicate answers are not allowed');
    }

    seenQuestionIds.add(questionId);

    return {
      questionId,
      ...(choiceId === undefined ? {} : { choiceId }),
      ...(choiceIds === undefined ? {} : { choiceIds }),
    };
  });

  return { answers };
}

function validateStartOpenQuestionBody(input: StartOpenQuestionDto): {
  subjectId: string;
  knowledgeUnitId: string;
} {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    knowledgeUnitId: validateRequiredId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
  };
}

function validateSubmitOpenAnswerBody(input: SubmitOpenAnswerDto): {
  answerText: string;
} {
  if (typeof input?.answerText !== 'string') {
    throw new BadRequestException('Open answer text is required');
  }

  const answerText = input.answerText.trim();

  if (answerText.length === 0) {
    throw new BadRequestException('Open answer text is required');
  }

  return { answerText };
}

function validateStartRichClosedBody(
  input: StartRichClosedExerciseDto,
): ValidatedStartRichClosedBody {
  const questionCount = validateRichClosedQuestionCount(input?.questionCount);
  const questionTypeMix =
    input?.questionTypeMix === undefined
      ? undefined
      : validateRichClosedQuestionTypeMix(input.questionTypeMix, questionCount);

  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    documentId: validateOptionalId(input?.documentId, 'Document id'),
    knowledgeUnitId: validateRequiredId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
    questionCount,
    complexityProfile: validateRichClosedComplexityProfile(
      input?.complexityProfile,
    ),
    ...(questionTypeMix === undefined ? {} : { questionTypeMix }),
  };
}

function validateSubmitRichClosedBody(input: SubmitRichClosedExerciseDto): {
  answers: RichClosedAnswer[];
} {
  if (!Array.isArray(input?.answers) || input.answers.length === 0) {
    throw new BadRequestException(
      'Rich closed answers must be a non-empty array',
    );
  }

  const seenQuestionIds = new Set<string>();
  const answers = input.answers.map((answer) => {
    const validatedAnswer = validateRichClosedAnswer(answer);

    if (seenQuestionIds.has(validatedAnswer.questionId)) {
      throw new BadRequestException('Duplicate answers are not allowed');
    }

    seenQuestionIds.add(validatedAnswer.questionId);

    return validatedAnswer;
  });

  return { answers };
}

function validateOptionalBoolean(input: unknown, label: string) {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'boolean') {
    throw new BadRequestException(`${label} must be a boolean`);
  }

  return input;
}

function validateVisualTypes(
  input: unknown,
): DiagnosticQuizVisualType[] | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    throw new BadRequestException(
      'Diagnostic quiz visualTypes must be an array',
    );
  }

  const visualTypes = input.map((value) => {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Diagnostic quiz visualTypes must contain strings',
      );
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === 'IMAGE') {
      throw new BadRequestException(
        'Diagnostic quiz IMAGE visuals are not supported yet',
      );
    }

    if (normalized !== 'CHART' && normalized !== 'DIAGRAM') {
      throw new BadRequestException('Diagnostic quiz visual type is invalid');
    }

    return normalized;
  });

  return Array.from(new Set(visualTypes));
}

function validateSelectionModes(
  input: unknown,
): DiagnosticQuizSelectionMode[] | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    throw new BadRequestException(
      'Diagnostic quiz selectionModes must be an array',
    );
  }

  const selectionModes = input.map((value) => {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Diagnostic quiz selectionModes must contain strings',
      );
    }

    const normalized = value.trim();

    if (normalized !== 'single' && normalized !== 'multiple') {
      throw new BadRequestException(
        'Diagnostic quiz selection mode is invalid',
      );
    }

    return normalized;
  });

  return Array.from(new Set(selectionModes));
}

function validateChoiceIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Choice ids must be a non-empty array');
  }

  return input.map((choiceId) => validateRequiredId(choiceId, 'Choice id'));
}

function validateOptionalId(
  input: unknown,
  label: string,
): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  return validateRequiredId(input, label);
}

function validateRequiredId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }

  return input.trim();
}

function validateQuestionCount(input: unknown): number | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'number') {
    throw questionCountBadRequest();
  }

  try {
    return resolveDiagnosticQuizQuestionCount(input);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === DIAGNOSTIC_QUIZ_QUESTION_COUNT_INVALID
    ) {
      throw questionCountBadRequest();
    }

    throw error;
  }
}

function validateRichClosedQuestionCount(input: unknown): number {
  if (input === undefined) {
    return 6;
  }

  if (
    typeof input !== 'number' ||
    !Number.isInteger(input) ||
    input < 6 ||
    input > 20
  ) {
    throw new BadRequestException(
      'Rich closed question count must be an integer between 6 and 20',
    );
  }

  return input;
}

function validateRichClosedComplexityProfile(
  input: unknown,
): 'standard' | 'exam' | 'advanced' {
  if (input === undefined) {
    return 'exam';
  }

  if (input === 'standard' || input === 'exam' || input === 'advanced') {
    return input;
  }

  throw new BadRequestException('Rich closed complexity profile is invalid');
}

function validateRichClosedQuestionTypeMix(
  input: unknown,
  questionCount: number,
): Partial<Record<RichClosedQuestionKind, number>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException(
      'Rich closed questionTypeMix must be an object',
    );
  }

  const mix: Partial<Record<RichClosedQuestionKind, number>> = {};

  for (const [key, value] of Object.entries(input)) {
    if (
      !isRichClosedQuestionKind(key) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new BadRequestException('Rich closed questionTypeMix is invalid');
    }

    mix[key] = Number(value);
  }

  try {
    assertRichClosedQuestionTypeMix({
      questionCount,
      questionTypeMix: mix,
    });
  } catch {
    throw new BadRequestException('Rich closed questionTypeMix is invalid');
  }

  return mix;
}

function validateRichClosedAnswer(input: unknown): RichClosedAnswer {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    containsForbiddenRichClosedSubmitField(input)
  ) {
    throw new BadRequestException('Rich closed answer is invalid');
  }

  const answer = input as Record<string, unknown>;
  const questionId = validateRequiredId(answer.questionId, 'Question id');
  const questionKind = answer.questionKind;

  if (!isRichClosedQuestionKind(questionKind)) {
    throw new BadRequestException('Rich closed question kind is invalid');
  }

  switch (questionKind) {
    case 'single_choice':
    case 'case_qualification':
      return {
        questionId,
        questionKind,
        choiceId: validateRequiredId(answer.choiceId, 'Choice id'),
      };
    case 'multiple_choice':
      return {
        questionId,
        questionKind,
        choiceIds: validateChoiceIds(answer.choiceIds),
      };
    case 'matching':
      return {
        questionId,
        questionKind,
        pairs: validateRichClosedPairs(answer.pairs),
      };
    case 'ordering':
      return {
        questionId,
        questionKind,
        orderedIds: validateChoiceIds(answer.orderedIds),
      };
    case 'timeline':
      return {
        questionId,
        questionKind,
        orderedEventIds: validateChoiceIds(answer.orderedEventIds),
      };
    case 'date_slider':
      return {
        questionId,
        questionKind,
        year: validateRichClosedYear(answer.year),
      };
    case 'true_false_grid':
      return {
        questionId,
        questionKind,
        values: validateRichClosedTrueFalseValues(answer.values),
      };
    case 'cause_consequence':
      return {
        questionId,
        questionKind,
        pairs: validateRichClosedCauseConsequencePairs(answer.pairs),
      };
    case 'institution_matrix':
      return {
        questionId,
        questionKind,
        values: validateRichClosedInstitutionMatrixValues(answer.values),
      };
    case 'diagram_labeling':
      return {
        questionId,
        questionKind,
        values: validateRichClosedDiagramLabelingValues(answer.values),
      };
    case 'calculation_mcq':
    case 'image_choice':
      return {
        questionId,
        questionKind,
        choiceId: validateRequiredId(answer.choiceId, 'Choice id'),
      };
    case 'error_detection':
      return {
        questionId,
        questionKind,
        errorId: validateRequiredId(answer.errorId, 'Error id'),
      };
  }
}

function validateRichClosedPairs(input: unknown): Array<{
  leftId: string;
  rightId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Rich closed matching pairs are required');
  }

  return input.map((pair) => {
    if (typeof pair !== 'object' || pair === null || Array.isArray(pair)) {
      throw new BadRequestException('Rich closed matching pair is invalid');
    }

    const record = pair as Record<string, unknown>;

    return {
      leftId: validateRequiredId(record.leftId, 'Left id'),
      rightId: validateRequiredId(record.rightId, 'Right id'),
    };
  });
}

function validateRichClosedTrueFalseValues(input: unknown): Array<{
  rowId: string;
  value: boolean;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Rich closed true/false values are required');
  }

  return input.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException('Rich closed true/false value is invalid');
    }

    const record = value as Record<string, unknown>;
    if (typeof record.value !== 'boolean') {
      throw new BadRequestException('Rich closed true/false value is invalid');
    }

    return {
      rowId: validateRequiredId(record.rowId, 'Row id'),
      value: record.value,
    };
  });
}

function validateRichClosedCauseConsequencePairs(input: unknown): Array<{
  causeId: string;
  consequenceId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException(
      'Rich closed cause/consequence pairs are required',
    );
  }

  return input.map((pair) => {
    if (typeof pair !== 'object' || pair === null || Array.isArray(pair)) {
      throw new BadRequestException(
        'Rich closed cause/consequence pair is invalid',
      );
    }

    const record = pair as Record<string, unknown>;

    return {
      causeId: validateRequiredId(record.causeId, 'Cause id'),
      consequenceId: validateRequiredId(record.consequenceId, 'Consequence id'),
    };
  });
}

function validateRichClosedInstitutionMatrixValues(input: unknown): Array<{
  cellId: string;
  optionId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException(
      'Rich closed institution matrix values are required',
    );
  }

  return input.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Rich closed institution matrix value is invalid',
      );
    }

    const record = value as Record<string, unknown>;

    return {
      cellId: validateRequiredId(record.cellId, 'Cell id'),
      optionId: validateRequiredId(record.optionId, 'Option id'),
    };
  });
}

function validateRichClosedDiagramLabelingValues(input: unknown): Array<{
  slotId: string;
  optionId: string;
}> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException(
      'Rich closed diagram labeling values are required',
    );
  }

  return input.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Rich closed diagram labeling value is invalid',
      );
    }

    const record = value as Record<string, unknown>;

    return {
      slotId: validateRequiredId(record.slotId, 'Slot id'),
      optionId: validateRequiredId(record.optionId, 'Option id'),
    };
  });
}

function validateRichClosedYear(input: unknown): number {
  if (!Number.isInteger(input)) {
    throw new BadRequestException('Rich closed year must be an integer');
  }

  return input as number;
}

function containsForbiddenRichClosedSubmitField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenRichClosedSubmitField);
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.entries(value).some(([key, nested]) => {
    if (
      key.startsWith('correct') ||
      key === 'correction' ||
      key === 'correctionPayload' ||
      key === 'explanation' ||
      key === 'feedback' ||
      key === 'choiceFeedback' ||
      key === 'modelAnswer' ||
      key === 'answerText' ||
      key === 'freeTextAnswer' ||
      key === 'textAnswer' ||
      key === 'score' ||
      key === 'partialScore' ||
      key === 'expectedValue' ||
      key === 'workedSteps' ||
      key === 'answersPayload' ||
      key === 'expectedAnswer' ||
      key === 'expectedAnswers' ||
      key === 'semanticLabel' ||
      key === 'answerHint' ||
      isForbiddenRichClosedRenderKey(key)
    ) {
      return true;
    }

    return containsForbiddenRichClosedSubmitField(nested);
  });
}

function isForbiddenRichClosedRenderKey(key: string): boolean {
  return [
    'html',
    'svg',
    'rawSvg',
    'mermaid',
    'markdown',
    'widget',
    'component',
    'renderPayload',
    'style',
    'css',
    'script',
    'formula',
    'expression',
    'rawFormula',
    'calculationCode',
    'javascript',
    'python',
    'imageUrl',
    'assetUrl',
    'url',
    'remoteUrl',
    'src',
    'href',
    'storagePath',
    'bucketPath',
    'cdnUrl',
    'base64',
    'dataUri',
    'blob',
    'rawImage',
    'assetPath',
    'canvas',
    'code',
    'markup',
  ].includes(key);
}

function isRichClosedQuestionKind(
  value: unknown,
): value is RichClosedQuestionKind {
  return (
    typeof value === 'string' &&
    RICH_CLOSED_QUESTION_KINDS.includes(value as RichClosedQuestionKind)
  );
}

function questionCountBadRequest(): BadRequestException {
  return new BadRequestException(
    `Diagnostic quiz question count must be an integer between 1 and ${resolveDiagnosticQuizMaxQuestionCount()}`,
  );
}

function normalizeActivityError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === 'Activity session not found') {
      throw new NotFoundException(error.message);
    }

    if (error.message === RICH_CLOSED_SESSION_NOT_FOUND) {
      throw new NotFoundException(error.message);
    }

    if (error.message === 'Activity session already completed') {
      throw new ConflictException(error.message);
    }

    if (error.message === 'Activity session already submitted') {
      throw new ConflictException(error.message);
    }

    if (
      error.message === RICH_CLOSED_SESSION_ALREADY_COMPLETED ||
      error.message === RICH_CLOSED_SESSION_NOT_COMPLETED
    ) {
      throw new ConflictException(error.message);
    }

    if (
      error.message === 'Knowledge unit does not belong to student subject' ||
      error.message === 'No knowledge unit available for subject' ||
      error.message === 'Activity session is not an open question' ||
      error.message === 'Open answer is too short' ||
      error.message === 'Open answer is too long' ||
      error.message === 'Duplicate answers are not allowed' ||
      error.message === 'Missing answers are not allowed' ||
      error.message === 'Question does not belong to activity session' ||
      error.message === 'Choice does not belong to question' ||
      error.message === 'Answer shape does not match question selection mode' ||
      error.message === 'Selection count is invalid for question' ||
      error.message === RICH_CLOSED_START_INVALID_INPUT ||
      error.message === RICH_CLOSED_SUBMIT_INVALID_INPUT
    ) {
      throw new BadRequestException(error.message);
    }

    if (
      error.message === 'Generated diagnostic quiz is invalid' ||
      error.message === 'Question source chunk not found' ||
      error.message === 'Question visual source chunk not found' ||
      error.message === 'Open question source chunk not found' ||
      error.message === 'OPEN_QUESTION_SOURCE_INVALID' ||
      error.message === 'OPEN_QUESTION_GENERATION_INVALID' ||
      error.message === 'OPEN_QUESTION_EMPTY_OUTPUT' ||
      error.message === 'OPEN_ANSWER_EVALUATION_SOURCE_INVALID' ||
      error.message === 'OPEN_ANSWER_EVALUATION_INVALID' ||
      error.message === 'OPEN_ANSWER_EVALUATION_EMPTY_OUTPUT' ||
      error.message === 'OPEN_ANSWER_EVALUATION_FAILED' ||
      error.message === RICH_CLOSED_SOURCE_CONTEXT_EMPTY ||
      error.message === RICH_CLOSED_GENERATION_FAILED ||
      error.message === RICH_CLOSED_GENERATION_SCHEMA_INVALID ||
      error.message === RICH_CLOSED_GENERATION_CONTRACT_INVALID ||
      error.message === RICH_CLOSED_GENERATION_QUALITY_REJECTED ||
      error.message === RICH_CLOSED_GENERATION_SOURCE_INVALID
    ) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}

~~~~

### src/modules/demo-seed/demo-seed.fixtures.ts

~~~~ts
import { richClosedExerciseFixture } from '../activities/application/rich-closed-questions/rich-closed-question.fixtures';
import type {
  RichClosedExercise,
  RichClosedQuestion,
} from '../activities/application/rich-closed-questions/rich-closed-question.types';

type DemoSeedEnv = {
  NODE_ENV?: string;
  DEMO_SEED_CONFIRM?: string;
  DEMO_FIREBASE_UID?: string;
  DEMO_STUDENT_FIREBASE_UID?: string;
  DEMO_STUDENT_EMAIL?: string;
  DEMO_STUDENT_DISPLAY_NAME?: string;
  DEMO_SEED_DRY_RUN?: string;
};

export type DemoSeedRuntimeOptions = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  dryRun: boolean;
};

export type DemoSeedSubjectFixture = {
  id: string;
  studentId: string;
  name: string;
  priority: number;
};

export type DemoSeedDocumentFixture = {
  id: string;
  studentId: string;
  subjectId: string;
  kind: 'COURSE_PDF';
  fileName: string;
  storagePath: string;
  mimeType: 'application/pdf';
  status: 'READY';
};

export type DemoSeedChunkFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  pageNumber: number;
};

export type DemoSeedKnowledgeUnitFixture = {
  id: string;
  subjectId: string;
  documentId: string;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder: number;
  confidence: number;
  extractionPromptVersion: string;
  extractionSchemaVersion: string;
};

export type DemoSeedKnowledgeUnitSourceFixture = {
  knowledgeUnitId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRevisionGoalFixture = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
};

export type DemoSeedMasteryStateFixture = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
};

export type DemoSeedSummaryFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  studentId: string;
  status: 'READY';
  title: string;
  content: string;
  keyPoints: string[];
  limits: string;
  generatedAt: Date;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  sourceStrategy: 'DOCUMENT_CHUNKS';
  errorCode: null;
};

export type DemoSeedSummarySourceFixture = {
  summaryId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRevisionSheetFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  studentId: string;
  status: 'READY';
  title: string;
  introduction: string;
  keyPoints: string[];
  commonMistakes: string[];
  mustKnow: string[];
  practiceSuggestions: string[];
  generatedAt: Date;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  sourceStrategy: 'DOCUMENT_CHUNKS';
  errorCode: null;
};

export type DemoSeedRevisionSheetSectionFixture = {
  id: string;
  revisionSheetId: string;
  subjectId: string;
  displayOrder: number;
  title: string;
  content: string;
};

export type DemoSeedRevisionSheetSectionSourceFixture = {
  sectionId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRichClosedActivitySessionFixture = {
  id: string;
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId: string;
  version: number;
  type: 'RICH_CLOSED_EXERCISE';
  status: 'STARTED';
  generationFlowName: string;
  generationProvider: string;
  generationModel: string;
  generationPromptVersion: string;
  generationSchemaVersion: string;
  generationInputSize: number;
};

export type DemoSeedRichClosedExercisePayloadFixture = {
  id: string;
  activitySessionId: string;
  version: string;
  title: string;
  subjectId: string;
  documentId: string;
  knowledgeUnitId: string;
  exercisePayload: RichClosedExercise;
  generationMetadata: {
    flowName: string;
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    inputSize: number;
  };
  qualityMetrics: {
    accepted: true;
    questionKinds: string[];
    sourceChunkIds: string[];
  };
};

export type DemoSeedFixtures = {
  subject: DemoSeedSubjectFixture;
  document: DemoSeedDocumentFixture;
  chunks: DemoSeedChunkFixture[];
  knowledgeUnits: DemoSeedKnowledgeUnitFixture[];
  knowledgeUnitSources: DemoSeedKnowledgeUnitSourceFixture[];
  goal: DemoSeedRevisionGoalFixture;
  masteryStates: DemoSeedMasteryStateFixture[];
  summary: DemoSeedSummaryFixture;
  summarySources: DemoSeedSummarySourceFixture[];
  revisionSheet: DemoSeedRevisionSheetFixture;
  revisionSheetSections: DemoSeedRevisionSheetSectionFixture[];
  revisionSheetSectionSources: DemoSeedRevisionSheetSectionSourceFixture[];
  richClosedActivitySession: DemoSeedRichClosedActivitySessionFixture;
  richClosedExercisePayload: DemoSeedRichClosedExercisePayloadFixture;
};

export const demoSeedIds = {
  subjectId: 'demo-subject-droit-constitutionnel',
  documentId: 'demo-document-constitution-veme',
  goalId: 'demo-revision-goal-constitution',
  summaryId: 'demo-summary-constitution',
  revisionSheetId: 'demo-sheet-constitution',
  richClosedActivitySessionId: 'demo-rich-closed-session-regime-parlementaire',
  richClosedExercisePayloadId: 'demo-rich-closed-payload-regime-parlementaire',
  richClosedExerciseId: 'demo-rich-closed-exercise-regime-parlementaire-v1a',
  chunkIds: [
    'demo-chunk-constitution-001',
    'demo-chunk-constitution-002',
    'demo-chunk-constitution-003',
    'demo-chunk-constitution-004',
    'demo-chunk-constitution-005',
    'demo-chunk-constitution-006',
  ],
  knowledgeUnitIds: {
    separationPowers: 'demo-ku-separation-pouvoirs',
    constitutionalReview: 'demo-ku-controle-constitutionnalite',
    rationalizedParliamentary: 'demo-ku-regime-parlementaire',
    governmentResponsibility: 'demo-ku-responsabilite-gouvernement',
    nationalSovereignty: 'demo-ku-souverainete-nationale',
    presidentialPowers: 'demo-ku-pouvoirs-president',
  },
};

const demoSeedVersion = 'demo-seed-v1';

export function buildDemoSeedRuntimeOptions(input: {
  env: DemoSeedEnv;
  argv: string[];
}): DemoSeedRuntimeOptions {
  if (input.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is not allowed with NODE_ENV=production');
  }

  if (input.env.DEMO_SEED_CONFIRM !== 'revision-demo') {
    throw new Error('DEMO_SEED_CONFIRM=revision-demo is required');
  }

  const firebaseUid = (
    input.env.DEMO_FIREBASE_UID ??
    input.env.DEMO_STUDENT_FIREBASE_UID ??
    ''
  ).trim();

  if (!firebaseUid) {
    throw new Error(
      'DEMO_FIREBASE_UID or DEMO_STUDENT_FIREBASE_UID is required',
    );
  }

  return {
    firebaseUid,
    email: trimOptional(input.env.DEMO_STUDENT_EMAIL),
    displayName: trimOptional(input.env.DEMO_STUDENT_DISPLAY_NAME),
    dryRun:
      input.argv.includes('--dry-run') || input.env.DEMO_SEED_DRY_RUN === '1',
  };
}

export function buildDemoSeedFixtures(input: {
  studentId: string;
  now: Date;
}): DemoSeedFixtures {
  const chunks = buildChunks();
  const knowledgeUnits = buildKnowledgeUnits();
  const generatedAt = new Date(input.now);

  return {
    subject: {
      id: demoSeedIds.subjectId,
      studentId: input.studentId,
      name: 'Droit constitutionnel — Ve République',
      priority: 5,
    },
    document: {
      id: demoSeedIds.documentId,
      studentId: input.studentId,
      subjectId: demoSeedIds.subjectId,
      kind: 'COURSE_PDF',
      fileName: 'demo-droit-constitutionnel-veme-republique.pdf',
      storagePath: 'demo://droit-constitutionnel-veme-republique',
      mimeType: 'application/pdf',
      status: 'READY',
    },
    chunks,
    knowledgeUnits,
    knowledgeUnitSources: buildKnowledgeUnitSources(),
    goal: {
      id: demoSeedIds.goalId,
      studentId: input.studentId,
      targetDate: daysAfter(input.now, 30),
      weeklyMinutes: 240,
    },
    masteryStates: buildMasteryStates(input.studentId, input.now),
    summary: buildSummary(input.studentId, generatedAt),
    summarySources: [
      summarySource(0, 0.92),
      summarySource(1, 0.88),
      summarySource(2, 0.86),
      summarySource(3, 0.82),
    ],
    revisionSheet: buildRevisionSheet(input.studentId, generatedAt),
    revisionSheetSections: buildRevisionSheetSections(),
    revisionSheetSectionSources: buildRevisionSheetSectionSources(),
    richClosedActivitySession: buildRichClosedActivitySession(input.studentId),
    richClosedExercisePayload: buildRichClosedExercisePayload(),
  };
}

export function buildDemoSeedPlan(fixtures: DemoSeedFixtures) {
  return {
    fixtures,
    deletePlan: {
      revisionSheetSectionIds: fixtures.revisionSheetSections.map(
        (section) => section.id,
      ),
      revisionSheetIds: [fixtures.revisionSheet.id],
      summaryIds: [fixtures.summary.id],
      richClosedExercisePayloadIds: [fixtures.richClosedExercisePayload.id],
      richClosedActivitySessionIds: [fixtures.richClosedActivitySession.id],
      revisionGoalIds: [fixtures.goal.id],
      knowledgeUnitIds: fixtures.knowledgeUnits.map((unit) => unit.id),
      chunkIds: fixtures.chunks.map((chunk) => chunk.id),
      documentIds: [fixtures.document.id],
      subjectIds: [fixtures.subject.id],
    },
  };
}

export function maskDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid-database-url>';
  }
}

function trimOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function buildChunks(): DemoSeedChunkFixture[] {
  const texts = [
    'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle. Dans la Ve République, cette séparation est organisée mais reste souple afin de permettre la coopération entre institutions.',
    'Le gouvernement est politiquement responsable devant l’Assemblée nationale. La motion de censure et la question de confiance encadrent cette responsabilité et structurent les rapports entre exécutif et Parlement.',
    'Le Conseil constitutionnel contrôle la conformité des lois à la Constitution. Ce contrôle protège la hiérarchie des normes et limite les atteintes aux droits et libertés constitutionnellement garantis.',
    'La rationalisation du parlementarisme encadre la procédure législative et les moyens de contrôle du Parlement. Elle vise à stabiliser l’action gouvernementale tout en maintenant une responsabilité politique.',
    'La souveraineté nationale s’exprime par le suffrage et par la représentation. Le peuple délègue l’exercice du pouvoir à des représentants, tout en conservant une place centrale dans la légitimité des institutions.',
    'Le Président de la République dispose de pouvoirs propres et de pouvoirs partagés. Son rôle varie selon la majorité parlementaire et l’équilibre politique entre le chef de l’État, le gouvernement et le Parlement.',
  ];

  let cursor = 0;

  return texts.map((text, index) => {
    const charStart = cursor;
    const charEnd = cursor + text.length;
    cursor = charEnd + 1;

    return {
      id: demoSeedIds.chunkIds[index],
      documentId: demoSeedIds.documentId,
      subjectId: demoSeedIds.subjectId,
      index,
      text,
      charStart,
      charEnd,
      pageNumber: index + 1,
    };
  });
}

function buildKnowledgeUnits(): DemoSeedKnowledgeUnitFixture[] {
  return [
    unit({
      id: demoSeedIds.knowledgeUnitIds.separationPowers,
      title: 'Séparation des pouvoirs',
      summary:
        'Principe d’organisation qui distingue les fonctions de l’État tout en permettant leur collaboration.',
      difficulty: 'LOW',
      displayOrder: 0,
      confidence: 0.96,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.constitutionalReview,
      title: 'Contrôle de constitutionnalité',
      summary:
        'Contrôle exercé pour vérifier qu’une loi respecte la Constitution et les droits protégés.',
      difficulty: 'MEDIUM',
      displayOrder: 1,
      confidence: 0.93,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
      title: 'Régime parlementaire rationalisé',
      summary:
        'Ensemble de mécanismes qui stabilisent le gouvernement et organisent les rapports avec le Parlement.',
      difficulty: 'HIGH',
      displayOrder: 2,
      confidence: 0.91,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.governmentResponsibility,
      title: 'Responsabilité politique du gouvernement',
      summary:
        'Principe selon lequel le gouvernement peut être renversé par l’Assemblée nationale selon des procédures encadrées.',
      difficulty: 'MEDIUM',
      displayOrder: 3,
      confidence: 0.9,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.nationalSovereignty,
      title: 'Souveraineté nationale',
      summary:
        'Fondement de la légitimité démocratique exercée par le suffrage et la représentation.',
      difficulty: 'LOW',
      displayOrder: 4,
      confidence: 0.94,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.presidentialPowers,
      title: 'Pouvoirs du Président',
      summary:
        'Compétences propres et partagées du Président, variables selon le contexte majoritaire.',
      difficulty: 'MEDIUM',
      displayOrder: 5,
      confidence: 0.92,
    }),
  ];
}

function unit(input: {
  id: string;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder: number;
  confidence: number;
}): DemoSeedKnowledgeUnitFixture {
  return {
    id: input.id,
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    title: input.title,
    summary: input.summary,
    difficulty: input.difficulty,
    displayOrder: input.displayOrder,
    confidence: input.confidence,
    extractionPromptVersion: demoSeedVersion,
    extractionSchemaVersion: demoSeedVersion,
  };
}

function buildKnowledgeUnitSources(): DemoSeedKnowledgeUnitSourceFixture[] {
  return [
    source(demoSeedIds.knowledgeUnitIds.separationPowers, 0, 0.95),
    source(demoSeedIds.knowledgeUnitIds.governmentResponsibility, 1, 0.94),
    source(demoSeedIds.knowledgeUnitIds.constitutionalReview, 2, 0.96),
    source(demoSeedIds.knowledgeUnitIds.rationalizedParliamentary, 3, 0.93),
    source(demoSeedIds.knowledgeUnitIds.nationalSovereignty, 4, 0.94),
    source(demoSeedIds.knowledgeUnitIds.presidentialPowers, 5, 0.92),
    source(demoSeedIds.knowledgeUnitIds.rationalizedParliamentary, 1, 0.81),
  ];
}

function source(
  knowledgeUnitId: string,
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedKnowledgeUnitSourceFixture {
  return {
    knowledgeUnitId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildMasteryStates(
  studentId: string,
  now: Date,
): DemoSeedMasteryStateFixture[] {
  return [
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.separationPowers,
      0.2,
      daysBefore(now, 16),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.constitutionalReview,
      0.55,
      daysBefore(now, 8),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
      0.75,
      daysBefore(now, 2),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.governmentResponsibility,
      0.35,
      null,
    ),
  ];
}

function mastery(
  studentId: string,
  knowledgeUnitId: string,
  score: number,
  lastPracticedAt: Date | null,
): DemoSeedMasteryStateFixture {
  return {
    studentId,
    subjectId: demoSeedIds.subjectId,
    knowledgeUnitId,
    score,
    lastPracticedAt,
  };
}

function buildSummary(
  studentId: string,
  generatedAt: Date,
): DemoSeedSummaryFixture {
  return {
    id: demoSeedIds.summaryId,
    documentId: demoSeedIds.documentId,
    subjectId: demoSeedIds.subjectId,
    studentId,
    status: 'READY',
    title: 'Synthèse demo — Ve République',
    content:
      'La Ve République combine un exécutif fort, un Parlement encadré et des mécanismes de contrôle constitutionnel. La séparation des pouvoirs reste centrale, mais elle s’exprime dans un régime parlementaire rationalisé.',
    keyPoints: [
      'Séparation des pouvoirs organisée et souple.',
      'Responsabilité politique du gouvernement devant l’Assemblée nationale.',
      'Contrôle de constitutionnalité comme garantie normative.',
      'Président renforcé selon le contexte majoritaire.',
    ],
    limits:
      'Fixture synthétique de démonstration, sans appel IA et sans document PDF réel.',
    generatedAt,
    flowName: 'demoSeedSummary',
    provider: 'demo-seed',
    model: 'demo-fixture',
    promptVersion: demoSeedVersion,
    schemaVersion: demoSeedVersion,
    inputSize: 0,
    sourceStrategy: 'DOCUMENT_CHUNKS',
    errorCode: null,
  };
}

function summarySource(
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedSummarySourceFixture {
  return {
    summaryId: demoSeedIds.summaryId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildRevisionSheet(
  studentId: string,
  generatedAt: Date,
): DemoSeedRevisionSheetFixture {
  return {
    id: demoSeedIds.revisionSheetId,
    documentId: demoSeedIds.documentId,
    subjectId: demoSeedIds.subjectId,
    studentId,
    status: 'READY',
    title: 'Fiche demo — Droit constitutionnel',
    introduction:
      'Cette fiche de démonstration résume les notions clés pour tester les parcours de révision sans IA.',
    keyPoints: [
      'Identifier les fonctions de l’État.',
      'Relier responsabilité gouvernementale et parlementarisme.',
      'Comprendre le rôle du Conseil constitutionnel.',
    ],
    commonMistakes: [
      'Confondre séparation stricte et séparation souple des pouvoirs.',
      'Oublier que le gouvernement reste responsable devant l’Assemblée nationale.',
    ],
    mustKnow: [
      'Motion de censure.',
      'Contrôle de constitutionnalité.',
      'Rationalisation du parlementarisme.',
    ],
    practiceSuggestions: [
      'Faire un QCM ciblé sur les pouvoirs.',
      'Répondre à une question ouverte sur la responsabilité politique.',
    ],
    generatedAt,
    flowName: 'demoSeedRevisionSheet',
    provider: 'demo-seed',
    model: 'demo-fixture',
    promptVersion: demoSeedVersion,
    schemaVersion: demoSeedVersion,
    inputSize: 0,
    sourceStrategy: 'DOCUMENT_CHUNKS',
    errorCode: null,
  };
}

function buildRevisionSheetSections(): DemoSeedRevisionSheetSectionFixture[] {
  return [
    {
      id: 'demo-sheet-section-constitution-001',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 0,
      title: 'Institutions et séparation des pouvoirs',
      content:
        'La Ve République distingue les fonctions institutionnelles tout en prévoyant des interactions constantes entre exécutif, Parlement et juge constitutionnel.',
    },
    {
      id: 'demo-sheet-section-constitution-002',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 1,
      title: 'Parlementarisme rationalisé',
      content:
        'Les mécanismes de responsabilité et de procédure cherchent à éviter l’instabilité gouvernementale tout en conservant un contrôle parlementaire.',
    },
    {
      id: 'demo-sheet-section-constitution-003',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 2,
      title: 'Contrôle constitutionnel',
      content:
        'Le Conseil constitutionnel garantit la conformité des lois aux normes constitutionnelles et protège les libertés fondamentales.',
    },
  ];
}

function buildRevisionSheetSectionSources(): DemoSeedRevisionSheetSectionSourceFixture[] {
  return [
    sectionSource('demo-sheet-section-constitution-001', 0, 0.94),
    sectionSource('demo-sheet-section-constitution-002', 3, 0.92),
    sectionSource('demo-sheet-section-constitution-003', 2, 0.93),
  ];
}

function sectionSource(
  sectionId: string,
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedRevisionSheetSectionSourceFixture {
  return {
    sectionId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildRichClosedActivitySession(
  studentId: string,
): DemoSeedRichClosedActivitySessionFixture {
  return {
    id: demoSeedIds.richClosedActivitySessionId,
    studentId,
    subjectId: demoSeedIds.subjectId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    documentId: demoSeedIds.documentId,
    version: 1,
    type: 'RICH_CLOSED_EXERCISE',
    status: 'STARTED',
    generationFlowName: 'demoSeedRichClosedExercise',
    generationProvider: 'demo-seed',
    generationModel: 'demo-fixture',
    generationPromptVersion: demoSeedVersion,
    generationSchemaVersion: demoSeedVersion,
    generationInputSize: 0,
  };
}

function buildRichClosedExercisePayload(): DemoSeedRichClosedExercisePayloadFixture {
  const exercise = buildRichClosedExercise();
  const sourceChunkIds = Array.from(
    new Set(exercise.questions.flatMap((question) => question.sourceChunkIds)),
  );

  return {
    id: demoSeedIds.richClosedExercisePayloadId,
    activitySessionId: demoSeedIds.richClosedActivitySessionId,
    version: exercise.version,
    title: exercise.title,
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    exercisePayload: exercise,
    generationMetadata: {
      flowName: 'demoSeedRichClosedExercise',
      provider: 'demo-seed',
      model: 'demo-fixture',
      promptVersion: demoSeedVersion,
      schemaVersion: demoSeedVersion,
      inputSize: 0,
    },
    qualityMetrics: {
      accepted: true,
      questionKinds: exercise.questions.map(
        (question) => question.questionKind,
      ),
      sourceChunkIds,
    },
  };
}

function buildRichClosedExercise(): RichClosedExercise {
  const exercise = richClosedExerciseFixture();

  return {
    ...exercise,
    id: demoSeedIds.richClosedExerciseId,
    title: 'Régime parlementaire rationalisé — exercice fermé riche V1-A',
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    questions: exercise.questions.map((question) =>
      withDemoSources(question, demoSourcesForQuestion(question.questionKind)),
    ),
  };
}

function demoSourcesForQuestion(
  questionKind: RichClosedQuestion['questionKind'],
): string[] {
  switch (questionKind) {
    case 'single_choice':
    case 'multiple_choice':
    case 'case_qualification':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'matching':
    case 'ordering':
      return [demoSeedIds.chunkIds[3]];
    case 'error_detection':
      return [demoSeedIds.chunkIds[1]];
    case 'timeline':
      return [demoSeedIds.chunkIds[3]];
    case 'date_slider':
      return [demoSeedIds.chunkIds[1]];
    case 'true_false_grid':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'cause_consequence':
      return [demoSeedIds.chunkIds[3]];
    case 'institution_matrix':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'diagram_labeling':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'calculation_mcq':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'image_choice':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
  }
}

function withDemoSources(
  question: RichClosedQuestion,
  sourceChunkIds: string[],
): RichClosedQuestion {
  return {
    ...question,
    sourceChunkIds,
  };
}

~~~~

### test/critical-paths.e2e-spec.ts

~~~~ts
import { INestApplication, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER } from '../src/modules/auth/application/token-verifier';
import { FirebaseAuthGuard } from '../src/modules/auth/interfaces/firebase-auth.guard';
import { StartNextActivityUseCase } from '../src/modules/activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../src/modules/activities/application/start-open-question-activity.use-case';
import { SubmitActivityResultUseCase } from '../src/modules/activities/application/submit-activity-result.use-case';
import { SubmitOpenAnswerUseCase } from '../src/modules/activities/application/submit-open-answer.use-case';
import {
  richClosedExerciseFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures';
import { GetRichClosedExerciseResultUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise.use-case';
import { toRichClosedPublicExerciseEnvelope } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper';
import { scoreRichClosedExerciseSubmission } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedQuestionKind,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.types';
import { StartRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case';
import { GetDocumentUseCase } from '../src/modules/documents/application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../src/modules/documents/application/list-document-knowledge-units.use-case';
import { GetTodayPlanUseCase } from '../src/modules/revision/application/get-today-plan.use-case';
import { GetRevisionSessionUseCase } from '../src/modules/revision-sessions/application/get-revision-session.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../src/modules/revision-sessions/application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../src/modules/revision-sessions/application/start-revision-session.use-case';
import { GenerateDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../src/modules/study-artifacts/application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../src/modules/study-artifacts/application/get-revision-sheet.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

type CriticalPathMocks = ReturnType<typeof createCriticalPathMocks>;
type KnowledgeUnitsResponse = ReturnType<typeof documentKnowledgeUnits>;
type SummaryResponse = ReturnType<typeof documentSummary>;
type RevisionSheetResponse = ReturnType<typeof revisionSheet>;
type TodayPlanResponse = ReturnType<typeof todayPlan>;
type ActivityResponse = ReturnType<typeof diagnosticQuizActivity>;
type OpenQuestionResponse = ReturnType<typeof openQuestionActivity>;

const currentStudent = {
  id: 'student-demo-test',
  firebaseUid: 'firebase-demo-test-uid',
  email: 'demo-revision@example.test',
  displayName: 'Demo Revision',
};

describe('Critical demo paths (e2e)', () => {
  describe('protected routes', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createAppWithRealAuthGuard();
    });

    afterEach(async () => {
      await app?.close();
    });

    it('rejects critical demo routes without a bearer token', async () => {
      // This suite keeps the real FirebaseAuthGuard behavior for missing-token
      // checks, but the verifier itself is mocked so no Firebase network call
      // can happen even if a future test adds a token.
      const server = app.getHttpServer();

      await request(server).get('/today').expect(401);
      await request(server).get('/documents/document-1').expect(401);
      await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(401);
      await request(server)
        .post('/activities/next')
        .send({ subjectId: 'subject-1' })
        .expect(401);
      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/activities/rich-closed/start')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1' })
        .expect(401);
    });
  });

  describe('authenticated contracts', () => {
    let app: INestApplication<App>;
    let mocks: CriticalPathMocks;

    beforeEach(async () => {
      mocks = createCriticalPathMocks();
      app = await createAuthenticatedApp(mocks);
    });

    afterEach(async () => {
      await app?.close();
    });

    it('routes document and knowledge-unit reads with ownership context and no storage path leak', async () => {
      const server = app.getHttpServer();

      const documentResponse = await request(server)
        .get('/documents/document-1')
        .expect(200);

      expect(mocks.getDocument.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(documentResponse.body).toMatchObject({
        id: 'document-1',
        subjectId: 'subject-1',
        status: 'READY',
      });
      assertNoSensitivePreSubmitFields(documentResponse.body);

      const knowledgeUnitsResponse = await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(200);
      const knowledgeUnitsBody =
        knowledgeUnitsResponse.body as KnowledgeUnitsResponse;

      expect(mocks.listDocumentKnowledgeUnits.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(knowledgeUnitsBody.items[0].sources[0]).toMatchObject({
        chunkId: 'chunk-1',
        pageNumber: 1,
        index: 0,
      });
      assertNoSensitivePreSubmitFields(knowledgeUnitsResponse.body);
    });

    it('maps missing documents to a clean 404 response', async () => {
      mocks.getDocument.execute.mockRejectedValueOnce(
        new NotFoundException('Document not found'),
      );

      await request(app.getHttpServer())
        .get('/documents/missing-document')
        .expect(404);
    });

    it('serves ready summary and revision sheet without internal metadata', async () => {
      const server = app.getHttpServer();

      const summaryResponse = await request(server)
        .get('/documents/document-1/summary')
        .expect(200);
      const summaryBody = summaryResponse.body as SummaryResponse;

      expect(mocks.getDocumentSummary.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(summaryBody.title).toBe('Synthèse de démonstration');
      assertNoSensitivePreSubmitFields(summaryResponse.body);
      expect(JSON.stringify(summaryResponse.body)).not.toContain('provider');
      expect(JSON.stringify(summaryResponse.body)).not.toContain(
        'promptVersion',
      );

      const sheetResponse = await request(server)
        .get('/documents/document-1/revision-sheet')
        .expect(200);
      const sheetBody = sheetResponse.body as RevisionSheetResponse;

      expect(mocks.getRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(sheetBody.sections).toHaveLength(1);
      assertNoSensitivePreSubmitFields(sheetResponse.body);
      expect(JSON.stringify(sheetResponse.body)).not.toContain('provider');
      expect(JSON.stringify(sheetResponse.body)).not.toContain('promptVersion');
    });

    it('returns a deterministic multi-action TodayPlan for the current student', async () => {
      const response = await request(app.getHttpServer())
        .get('/today')
        .expect(200);
      const todayBody = response.body as TodayPlanResponse;

      expect(mocks.getTodayPlan.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
      });
      expect(todayBody.items.map((item) => item.action)).toEqual([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]);
      const richClosedItem = todayBody.items.find(
        (item) => item.action === 'rich_closed_exercise',
      );
      expect(richClosedItem).toMatchObject({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      });
      expect(richClosedItem).not.toHaveProperty('questions');
      expect(richClosedItem).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(response.body);
      expect(JSON.stringify(response.body)).not.toContain('other-student');
    });

    it('starts a QCM with bounded v3 options and no correction leak', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          visualsEnabled: true,
          visualTypes: ['CHART', 'DIAGRAM'],
          selectionModes: ['single', 'multiple'],
        })
        .expect(201);
      const responseBody = response.body as ActivityResponse;

      expect(mocks.startNextActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        visualsEnabled: true,
        visualTypes: ['CHART', 'DIAGRAM'],
        selectionModes: ['single', 'multiple'],
      });
      expect(responseBody.type).toBe('diagnostic_quiz');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('rejects invalid QCM payloads before calling the use case', async () => {
      await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          questionCount: 25,
          visualTypes: ['IMAGE'],
        })
        .expect(400);

      expect(mocks.startNextActivity.execute).not.toHaveBeenCalled();
    });

    it('submits QCM answers and maps critical submit errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({
          answers: [
            { questionId: 'question-1', choiceId: 'choice-1' },
            { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
          ],
        })
        .expect(201);

      expect(mocks.submitActivityResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'quiz-session-1',
        answers: [
          { questionId: 'question-1', choiceId: 'choice-1' },
          { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
        ],
      });

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({ answers: [{ questionId: 'question-1' }] })
        .expect(400);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(404);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session already submitted'),
      );
      await request(server)
        .post('/activities/submitted-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(409);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Generated diagnostic quiz is invalid'),
      );
      await request(server)
        .post('/activities/invalid-generation/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(422);
    });

    it('starts an open question without exposing correction fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(201);
      const responseBody = response.body as OpenQuestionResponse;

      expect(mocks.startOpenQuestionActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      });
      expect(responseBody.type).toBe('open_question');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('validates open question start and submit payloads', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1' })
        .expect(400);
      expect(mocks.startOpenQuestionActivity.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText: '   ' })
        .expect(400);
      expect(mocks.submitOpenAnswer.execute).not.toHaveBeenCalled();
    });

    it('submits an open answer and maps critical evaluation errors', async () => {
      const server = app.getHttpServer();
      const answerText =
        'La distinction entre les régimes parlementaire et présidentiel repose sur la responsabilité politique du gouvernement et sur la séparation institutionnelle des pouvoirs.';

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText })
        .expect(201);

      expect(mocks.submitOpenAnswer.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'open-session-1',
        answerText,
      });

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/open-answer')
        .send({ answerText })
        .expect(404);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session is not an open question'),
      );
      await request(server)
        .post('/activities/quiz-session/open-answer')
        .send({ answerText })
        .expect(400);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('OPEN_ANSWER_EVALUATION_INVALID'),
      );
      await request(server)
        .post('/activities/open-session-invalid/open-answer')
        .send({ answerText })
        .expect(422);
    });

    it('routes rich closed start, get, submit and result without pre-submit leaks', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(201);

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 6,
        complexityProfile: 'exam',
        questionTypeMix: undefined,
      });
      const startBody = startResponse.body as ReturnType<
        typeof richClosedPublicExercise
      >;
      expect(startBody.type).toBe('rich_closed_exercise');
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
      ]);
      expect(
        startBody.questions.every(
          (question: { sourceChunkIds?: unknown[] }) =>
            Array.isArray(question.sourceChunkIds) &&
            question.sourceChunkIds.length > 0,
        ),
      ).toBe(true);
      assertNoSensitivePreSubmitFields(startBody);

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1')
        .expect(200);
      expect(mocks.getRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      assertNoSensitivePreSubmitFields(getResponse.body);

      mocks.getRichClosedExerciseResult.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_COMPLETED'),
      );
      await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(409);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
        answers: richClosedAnswers(),
      });
      const submitBody = submitResponse.body as {
        items: Array<Record<string, unknown>>;
      };
      expect(submitBody).toMatchObject({
        correctAnswers: 6,
        totalQuestions: 6,
        score: 1,
      });
      expect(submitBody.items).toHaveLength(6);
      expect(submitBody.items[0]).toHaveProperty('correction');
      expect(JSON.stringify(submitBody)).toContain('explanation');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(200);
      expect(mocks.getRichClosedExerciseResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 6,
        totalQuestions: 6,
      });
    });

    it('routes rich closed V1-B timeline and date slider without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 8,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 8,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctYear');
      expect(JSON.stringify(startBody)).not.toContain('correctOrder');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({ answers: richClosedV1BAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b',
        answers: richClosedV1BAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 8,
        totalQuestions: 8,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctYear');
      expect(JSON.stringify(submitResponse.body)).toContain('correctOrder');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 8,
        totalQuestions: 8,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({
          answers: replaceRichClosedV1BAnswer({
            questionId: 'date-slider-1',
            questionKind: 'date_slider',
            year: 1958.5,
          } as unknown as RichClosedAnswer),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-1', 'event-3'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2', 'unknown-event'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'date-slider-1',
          questionKind: 'date_slider',
          year: 1971,
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-B true/false grid and cause/consequence without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 10,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 10,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('correctPairs');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({ answers: richClosedV1BFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b-full',
        answers: richClosedV1BFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 10,
        totalQuestions: 10,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).toContain('correctPairs');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 10,
        totalQuestions: 10,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({
          answers: replaceRichClosedV1BFullAnswer({
            questionId: 'true-false-grid-1',
            questionKind: 'true_false_grid',
            values: [
              { rowId: 'row-1', value: true },
              { rowId: 'row-2', value: false },
              { rowId: 'row-3', value: 'true' },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-1', value: false },
            { rowId: 'row-3', value: true },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-2', value: false },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-1', consequenceId: 'consequence-2' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'unknown-consequence' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'consequence-2' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C institution matrix without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 11,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 11,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({ answers: richClosedV1CAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c',
        answers: richClosedV1CAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 11,
        totalQuestions: 11,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 11,
        totalQuestions: 11,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({
          answers: replaceRichClosedV1CAnswer({
            questionId: 'institution-matrix-1',
            questionKind: 'institution_matrix',
            values: [
              {
                cellId: 'cell-president-legitimacy',
                optionId: 'option-legitimacy-election',
              },
              {
                cellId: 'cell-government-responsibility',
                optionId: 42,
              },
              {
                cellId: 'cell-assembly-action',
                optionId: 'option-action-censure',
              },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-confidence',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'unknown-cell',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-action-censure',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C diagram labeling without arbitrary render payloads', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({ answers: richClosedV1CFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-full',
        answers: richClosedV1CFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 12,
        totalQuestions: 12,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).not.toContain(
        'renderPayload',
      );
      expect(JSON.stringify(submitResponse.body)).not.toContain('mermaid');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 12,
        totalQuestions: 12,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              { slotId: 'slot-censure', optionId: 42 },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              {
                slotId: 'slot-censure',
                optionId: 'option-motion-censure',
              },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
            renderPayload: { widget: 'free-form' },
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-government-role', optionId: 'option-president' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'unknown-slot', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            {
              slotId: 'slot-government-role',
              optionId: 'option-motion-censure',
            },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C calculation MCQ without formula leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
        calculation_mcq: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CCalculationResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 13,
          questionTypeMix,
        })
        .expect(201);
      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 13,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toContain('calculation_mcq');
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).toContain('scenario');
      expect(JSON.stringify(startBody)).toContain('calculation');
      expect(JSON.stringify(startBody)).toContain('value');
      expect(JSON.stringify(startBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(startBody)).not.toContain('expectedValue');
      expect(JSON.stringify(startBody)).not.toContain('workedSteps');
      expect(JSON.stringify(startBody)).not.toContain('formula');
      expect(JSON.stringify(startBody)).not.toContain('renderPayload');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-calculation')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({ answers: richClosedV1CCalculationAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-calculation',
        answers: richClosedV1CCalculationAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 13,
        totalQuestions: 13,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctChoiceId');
      expect(JSON.stringify(submitResponse.body)).toContain('expectedValue');
      expect(JSON.stringify(submitResponse.body)).toContain('workedSteps');
      expect(JSON.stringify(submitResponse.body)).not.toContain('formula');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-calculation/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 13,
        totalQuestions: 13,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 289,
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 'choice-289',
            formula: 'floor(validVotes / 2) + 1',
          }),
        })
        .expect(400);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 'unknown-choice',
          }),
        })
        .expect(400);
    });

    it('routes rich closed V1-D image choice without image asset leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
        calculation_mcq: 1,
        image_choice: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoicePublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoicePublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoiceResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1DImageChoiceResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 14,
          questionTypeMix,
        })
        .expect(201);
      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 14,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toContain('image_choice');
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).toContain(
        'image-choice-historical-figure-001-v1',
      );
      expect(JSON.stringify(startBody)).toContain('altText');
      expect(JSON.stringify(startBody)).toContain('internal_placeholder');
      expect(JSON.stringify(startBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(startBody)).not.toContain('semanticLabel');
      expect(JSON.stringify(startBody)).not.toContain('answerHint');
      expect(JSON.stringify(startBody)).not.toContain('imageUrl');
      expect(JSON.stringify(startBody)).not.toContain('base64');
      expect(JSON.stringify(startBody)).not.toContain('blob');
      expect(JSON.stringify(startBody)).not.toContain('storagePath');
      expect(JSON.stringify(startBody)).not.toContain('de-gaulle');
      expect(JSON.stringify(startBody)).not.toContain('napoleon');
      expect(JSON.stringify(startBody)).not.toContain('simone');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1d-image-choice')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);
      expect(JSON.stringify(getResponse.body)).not.toContain('de-gaulle');
      expect(JSON.stringify(getResponse.body)).not.toContain('napoleon');
      expect(JSON.stringify(getResponse.body)).not.toContain('simone');

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({ answers: richClosedV1DImageChoiceAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1d-image-choice',
        answers: richClosedV1DImageChoiceAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 14,
        totalQuestions: 14,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctChoiceId');
      expect(JSON.stringify(submitResponse.body)).not.toContain('imageUrl');
      expect(JSON.stringify(submitResponse.body)).not.toContain('base64');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1d-image-choice/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 14,
        totalQuestions: 14,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 42,
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 'choice-image-a',
            imageUrl: 'https://example.invalid/image.png',
            blob: 'blob://unsafe',
          }),
        })
        .expect(400);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 'unknown-choice',
          }),
        })
        .expect(400);
    });

    it('validates and maps rich closed errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 5,
        })
        .expect(400);
      expect(mocks.startRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
              modelAnswer: 'interdit',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            ...richClosedAnswers(),
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      const semanticInvalidSubmissions = [
        replaceRichClosedAnswer({
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'unknown-choice',
        }),
        richClosedAnswers().filter(
          (answer) => answer.questionId !== 'single-1',
        ),
        replaceRichClosedAnswer({
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-2', rightId: 'unknown-right' },
            { leftId: 'left-3', rightId: 'right-3' },
          ],
        }),
        replaceRichClosedAnswer({
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-1', 'item-2'],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-1/submit')
          .send({ answers })
          .expect(400);
      }

      mocks.getRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_FOUND'),
      );
      await request(server)
        .get('/activities/rich-closed/missing-session')
        .expect(404);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_ALREADY_COMPLETED'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(409);

      mocks.startRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_GENERATION_QUALITY_REJECTED'),
      );
      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(422);
    });

    it('routes revision sessions and next actions without free-message leakage', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'open_question',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      });
      assertNoSensitivePreSubmitFields(startResponse.body);

      await request(server)
        .get('/revision-sessions/revision-session-1')
        .expect(200);
      expect(mocks.getRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });

      await request(server)
        .post('/revision-sessions/revision-session-1/next-action')
        .send({ message: 'ignore this free text' })
        .expect(201);

      expect(mocks.requestNextAction.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });
      expect(
        JSON.stringify(mocks.requestNextAction.execute.mock.calls),
      ).not.toContain('ignore this free text');
    });

    it('routes rich closed revision sessions as bounded launchers', async () => {
      mocks.startRevisionSession.execute.mockResolvedValueOnce(
        richClosedRevisionSessionResponse(),
      );

      const response = await request(app.getHttpServer())
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'rich_closed_exercise',
      });
      const body = response.body as ReturnType<
        typeof richClosedRevisionSessionResponse
      >;

      expect(body.currentAction).toMatchObject({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
        payload: {
          type: 'rich_closed_exercise',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        },
      });
      expect(body.currentAction.payload).not.toHaveProperty('questions');
      expect(body.currentAction.payload).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(body);
    });

    it('validates and maps revision session errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'chat' })
        .expect(400);
      expect(mocks.startRevisionSession.execute).not.toHaveBeenCalled();

      mocks.startRevisionSession.execute.mockRejectedValueOnce(
        new Error('Open question revision session requires a knowledge unit'),
      );
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
        .expect(422);

      mocks.getRevisionSession.execute.mockRejectedValueOnce(
        new Error('Revision session not found'),
      );
      await request(server)
        .get('/revision-sessions/missing-session')
        .expect(404);
    });
  });
});

async function createAppWithRealAuthGuard(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

async function createAuthenticatedApp(
  mocks: CriticalPathMocks,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(FirebaseAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        // The e2e suite verifies controller contracts, not Firebase itself.
        // Injecting an explicit fake student keeps every request scoped while
        // avoiding Firebase Admin and BootstrapStudentUseCase side effects.
        const httpRequest = context
          .switchToHttp()
          .getRequest<{ student?: typeof currentStudent }>();
        httpRequest.student = currentStudent;
        return true;
      },
    })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(GetDocumentUseCase)
    .useValue(mocks.getDocument)
    .overrideProvider(ListDocumentKnowledgeUnitsUseCase)
    .useValue(mocks.listDocumentKnowledgeUnits)
    .overrideProvider(GetDocumentSummaryUseCase)
    .useValue(mocks.getDocumentSummary)
    .overrideProvider(GenerateDocumentSummaryUseCase)
    .useValue(mocks.generateDocumentSummary)
    .overrideProvider(GetRevisionSheetUseCase)
    .useValue(mocks.getRevisionSheet)
    .overrideProvider(GenerateRevisionSheetUseCase)
    .useValue(mocks.generateRevisionSheet)
    .overrideProvider(GetTodayPlanUseCase)
    .useValue(mocks.getTodayPlan)
    .overrideProvider(StartNextActivityUseCase)
    .useValue(mocks.startNextActivity)
    .overrideProvider(StartOpenQuestionActivityUseCase)
    .useValue(mocks.startOpenQuestionActivity)
    .overrideProvider(SubmitActivityResultUseCase)
    .useValue(mocks.submitActivityResult)
    .overrideProvider(SubmitOpenAnswerUseCase)
    .useValue(mocks.submitOpenAnswer)
    .overrideProvider(StartRichClosedExerciseUseCase)
    .useValue(mocks.startRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseUseCase)
    .useValue(mocks.getRichClosedExercise)
    .overrideProvider(SubmitRichClosedExerciseUseCase)
    .useValue(mocks.submitRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseResultUseCase)
    .useValue(mocks.getRichClosedExerciseResult)
    .overrideProvider(StartRevisionSessionUseCase)
    .useValue(mocks.startRevisionSession)
    .overrideProvider(GetRevisionSessionUseCase)
    .useValue(mocks.getRevisionSession)
    .overrideProvider(RequestNextRevisionSessionActionUseCase)
    .useValue(mocks.requestNextAction)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

function createCriticalPathMocks() {
  return {
    getDocument: {
      execute: jest.fn().mockResolvedValue(publicDocument()),
    },
    listDocumentKnowledgeUnits: {
      execute: jest.fn().mockResolvedValue(documentKnowledgeUnits()),
    },
    getDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    generateDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    getRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    generateRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    getTodayPlan: {
      execute: jest.fn().mockResolvedValue(todayPlan()),
    },
    startNextActivity: {
      execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
    },
    startOpenQuestionActivity: {
      execute: jest.fn().mockResolvedValue(openQuestionActivity()),
    },
    submitActivityResult: {
      execute: jest.fn().mockResolvedValue(qcmSubmissionResult()),
    },
    submitOpenAnswer: {
      execute: jest.fn().mockResolvedValue(openAnswerSubmissionResult()),
    },
    startRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    getRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    submitRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    getRichClosedExerciseResult: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    startRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    getRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    requestNextAction: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
  };
}

function publicDocument() {
  return {
    id: 'document-1',
    subjectId: 'subject-1',
    kind: 'COURSE_PDF',
    fileName: 'demo-droit-constitutionnel.pdf',
    mimeType: 'application/pdf',
    status: 'READY',
    errorCode: null,
  };
}

function documentKnowledgeUnits() {
  return {
    documentId: 'document-1',
    items: [
      {
        id: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        title: 'Séparation des pouvoirs',
        summary: 'La séparation des pouvoirs organise les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 0,
        sources: [
          {
            chunkId: 'chunk-1',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
  };
}

function documentSummary() {
  return {
    id: 'summary-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Synthèse de démonstration',
    content: 'La Ve République articule stabilité exécutive et contrôle.',
    keyPoints: ['Séparation des pouvoirs', 'Contrôle constitutionnel'],
    limits: 'Synthèse courte issue des fixtures de démonstration.',
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    storagePath: 'internal/demo.pdf',
    sources: [
      {
        chunkId: 'chunk-1',
        text: 'Extrait borné.',
        pageNumber: 1,
        index: 0,
        relevanceScore: 0.9,
      },
    ],
  };
}

function revisionSheet() {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de démonstration',
    introduction: 'Fiche courte de droit constitutionnel.',
    keyPoints: ['Pouvoir exécutif', 'Parlement'],
    commonMistakes: ['Confondre régime parlementaire et présidentiel.'],
    mustKnow: ['Responsabilité politique du gouvernement.'],
    practiceSuggestions: ['Comparer deux institutions.'],
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le régime organise les rapports entre les pouvoirs.',
        sources: [
          {
            chunkId: 'chunk-2',
            text: 'Extrait de fiche borné.',
            pageNumber: 2,
            index: 1,
            relevanceScore: 0.8,
          },
        ],
      },
    ],
  };
}

function todayPlan() {
  return {
    generatedAt: new Date('2026-06-15T12:00:00.000Z'),
    items: [
      {
        id: 'today-1',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        priority: 170,
        reasonCode: 'LOW_MASTERY',
        reason: 'À revoir en priorité.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
      },
      {
        id: 'today-2',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-2',
        knowledgeUnitTitle: 'Contrôle de constitutionnalité',
        masteryScore: null,
        action: 'open_question',
        estimatedMinutes: 18,
        priority: 140,
        reasonCode: 'MIX_ACTIVITY_TYPE',
        reason: 'Change de format pour renforcer la mémorisation.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
          preferredAction: 'open_question',
        },
      },
      {
        id: 'today-3',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'rich_closed_exercise',
        estimatedMinutes: 8,
        priority: 130,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        reason: 'Questions riches recommandées pour consolider la notion.',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      },
      {
        id: 'today-4',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'revision_session',
        estimatedMinutes: 25,
        priority: 120,
        reasonCode: 'START_REVISION_SESSION',
        reason: 'Lance une session guidée.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      },
    ],
  };
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-1',
    type: 'diagnostic_quiz',
    title: 'QCM de démonstration',
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel principe organise les pouvoirs ?',
        difficulty: 'MEDIUM',
        selectionMode: 'single',
        choices: [
          { id: 'choice-1', label: 'La séparation des pouvoirs' },
          { id: 'choice-2', label: 'La confusion des pouvoirs' },
        ],
        sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
      },
    ],
  };
}

function qcmSubmissionResult() {
  return {
    correctAnswers: 2,
    totalQuestions: 2,
    score: 1,
    knowledgeUnitId: 'unit-1',
    items: [
      {
        questionId: 'question-1',
        selectedChoiceId: 'choice-1',
        correctChoiceId: 'choice-1',
        isCorrect: true,
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la séparation des pouvoirs.',
      instructions: 'Structure ta réponse en deux paragraphes.',
      maxAnswerLength: 2500,
      sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
    },
  };
}

function openAnswerSubmissionResult() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'READY',
      score: 16,
      maxScore: 20,
      feedback: 'Réponse structurée.',
      presentPoints: ['Séparation institutionnelle'],
      missingPoints: ['Responsabilité politique'],
      errors: [],
      modelAnswer: 'La séparation des pouvoirs distingue les fonctions.',
      advice: 'Revois le régime parlementaire.',
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'Extrait post-submit borné.',
          pageNumber: 1,
          index: 0,
        },
      ],
    },
  };
}

function richClosedPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
  });
}

function richClosedV1BPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
  });
}

function richClosedV1BFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
  });
}

function richClosedV1CPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
  });
}

function richClosedV1CFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
  });
}

function richClosedV1CCalculationPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-calculation',
    exercise: richClosedV1CCalculationExerciseFixture(),
  });
}

function richClosedV1DImageChoicePublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1d-image-choice',
    exercise: richClosedV1DImageChoiceExerciseFixture(),
  });
}

function richClosedResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
    answers: richClosedAnswers(),
  });
}

function richClosedV1BResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
    answers: richClosedV1BAnswers(),
  });
}

function richClosedV1BFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
    answers: richClosedV1BFullAnswers(),
  });
}

function richClosedV1CResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
    answers: richClosedV1CAnswers(),
  });
}

function richClosedV1CFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
    answers: richClosedV1CFullAnswers(),
  });
}

function richClosedV1CCalculationResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-calculation',
    exercise: richClosedV1CCalculationExerciseFixture(),
    answers: richClosedV1CCalculationAnswers(),
  });
}

function richClosedV1DImageChoiceResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1d-image-choice',
    exercise: richClosedV1DImageChoiceExerciseFixture(),
    answers: richClosedV1DImageChoiceAnswers(),
  });
}

function richClosedAnswers(): RichClosedAnswer[] {
  return [
    {
      questionId: 'single-1',
      questionKind: 'single_choice',
      choiceId: 'choice-a',
    },
    {
      questionId: 'multiple-1',
      questionKind: 'multiple_choice',
      choiceIds: ['choice-a', 'choice-b'],
    },
    {
      questionId: 'matching-1',
      questionKind: 'matching',
      pairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    },
    {
      questionId: 'ordering-1',
      questionKind: 'ordering',
      orderedIds: ['item-1', 'item-2', 'item-3'],
    },
    {
      questionId: 'case-1',
      questionKind: 'case_qualification',
      choiceId: 'choice-a',
    },
    {
      questionId: 'error-1',
      questionKind: 'error_detection',
      errorId: 'error-a',
    },
  ];
}

function richClosedV1BAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedAnswers(),
    {
      questionId: 'timeline-1',
      questionKind: 'timeline',
      orderedEventIds: ['event-1', 'event-2', 'event-3'],
    },
    {
      questionId: 'date-slider-1',
      questionKind: 'date_slider',
      year: 1958,
    },
  ];
}

function richClosedV1BFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BAnswers(),
    {
      questionId: 'true-false-grid-1',
      questionKind: 'true_false_grid',
      values: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: true },
      ],
    },
    {
      questionId: 'cause-consequence-1',
      questionKind: 'cause_consequence',
      pairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    },
  ];
}

function richClosedV1CAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BFullAnswers(),
    {
      questionId: 'institution-matrix-1',
      questionKind: 'institution_matrix',
      values: [
        {
          cellId: 'cell-president-legitimacy',
          optionId: 'option-legitimacy-election',
        },
        {
          cellId: 'cell-government-responsibility',
          optionId: 'option-responsibility-assembly',
        },
        {
          cellId: 'cell-assembly-action',
          optionId: 'option-action-censure',
        },
      ],
    },
  ];
}

function richClosedV1CFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CAnswers(),
    {
      questionId: 'diagram-labeling-1',
      questionKind: 'diagram_labeling',
      values: [
        {
          slotId: 'slot-government-role',
          optionId: 'option-government',
        },
        {
          slotId: 'slot-censure',
          optionId: 'option-motion-censure',
        },
        {
          slotId: 'slot-nomination',
          optionId: 'option-nomination',
        },
      ],
    },
  ];
}

function richClosedV1CCalculationAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CFullAnswers(),
    {
      questionId: 'calculation-mcq-majority-1',
      questionKind: 'calculation_mcq',
      choiceId: 'choice-289',
    },
  ];
}

function richClosedV1DImageChoiceAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CCalculationAnswers(),
    {
      questionId: 'image-choice-1',
      questionKind: 'image_choice',
      choiceId: 'choice-image-a',
    },
  ];
}

function replaceRichClosedAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return richClosedAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BAnswer(
  answer: RichClosedAnswer,
): RichClosedAnswer[] {
  return richClosedV1BAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1BFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CCalculationAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CCalculationAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1DImageChoiceAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1DImageChoiceAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'OPEN_QUESTION',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'open-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: openQuestionActivity(),
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function richClosedRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-rich-1',
      kind: 'RICH_CLOSED_EXERCISE',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        reason: 'Questions riches recommandées.',
        estimatedMinutes: 8,
        preferredAction: 'rich_closed_exercise',
      },
    },
    history: [
      {
        id: 'action-rich-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function assertNoSensitivePreSubmitFields(payload: unknown): void {
  expect(collectSensitivePreSubmitFields(payload)).toEqual([]);
}

const forbiddenPreSubmitFields = new Set([
  'correction',
  'correctionPayload',
  'explanation',
  'feedback',
  'choiceFeedback',
  'modelAnswer',
  'answerText',
  'freeTextAnswer',
  'textAnswer',
  'score',
  'partialScore',
  'expectedValue',
  'workedSteps',
  'answersPayload',
  'semanticLabel',
  'answerHint',
  'storagePath',
  'promptVersion',
  'completion',
  'html',
  'svg',
  'rawSvg',
  'mermaid',
  'markdown',
  'widget',
  'component',
  'renderPayload',
  'style',
  'css',
  'script',
  'formula',
  'expression',
  'rawFormula',
  'calculationCode',
  'javascript',
  'python',
  'imageUrl',
  'assetUrl',
  'url',
  'remoteUrl',
  'src',
  'href',
  'bucketPath',
  'cdnUrl',
  'base64',
  'dataUri',
  'blob',
  'rawImage',
  'assetPath',
  'canvas',
  'code',
  'markup',
]);

function collectSensitivePreSubmitFields(
  value: unknown,
  path: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectSensitivePreSubmitFields(item, [...path, String(index)]),
    );
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = [...path, key];
    const currentViolation =
      key.startsWith('correct') || forbiddenPreSubmitFields.has(key)
        ? [nextPath.join('.')]
        : [];

    return [
      ...currentViolation,
      ...collectSensitivePreSubmitFields(nestedValue, nextPath),
    ];
  });
}

~~~~
