# DEEP-01B - Deep result, history & reopen report

Date : 2026-06-25

Repo : API `yoahnl/revision_project_api`

Baseline relevee avant travaux : `0373a43419b6112be8b06c2d20cef3abf5f1020c`

## 1. HEAD releves

- API : `0373a43419b6112be8b06c2d20cef3abf5f1020c`
- App : `861ad2f9194f3f27d1fc269c5c2f24c465c2a580`

## 2. Audit initial DEEP-01B

Roadmap V3.1 : `RESET-01`, `QB-01`, `MODE-01`, `RICH-01`, `RICH-01B` et `DEEP-01A` etaient livres. Parent `DEEP` etait `IN_PROGRESS`. `DEEP-01B` etait le prochain lot. `EXAM-02A` devait rester `TODO`.

API :

- `RevisionSessionModeValue` contenait deja `DEEP`.
- `DEEP-01A` exposait options/start/submit course-level pour question ouverte.
- `SubmitOpenAnswerUseCase` persistait `OpenAnswerEvaluation.answerText` et la correction.
- Apres submit, l'ancienne reponse API annoncait une correction inline, mais la `RevisionSession` et son action n'etaient pas finalisees comme un resultat reopenable.
- Les resultats generiques quick/exam ne couvraient que les actions diagnostic quiz.
- Les donnees utiles au reopen existaient sans migration : `RevisionSession`, `RevisionSessionAction`, `ActivitySession`, `OpenQuestion`, `OpenAnswerEvaluation`, `KnowledgeUnit`, `Document`.

Risques identifies :

- appeler l'IA au reopen ;
- lire une session non `DEEP` comme resultat deep ;
- casser la relecture si la source n'est plus `READY` ;
- exposer du payload brut ou des IDs inutiles ;
- creer une migration Prisma inutile ;
- marquer `DEEP` done sans result/history/reopen.

## 3. Architecture retenue

Le lot ajoute un contrat course-level dedie au resultat et a l'historique deep :

```text
GET /courses/:courseId/deep-revision/sessions/:sessionId/result
GET /courses/:courseId/deep-revision/history?limit=5
```

Le submit deep reste compatible avec `DEEP-01A`, mais appelle maintenant `completeDeepOpenAnswerSession` apres la correction pour finaliser la `RevisionSession` et l'action.

Aucune migration Prisma n'a ete ajoutee. Le result est reconstruit depuis les relations existantes et l'evaluation persistee.

## 4. Contrat API result/history

Result :

- `session` : id, mode, status, courseId, dates ;
- `scope` : notion et source lisibles ;
- `question` : question ouverte et sources de question ;
- `answer` : texte soumis et date de soumission ;
- `evaluation` : score, feedback, points, erreurs, modele, conseil, sources.

History :

- liste uniquement les sessions `DEEP` du cours ;
- inclut uniquement les sessions avec evaluation disponible ;
- trie par date descendante ;
- respecte `limit` borne a 1..50 ;
- retourne `resultPath` pour rouvrir le resultat.

## 5. Lifecycle final retenu

Apres submit deep reussi :

- `ActivitySession OPEN_QUESTION` reste soumise selon la convention open answer existante ;
- `RevisionSessionAction OPEN_QUESTION` passe `COMPLETED` ;
- `RevisionSession DEEP` passe `COMPLETED` ;
- le result endpoint devient lisible immediatement ;
- l'historique deep peut lister la session terminee.

Les endpoints result/history n'appellent jamais l'IA et ne recalculent pas la correction.

## 6. Ce qui est supporte

- result deep reopenable ;
- history deep course-level ;
- relecture meme si la source n'est plus `READY` ;
- refus ownership course/session/student ;
- refus session hors cours ;
- refus session non `DEEP` ;
- refus session sans evaluation ;
- garde-fou `request next action` pour `DEEP`.

## 7. Ce qui est reporte

- examen mixte `EXAM-02` ;
- quality pool et dedup ;
- historique global unifie polish ;
- statistiques deep avancees ;
- nouveaux prompts ou providers IA.

## 8. Tests ajoutes ou adaptes

- `course-deep-revision-session.use-case.spec.ts`
- `courses.controller.spec.ts`
- `prisma-revision-sessions.repository.spec.ts`
- `request-next-revision-session-action.use-case.spec.ts`

Cas couverts :

- submit finalise la session deep ;
- submit rend le result endpoint lisible ;
- result retourne session/scope/question/answer/evaluation ;
- result refuse session hors cours, non deep ou sans evaluation ;
- result ne depend pas d'une source encore `READY` ;
- history liste seulement les sessions deep corrigees ;
- history respecte `limit` et retourne `resultPath` ;
- next action deep est refuse.

## 9. Validations executees

- `npm run build` : OK
- `npm run lint:check` : OK
- `npm test -- open-question --runInBand` : OK, 2 suites, 6 tests
- `npm test -- courses --runInBand` : OK, 21 suites, 186 tests
- `npm test -- activities --runInBand` : OK, 21 suites passees, 1 suite skip existante, 369 tests passes, 1 test skip existant
- `npm test -- revision-sessions --runInBand` : OK, 12 suites, 100 tests
- `git diff --check` : OK apres creation documentaire finale

## 10. Fichiers modifies

Voir `DEEP_01B_DEEP_RESULT_HISTORY_EVIDENCE_PACK.md`.

## 11. Trackers

- `DEEP-01B` marque `DONE`.
- Parent `DEEP` marque `DONE`.
- `EXAM-02A` reste `TODO`.

## 12. Smoke manuel

Smoke manuel non execute dans ce lot. Les garanties disponibles sont les tests API/App cibles et les validations completes listees ci-dessus.

## 13. Auto-review finale

- Pas de commit, push, merge, rebase, amend, tag ou deploiement.
- Pas de migration Prisma.
- Pas de prompt IA modifie.
- Pas de provider IA modifie.
- Result/history n'appellent pas l'IA.
- Result/history ne creent pas de donnees fake.
- Result refuse les sessions non `DEEP`.
- Relecture d'un ancien resultat ne depend pas du statut `READY` de la source.
- Quick revision, QCM complet, QCM complet sequentiel et preparation examen QCM restent couverts par les validations.

## 14. Critique du prompt

Le prompt etait precis sur la frontiere entre persistance/reopen et nouvelles capacites deep. Le point le plus sensible etait de finaliser le lifecycle sans changer Prisma ni les prompts IA. Le bon compromis a ete de reconstruire le result depuis les donnees deja persistees et de laisser le polish d'historique global a `POLISH-01`.

## 15. Etat Git honnete

Operations Git volontairement executees dans ce lot :

- `git rev-parse HEAD`
- `git status --short`
- `git diff --check`

Aucun commit, push, merge, rebase, amend, tag ou deploiement n'a ete execute.

Etat Git final observe apres ce lot : modifications locales non commitees dans les fichiers du lot et documents V3.1.
