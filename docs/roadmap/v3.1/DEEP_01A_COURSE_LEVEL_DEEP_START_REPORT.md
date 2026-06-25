# DEEP-01A - Course-level deep revision start & correction report

Date : 2026-06-25

Repo : API `yoahnl/revision_project_api`

Baseline relevee avant travaux : `53b88f0a0db21633369866af87aade6456d69f05`

## 1. Audit initial DEEP-01A

Roadmap V3.1 : `RESET-01`, `QB-01`, `MODE-01`, `RICH-01` et `RICH-01B` etaient livres cote produit. `DEEP-01A` etait le prochain lot executable. `DEEP-01B` et `EXAM-02A` restent a faire.

API :

- `RevisionSessionModeValue` contenait deja `DEEP`.
- Le moteur `open_question` existait deja dans `src/modules/activities`.
- `StartRevisionSessionUseCase` savait deja demarrer une session avec `mode: DEEP` et `preferredAction: open_question`.
- `SubmitOpenAnswerUseCase` existait mais n'etait pas expose a `CoursesModule`.
- `CoursesModule` exposait deja le detail cours et pouvait retrouver les sources `COURSE_PDF` pretes avec leurs knowledge units.
- Les resultats, l'historique et le reopen result deep n'existaient pas comme flow course-level dedie : ils restent `DEEP-01B`.

Risques identifies :

- creer une question ouverte sans source exploitable ;
- melanger le demarrage/correction avec un lifecycle result/history hors scope ;
- exposer des corrections ou reponses dans le contrat options ;
- contourner l'ownership course-level ;
- casser quick revision, QCM complet, preparation examen QCM ou result/history existants.

## 2. Architecture retenue

Le lot ajoute une facade course-level dans `CoursesModule`.

Endpoints livres :

- `GET /courses/:courseId/deep-revision/options`
- `POST /courses/:courseId/deep-revision/sessions`
- `POST /courses/:courseId/deep-revision/sessions/:sessionId/submit`

Le endpoint options ne modifie pas la base et n'appelle pas l'IA. Le start reutilise `StartRevisionSessionUseCase` avec `mode: DEEP` et `preferredAction: open_question`. Le submit reutilise `SubmitOpenAnswerUseCase` apres verification course/session/source.

Le lot ne modifie pas Prisma, les migrations, les prompts IA, les providers IA, ni le moteur de correction.

## 3. Contrat API final

`GET /courses/:courseId/deep-revision/options`

Retourne :

- `course` : id, titre, subjectId ;
- `readiness` : `canStart`, `state`, `userMessage`, `blockers`, compte de sources pretes, compte de notions pretes ;
- `scopeOptions` : notions issues de sources `COURSE_PDF` pretes uniquement ;
- `answerGuidelines` : longueur min/max et conseils utilisateur ;
- `defaultConfig` : scope notion par defaut si disponible ;
- `nextStep` : action attendue sans promettre result/history.

`POST /courses/:courseId/deep-revision/sessions`

Body accepte :

```json
{
  "scopeKind": "knowledge_unit",
  "scopeId": "ku-1"
}
```

Garde-fous :

- ownership verifie via le detail de cours du `studentId` courant ;
- scope limite aux knowledge units d'une source `COURSE_PDF` prete du cours ;
- refus des sources archivees ou non pretes ;
- refus du fallback question ouverte sans source ;
- aucune session exam creee ;
- aucune correction ou reponse exposee dans le payload de start.

`POST /courses/:courseId/deep-revision/sessions/:sessionId/submit`

Body accepte :

```json
{
  "answer": "Reponse de l'etudiant"
}
```

Garde-fous :

- longueur de reponse bornee ;
- session owned par l'etudiant courant ;
- session rattachee au cours demande ;
- session en mode `DEEP`, non terminee, action courante `open_question` ;
- contexte d'evaluation encore rattache a une source de cours prete ;
- score canonique et evaluation restent produits cote API existante, pas par l'App.

## 4. Ce qui est livre

- options course-level pour revision approfondie ;
- readiness fondee sur sources pretes et notions exploitables ;
- demarrage d'une question ouverte depuis le cours ;
- correction de la reponse depuis le cours ;
- export de `SubmitOpenAnswerUseCase` depuis `ActivitiesModule` ;
- export des repositories necessaires entre modules Nest ;
- tests use case options ;
- tests use case start/submit ;
- tests controller pour validation, ownership, erreurs et absence de payload sensible.

## 5. Ce qui est reporte a DEEP-01B

- completion/lifecycle deep complet ;
- page resultat deep dediee ;
- historique deep dedie ;
- reopen result ;
- agregats et statistiques deep ;
- integration avec examen mixte ;
- refonte globale de l'open question.

## 6. Tests ajoutes ou adaptes

- `get-course-deep-revision-options.use-case.spec.ts`
- `course-deep-revision-session.use-case.spec.ts`
- `courses.controller.spec.ts`

Les tests couvrent :

- options course prete ;
- absence de source prete ;
- absence de notion exploitable ;
- ownership course-level ;
- scope notion valide ;
- refus des scopes non prets ;
- refus des bodies techniques ;
- refus des reponses vides ou trop longues ;
- absence de correction/reponse dans options ;
- aucune session creee par options ;
- delegation start vers `StartRevisionSessionUseCase` ;
- delegation submit vers `SubmitOpenAnswerUseCase` apres verification.

## 7. Validations executees

- `npm run build` : OK
- `npm run lint:check` : OK
- `npm test -- open-question --runInBand` : OK, 2 suites, 6 tests
- `npm test -- courses --runInBand` : OK, 21 suites, 180 tests
- `npm test -- activities --runInBand` : OK, 21 suites passees, 1 suite skip existante, 369 tests passes, 1 test skip existant
- `npm test -- revision-sessions --runInBand` : OK, 12 suites, 96 tests
- `git diff --check` : OK apres creation documentaire

## 8. Fichiers modifies

Voir `DEEP_01A_COURSE_LEVEL_DEEP_START_EVIDENCE_PACK.md`.

## 9. Trackers

- `DEEP-01A` marque `DONE`.
- Parent `DEEP` marque `IN_PROGRESS`.
- `DEEP-01B` reste `TODO`.
- `EXAM-02A` reste `TODO`.

## 10. Smoke manuel

Smoke manuel non execute dans ce lot. Les garanties disponibles sont les tests API/App cibles et les validations de build/lint.

## 11. Auto-review finale

- Pas de commit, push, merge, rebase, amend, tag ou deploiement.
- Pas de changement Prisma, migration, prompt IA ou provider IA.
- Pas de result/history/reopen deep introduit.
- Pas de session examen creee.
- Pas de fallback question ouverte sans source.
- Aucun contrat options n'expose de correction ou de reponse.
- Quick revision, QCM complet, preparation examen QCM, result/history existants restent couverts par tests.

## 12. Critique du prompt

Le prompt etait utilement strict sur la frontiere `DEEP-01A` / `DEEP-01B`. Le point le plus sensible etait d'utiliser le moteur open question existant sans promettre un historique deep complet. Le bon compromis a ete de livrer start/correction course-level, puis de laisser result/history a `DEEP-01B`.

