# RELEASE-01A — MVP runtime smoke runbook

## Objectif

Prouver en conditions réelles le parcours MVP Neralune :

1. Authentification utilisateur.
2. Création matière.
3. Création cours.
4. Upload PDF.
5. Analyse PDF jusqu'à `READY`.
6. Génération fiche si applicable.
7. Readiness question bank.
8. Préparation question bank 10 ou 20.
9. Worker consomme les jobs.
10. Readiness `READY`.
11. Démarrage session quick.
12. Sélection réponse.
13. Sauvegarde draft.
14. Quitter session.
15. Revenir au cours.
16. Reprendre session.
17. Réponse restaurée.
18. Terminer session.
19. Résultat affiché.
20. Retour cours.
21. Historique visible.
22. Ouverture résultat depuis historique.

## Prérequis

- Backend CORE-11B déployé.
- Frontend/App CORE-11B déployé ou app Flutter pointant vers le backend CORE-11B.
- PostgreSQL disponible.
- Redis disponible.
- Worker question bank actif.
- Compte Firebase valide.
- Token Firebase ID valide pour les commandes API manuelles.
- PDF de test non sensible.

Variables locales :

```bash
export API_BASE_URL="https://revision-api.yoahn.me"
export FIREBASE_ID_TOKEN="<token Firebase temporaire>"
export SMOKE_PDF_PATH="/chemin/vers/smoke.pdf"
```

Ne jamais écrire le token dans un rapport, un commit ou un ticket.

## Vérifications infra

```bash
curl -i "$API_BASE_URL/health"
```

Attendu :

```json
{ "status": "ok" }
```

```bash
curl -i "$API_BASE_URL/health/readiness"
```

Attendu :

```json
{
  "status": "ready",
  "checks": {
    "database": "ok"
  }
}
```

Si la base n'est pas joignable, le statut attendu est HTTP 503 avec `status=not_ready`.

Vérifier les logs backend :

- `No pending migrations to apply`
- `Nest application successfully started`
- `course_question_bank_worker_runtime_configuration`
- `questionBankWorkerEnabled: true`
- `consumerRegistered: true`

## Smoke API manuel

### 1. Créer une matière

```bash
curl -sS -X POST "$API_BASE_URL/subjects" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke release"}'
```

Noter `subject.id`.

```bash
export SMOKE_SUBJECT_ID="<subject id>"
```

### 2. Créer un cours

```bash
curl -sS -X POST "$API_BASE_URL/subjects/$SMOKE_SUBJECT_ID/courses" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cours smoke release"}'
```

Noter `course.id`.

```bash
export SMOKE_COURSE_ID="<course id>"
```

### 3. Uploader un PDF

```bash
curl -sS -X POST "$API_BASE_URL/courses/$SMOKE_COURSE_ID/source/course-pdf" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -F "file=@$SMOKE_PDF_PATH;type=application/pdf"
```

Attendu : source créée, statut initial en analyse ou prêt selon le traitement.

### 4. Attendre l'analyse PDF

Rafraîchir le détail cours ou les sources depuis l'app. En API, utiliser les endpoints cours/sources disponibles et vérifier que le document devient `READY`.

Critère PASS : au moins une source course-level est prête.

### 5. Vérifier la readiness question bank

```bash
curl -sS "$API_BASE_URL/courses/$SMOKE_COURSE_ID/question-bank/readiness?questionCount=10" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Attendus possibles :

- `READY` si la banque est prête ;
- `NOT_PREPARED` si préparation nécessaire ;
- `PREPARING` si job actif ;
- `NO_READY_SOURCE` ou `NO_KNOWLEDGE_UNITS` si analyse insuffisante.

### 6. Préparer la question bank

```bash
curl -sS -X POST "$API_BASE_URL/courses/$SMOKE_COURSE_ID/question-bank/prepare" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"questionCount":10}'
```

Attendu : `PREPARING` ou `READY`.

Vérifier les logs backend :

- job reçu ;
- job claimé ;
- génération provider/model sans prompt complet ;
- persistedCount ;
- status final.

### 7. Attendre readiness READY

Répéter :

```bash
curl -sS "$API_BASE_URL/courses/$SMOKE_COURSE_ID/question-bank/readiness?questionCount=10" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Critère PASS : `status=READY`, `readyQuestionCount >= targetQuestionCount`.

### 8. Démarrer une session quick

```bash
curl -sS -X POST "$API_BASE_URL/courses/$SMOKE_COURSE_ID/revision-sessions/quick" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"questionCount":10}'
```

Attendu : session créée, aucune génération IA longue dans cette requête.

Noter `session.id`, `question.id` et un `choice.id`.

```bash
export SMOKE_SESSION_ID="<session id>"
export SMOKE_QUESTION_ID="<question id>"
export SMOKE_CHOICE_ID="<choice id>"
```

### 9. Sauvegarder un draft

```bash
curl -sS -X PUT "$API_BASE_URL/revision-sessions/$SMOKE_SESSION_ID/questions/$SMOKE_QUESTION_ID/draft-answer" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"selectedChoiceIds\":[\"$SMOKE_CHOICE_ID\"]}"
```

Attendu : draft sauvegardé.

### 10. Vérifier session reprenable

```bash
curl -sS "$API_BASE_URL/courses/$SMOKE_COURSE_ID/revision-sessions/resumable" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Critère PASS : session en cours retournée, progression cohérente.

### 11. Vérifier draft restauré

```bash
curl -sS "$API_BASE_URL/revision-sessions/$SMOKE_SESSION_ID" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Critère PASS : réponse sélectionnée visible dans le payload de session.

### 12. Terminer la session

Terminer depuis l'app pour éviter d'envoyer un payload de correction incomplet. Le test API automatisé couvre le contrat de completion ; le smoke humain doit vérifier l'UX complète.

Critères PASS :

- page résultat affichée ;
- session terminée non reprenable ;
- historique du cours mis à jour.

### 13. Vérifier l'historique

```bash
curl -sS "$API_BASE_URL/courses/$SMOKE_COURSE_ID/revision-sessions/history?limit=5" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Critère PASS : la session terminée apparaît dans `items`.

### 14. Ouvrir le résultat depuis l'historique

```bash
curl -sS "$API_BASE_URL/revision-sessions/$SMOKE_SESSION_ID/result" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Critère PASS : résultat stable, session terminée uniquement.

## Smoke App avec Marionette

Lancer :

```bash
flutter run \
  -t dev/marionette_main.dart \
  -d macos \
  --debug \
  --dart-define=API_BASE_URL=https://revision-api.yoahn.me
```

Connecter Marionette au VM Service URI affiché.

Parcours :

1. Ouvrir l'app.
2. S'authentifier.
3. Créer une matière.
4. Créer un cours.
5. Uploader un PDF.
6. Attendre la source prête.
7. Préparer les questions.
8. Attendre `Questions prêtes`.
9. Démarrer une révision rapide.
10. Sélectionner une réponse.
11. Quitter la session.
12. Revenir au cours.
13. Vérifier `Reprendre`.
14. Reprendre.
15. Vérifier que la réponse est restaurée.
16. Terminer.
17. Voir le résultat.
18. Retourner au cours.
19. Vérifier `Historique`.
20. Ouvrir le résultat depuis l'historique.

## Critères PASS

- PDF analysé.
- Banque prête.
- Quick session créée sans génération IA synchrone.
- Draft sauvegardé côté serveur.
- Session reprenable.
- Draft restauré.
- Session complétée.
- Résultat affiché.
- Historique cours mis à jour.
- Résultat réouvrable depuis l'historique.
- Aucun worker bloqué.
- Aucune migration en erreur.

## Critères FAIL

- Migration pending ou failed.
- Worker question bank non enregistré.
- Redis indisponible.
- PDF bloqué hors `READY`.
- Readiness bloquée sans logs.
- Draft non restauré.
- Session terminée encore reprenable.
- Historique vide après completion.
- Résultat inaccessible.
- Erreur 5xx non expliquée.

## Notes de sécurité

- Ne jamais stocker `FIREBASE_ID_TOKEN`.
- Ne pas joindre le PDF de test s'il contient des données personnelles.
- Ne pas coller les logs IA complets.
- Ne pas exposer `DATABASE_URL`, `REDIS_URL` ou clés provider.
