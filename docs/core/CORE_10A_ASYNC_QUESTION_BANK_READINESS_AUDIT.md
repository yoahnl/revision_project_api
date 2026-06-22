# CORE-10A Async Question Bank Readiness Audit

## 1. Etat actuel du demarrage quick avant lot

Le demarrage course-level quick passait par `StartCourseQuickRevisionSessionUseCase`, puis par `QuestionBankService.createCourseQuickDiagnosticQuiz`.

Avant CORE-10A, ce chemin pouvait appeler la generation IA pendant la requete utilisateur si la banque active ne contenait pas assez de questions. Le tap utilisateur etait donc expose aux latences provider, aux erreurs de generation et aux timeouts reseau.

## 2. Ou la generation IA pouvait bloquer

Le point bloquant etait dans `QuestionBankService.ensureQuestionPool`, appele depuis la creation du snapshot de session. Le service savait a la fois generer des questions de banque et copier ces questions vers les tables `Question` de session.

CORE-10A conserve la logique de generation existante mais separe :

- preparation de la banque en arriere-plan ;
- creation rapide du snapshot quand assez de questions actives existent deja.

## 3. Etat actuel de `QuestionBankItem`

`QuestionBankItem` existe deja comme banque persistante course-level. Les items actifs servent de source canonique pour les snapshots `Question` de session. Les items flagges ou archives restent exclus des sessions normales.

CORE-10A ne modifie pas ce modele.

## 4. Etat actuel des jobs/queues

Le backend possede deja un pattern JobsModule avec BullMQ et des queues internes, notamment pour le traitement documentaire et le cleanup de fichiers. CORE-10A suit ce pattern avec une queue dediee de preparation question bank, tout en gardant un use case testable sans BullMQ.

## 5. Endpoints existants

Avant CORE-10A, le seul point d'entree utilisateur etait :

- `POST /courses/:courseId/revision-sessions/quick`

CORE-10A ajoute :

- `GET /courses/:courseId/question-bank/readiness`
- `POST /courses/:courseId/question-bank/prepare`

## 6. UI existante

Cote app, le detail cours et le hub pouvaient lancer quick via `startCourseQuickRevision`. Les erreurs etaient deja mappees vers des messages utilisateur, mais aucun modele de readiness n'existait.

## 7. Risques de doublons

Le risque principal etait de creer plusieurs generations identiques pour un meme cours apres plusieurs taps rapides. CORE-10A introduit une intention de preparation persistante et idempotente par cours/statut actif.

## 8. Risques de concurrence

CORE-10A garde une strategie V0 : detection d'un job actif et processing via job verrouille. Le verrouillage de selection fine des questions pour plusieurs sessions concurrentes reste repousse a CORE-10B.

## 9. Decision V0 retenue

La V0 est course-level :

- readiness calculee sur les sources/KU pretes et les questions `ACTIVE` ;
- preparation async dediee par cours ;
- quick start refuse le demarrage si la banque n'est pas prete ;
- quick start ne lance plus de generation IA longue dans la requete utilisateur.

## 10. Repousse a CORE-10B / CORE-10C

CORE-10B garde :

- selection multi-KU avancee ;
- repartition fine par maitrise/difficulte ;
- verrouillage concurrence riche ;
- prevention complete de double reservation.

CORE-10C garde :

- decouplage profond de `QuestionBankService` ;
- metriques cout/qualite ;
- observabilite avancee.
