# Roadmap V3.1 - Product Modes Plan

## 1. Etat actuel

Le MVP core est ferme et les chantiers `PLUS-02` et `PLUS-03` sont termines.

Baselines relevees au debut du lot :

| Repo | HEAD |
| --- | --- |
| API | `18972db47371e59127f86869cab13089d69a324e` |
| App | `41d72438c35fd94a92741fde27f42697a168b7ff` |

Le produit dispose deja de briques solides : revision rapide course-level, QCM riche, preparation examen QCM-only, question ouverte, fiches, historique et question bank. Le probleme n'est pas l'absence totale de fonctionnalite, mais la confusion entre les promesses produit.

## 2. Objectif V3.1

V3.1 stabilise la taxonomie produit avant de relancer les lots fonctionnels. La roadmap separe explicitement :

| Surface | Promesse |
| --- | --- |
| Fiche | Je veux comprendre le cours. |
| Revision rapide | Je veux me tester vite. |
| QCM complet | Je veux m'entrainer serieusement avec des questions variees. |
| Revision approfondie | Je veux rediger et recevoir une correction detaillee. |
| Preparation examen - QCM | Je veux un entrainement examen court, actuellement limite aux QCM. |
| Preparation examen mixte | Je veux simuler un entrainement global proche d'un sujet. |

## 3. Ce qui est stable

- Les sessions `QUICK`, `EXAM` et `DEEP` existent dans le modele API.
- La revision rapide course-level peut demarrer une session `QUICK` avec un `DIAGNOSTIC_QUIZ`.
- La preparation examen peut demarrer une session `EXAM`, mais elle reutilise le meme pool QCM simple que quick.
- Le QCM riche existe avec generation, soumission, correction, resultat et historique.
- La question ouverte existe avec generation, soumission, evaluation IA et mise a jour de maitrise.
- L'App sait afficher des sessions quick/exam, des resultats quick/exam, les questions riches et la question ouverte.

## 4. Ce qui est volontairement incomplet

- La preparation examen n'est pas encore un mode mixte : elle est QCM-only.
- Le QCM riche n'a pas encore une vraie facade course-level claire depuis `CourseDetailPage`.
- La revision approfondie est encore affichee comme indisponible dans le detail cours.
- La question ouverte n'a pas encore de lifecycle/result/history deep course-level.
- L'historique affiche quick, rich closed et exam, mais sans taxonomie produit unifiee.
- La question bank prepare un minimum par notion et peut produire 35 ou 65 questions pour une demande utilisateur de 10 questions.

## 5. Ordre recommande

| Ordre | Lot | Statut cible | Raison |
| --- | --- | --- | --- |
| 1 | `RESET-01` | `DONE` | Formaliser la taxonomie, le mapping et les trackers V3.1. |
| 2 | `QB-01` | `TODO` | Corriger la sur-generation avant de redefinir les cartes produit. |
| 3 | `MODE-01` | `TODO` | Renommer/clarifier les cartes et eviter les promesses fausses. |
| 4 | `RICH-01` | `TODO` | Reexposer le QCM complet depuis le cours avec une promesse distincte. |
| 5 | `DEEP-01A` | `TODO` | Activer la question ouverte comme coeur de la revision approfondie. |
| 6 | `DEEP-01B` | `TODO` | Ajouter completion, resultat, historique et reopen result pour deep. |
| 7 | `EXAM-02A` | `TODO` | Concevoir l'examen mixte sans casser l'exam QCM-only existant. |
| 8 | `EXAM-02B` | `TODO` | Orchestrer QCM simple, QCM riche et question ouverte cote API. |
| 9 | `EXAM-02C` | `TODO` | Construire le flow App de l'examen mixte. |
| 10 | `QUALITY-01A` | `TODO` | Ameliorer adaptativite et dedup semantique apres stabilisation des modes. |
| 11 | `QUALITY-01B` | `TODO` | Transformer les flags en cycle de remplacement. |
| 12 | `POLISH-01` | `TODO` | Unifier historique, wording, loaders, empty states et erreurs. |
| 13 | `IDENTITY-01` | `TODO` | Integrer Rena apres stabilisation produit et polish UX. |

## 6. Dependances

`QB-01` doit preceder `MODE-01`, car l'UX ne doit pas continuer a afficher le nombre brut du pool comme promesse produit. `MODE-01` doit preceder `RICH-01` et `DEEP-01A`, car les nouvelles entrees course-level doivent utiliser une taxonomie stable.

`EXAM-02A` doit attendre `RICH-01` et `DEEP-01B`, car l'examen mixte depend d'un QCM complet expose et d'une revision approfondie result/history fiable. `QUALITY-01` doit attendre la clarification des modes pour ne pas optimiser un pool dont la responsabilite produit est encore floue.

## 7. Non-objectifs V3.1

- Pas d'implementation API.
- Pas d'implementation App.
- Pas de modification Prisma.
- Pas de migration.
- Pas de modification des prompts IA ou providers IA.
- Pas de refonte UI.
- Pas de suppression de code.
- Pas de commit, push, merge, rebase ou tag.

## 8. Criteres de succes

- Quick, QCM complet, deep et exam ont chacun une promesse claire.
- La preparation examen actuelle est nommee comme QCM-only.
- Le probleme 35/65 questions est explique par le minimum par notion.
- `QB-01` est le prochain lot code prioritaire.
- Les trackers V3.1 sont prets a l'emploi.
- Les documents V3 et V2 existants restent intacts.
