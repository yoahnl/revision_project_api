# MVP Core acceptance runbook

Ce runbook vérifie le parcours MVP Core réel côté backend, sans mode démo durable et sans `CourseSource`.

## Périmètre

Le parcours attendu est :

1. Utilisateur authentifié.
2. Matières réelles accessibles.
3. Création d'un cours réel.
4. Ouverture du détail du cours.
5. Upload d'une source PDF via le cours.
6. Traitement documentaire jusqu'au statut `READY`.
7. Fiche de cours course-level.
8. Révision rapide course-level.
9. Réponse au QCM.
10. Progression réelle course/subject.
11. Suppression optionnelle d'une source attachée au cours, en local/dev uniquement.

## Endpoints critiques

- `GET /subjects`
- `GET /subjects/:subjectId/courses`
- `POST /subjects/:subjectId/courses`
- `GET /courses/:courseId`
- `POST /courses/:courseId/source/course-pdf`
- `DELETE /courses/:courseId/sources/:documentId`
- `GET /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sessions/quick`
- `GET /courses/:courseId/progress`
- `GET /subjects/:subjectId/progress`

## Vérifications API

```bash
npx prisma validate
npx prisma generate
npm run build
npm run lint:check
npm test -- modules/courses --runInBand
npm test -- revision-sessions --runInBand
npm test -- --runInBand
npm run test:e2e -- --runInBand
git diff --check
```

## Smoke manuel local

1. Démarrer l'API en environnement local/dev.
2. S'authentifier avec un utilisateur de test.
3. Créer une matière réelle si nécessaire.
4. Créer un cours sous cette matière.
5. Uploader un PDF avec `POST /courses/:courseId/source/course-pdf`.
6. Vérifier que le document passe de `UPLOADED`/`PROCESSING` à `READY`.
7. Appeler `GET /courses/:courseId/progress` et vérifier un état cohérent.
8. Vérifier optionnellement la suppression de source avec `DELETE /courses/:courseId/sources/:documentId` sur un document de test, puis confirmer que le cours et la progression se recalculent sans fuite cross-student.
9. Appeler `POST /courses/:courseId/revision-sessions/quick` quand une source `READY` existe.
10. Soumettre l'activité générée par la session.
11. Recharger `GET /courses/:courseId/progress` et `GET /subjects/:subjectId/progress`.

## Hors MVP Core

- Révision approfondie.
- Préparation examen.
- Résultat final dédié de session.
- Gamification durable.
- Multi-source avancé.
- Table ou modèle `CourseSource`.
- SSE/WebSocket de processing.

## Garde-fous

- Le client ne fournit pas `studentId`.
- L'upload sous cours dérive `subjectId` depuis le cours.
- La révision rapide choisit la source et la notion côté backend.
- La suppression de source prend `courseId` et `documentId` depuis le path, jamais depuis un body client.
- Les endpoints protégés doivent répondre `401` sans bearer token.
- Les documents sans `courseId` ne polluent pas la progression course-level.
