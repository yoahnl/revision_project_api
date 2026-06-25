# RICH-01 — Course-level QCM complet report

Date : 2026-06-25

Repo : API `yoahnl/revision_project_api`

Baseline relevee avant travaux : `bd9da8decab03416d5667d2109a69ccc0b9f00a0`

## 1. Audit initial RICH-01

Roadmap V3.1 : `RESET-01`, `QB-01` et `MODE-01` etaient `DONE`; `RICH-01` etait le prochain lot executable. Les documents V3 historiques sont conserves et non modifies.

API :

- `src/modules/activities` contenait deja le moteur QCM complet, les types de questions riches, le demarrage de session riche, la soumission, le resultat et l'historique.
- `StartRichClosedExerciseUseCase` existait mais n'etait pas exporte par `ActivitiesModule`, ce qui empechait un demarrage course-level propre depuis `CoursesModule`.
- `src/modules/courses` exposait deja le detail de cours, les sources, la readiness question bank et `findReadyQuickRevisionKnowledgeUnitsForCourse`.
- Les sources pretes et les notions pretes pouvaient etre derivees sans schema Prisma, migration, prompt IA ou provider IA.
- `src/modules/revision-sessions` n'avait pas besoin d'etre modifie pour RICH-01 : le lot devait demarrer une session riche existante et laisser result/history riches en place.

Risques identifies :

- double generation si l'App demarrait depuis des parametres source/notion au lieu du `sessionId` retourne par l'API ;
- exposition accidentelle de corrections/reponses dans le contrat options ;
- melange avec preparation examen ou deep revision ;
- activation d'un bouton course-level sans vraie action.

## 2. Architecture retenue

RICH-01 ajoute un contrat course-level dans `CoursesModule` :

- options de QCM complet par cours ;
- demarrage course-level avec scope notion ;
- reutilisation stricte du moteur QCM complet existant ;
- retour direct de l'enveloppe publique `RichClosedPublicExerciseEnvelope`.

Le moteur riche reste proprietaire de la generation, de la session, de la correction, du resultat et de l'historique. RICH-01 ne modifie pas Prisma, les prompts, les providers IA, ni les migrations.

## 3. Contrat API final

`GET /courses/:courseId/rich-revision/options`

Retourne :

- `course` : id, titre, subjectId ;
- `readiness` : `canStart`, `state`, `userMessage`, `blockers`, compte de sources pretes, compte de notions pretes ;
- `scopeOptions` : notions pretes seulement, avec `kind: knowledge_unit`, id, documentId, label, sourceLabel, canSelect ;
- `questionCountOptions` : `[6, 10, 13]` ;
- `defaultQuestionCount` : `6` si le cours est pret ;
- `supportedQuestionKinds` : types QCM complet existants, sans `image_choice` pour ce point d'entree ;
- `complexityProfiles` : `standard`, `advanced` ;
- `defaultConfig` ;
- `nextStep`.

Etats pris en charge : `READY`, `PARTIALLY_READY`, `NOT_READY`, `BLOCKED`.

`POST /courses/:courseId/rich-revision/sessions`

Body accepte :

```json
{
  "scopeKind": "knowledge_unit",
  "scopeId": "ku-1",
  "questionCount": 6,
  "complexityProfile": "standard"
}
```

Garde-fous :

- refuse `studentId`, `subjectId`, `courseId`, `documentId`, `knowledgeUnitId`, `questionTypeMix` dans le body ;
- question count borne a `6`, `10`, `13` ;
- scope limite aux notions pretes du cours ;
- ownership verifie via `findDetailByIdForStudent` ;
- aucune correction ou reponse exposee par le contrat options ;
- aucune session examen ou deep creee.

## 4. Ce qui est livre

- endpoint options course-level ;
- endpoint start course-level ;
- export du use case riche depuis `ActivitiesModule` ;
- provider du contrat dans `CoursesModule` ;
- tests use case options ;
- tests use case start ;
- tests controller sur routes, garde-fous, payload public et absence de session creee par options.

## 5. Ce qui est reporte

- pool quality, dedup et flags ;
- QCM complet adaptatif par document entier ;
- choix de mix fin de types de questions ;
- deep revision course-level ;
- examen mixte ;
- refonte result/history.

## 6. Tests ajoutes ou adaptes

- `get-course-rich-revision-options.use-case.spec.ts`
- `start-course-rich-revision-session.use-case.spec.ts`
- `courses.controller.spec.ts`

Les tests couvrent :

- course pret ;
- absence de source prete ;
- absence de notion exploitable ;
- ownership par `studentId` ;
- scope notion ;
- bornage 6/10/13 ;
- refus des champs techniques dans le body ;
- absence de correction/reponse dans les options ;
- aucune creation de session par endpoint options ;
- delegation unique au moteur QCM complet existant au start.

## 7. Validations executees

- `npm run build` : OK
- `npm run lint:check` : OK apres formatage Prettier cible
- `npm test -- rich-closed --runInBand` : OK, 10 suites, 245 tests
- `npm test -- courses --runInBand` : OK, 19 suites, 160 tests
- `npm test -- activities --runInBand` : OK, 21 suites passees, 1 suite skip existante, 369 tests passes, 1 test skip existant
- `npm test -- revision-sessions --runInBand` : OK, 12 suites, 96 tests
- `git diff --check` : OK apres creation documentaire

## 8. Fichiers modifies

Voir `RICH_01_COURSE_LEVEL_QCM_COMPLET_EVIDENCE_PACK.md`.

## 9. Trackers

- `RICH-01` marque `DONE`.
- Parent `RICH` marque `DONE`.
- `DEEP`, `EXAM`, `QUALITY`, `POLISH` et `IDENTITY` restent non livres.

## 10. Auto-review finale

- Pas de commit, push, merge, rebase, tag ou deploiement.
- Pas de changement Prisma, migration, prompt IA ou provider IA.
- Pas de session examen, resultat examen, deep revision ou quality pool introduit.
- Le start course-level appelle le moteur QCM complet existant une seule fois.
- Le contrat options n'expose ni correction ni reponse.
- Les routes restent course-owned via `studentId`.
- Les result/history QCM complet existants restent proprietaires de la suite.

## 11. Critique du prompt

Le prompt etait bien borne et a force la bonne separation entre activation course-level et refonte du moteur riche. Le point le plus sensible etait la mention "result/history branches" : dans RICH-01, le bon choix est de ne pas recreer ces surfaces mais de router vers la session riche existante, deja compatible avec result/history.
