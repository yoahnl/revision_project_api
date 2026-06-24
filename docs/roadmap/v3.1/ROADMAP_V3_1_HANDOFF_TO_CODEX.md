# Roadmap V3.1 Handoff To Codex

## Etat actuel stable

- API HEAD audite : `18972db47371e59127f86869cab13089d69a324e`.
- App HEAD audite : `41d72438c35fd94a92741fde27f42697a168b7ff`.
- MVP core, `PLUS-02` et `PLUS-03` sont termines.
- Quick course-level fonctionne.
- Preparation examen fonctionne en QCM-only avec session/result/history.
- QCM riche fonctionne techniquement avec result/history.
- Question ouverte fonctionne techniquement avec evaluation IA.

## Problemes critiques

1. Quick et exam utilisent le meme pool QCM simple.
2. Exam est nomme trop largement alors qu'il est QCM-only.
3. QCM complet existe mais n'est pas une carte course-level stable.
4. Deep existe par briques open question mais pas comme mode course-level complet.
5. La question bank peut generer 35/65 questions a cause du minimum par notion.
6. L'historique empile les modes sans taxonomie finale.

## Ordre recommande

1. `QB-01`
2. `MODE-01`
3. `RICH-01`
4. `DEEP-01A`
5. `DEEP-01B`
6. `EXAM-02A`
7. `EXAM-02B`
8. `EXAM-02C`
9. `QUALITY-01A`
10. `QUALITY-01B`
11. `POLISH-01`
12. `IDENTITY-01`

## Prochain lot recommande

`QB-01 - Question-bank budget planner & overgeneration fix`.

Objectif du prochain prompt : corriger la sur-generation en separant `sessionQuestionCount`, `poolTarget` et `perKnowledgeUnitTarget`.

Validation attendue :

- Tests API sur `course-question-bank-readiness`.
- Tests API sur `question-bank.service`.
- Tests repository/job si le contrat de jobs change.
- `npm run build`.
- `npm run lint:check`.
- `npm test -- question-bank --runInBand`.
- `npm test -- courses --runInBand`.
- `git diff --check`.

## Pieges a eviter

- Ne pas relancer `PLUS-01A` tel quel.
- Ne pas presenter exam comme mixte avant `EXAM-02`.
- Ne pas melanger QCM complet et preparation examen.
- Ne pas corriger les 35/65 uniquement par wording App.
- Ne pas modifier prompts IA pendant `QB-01` sauf necessite explicite.
- Ne pas casser quick, exam QCM-only, rich closed result/history ou open question.
- Ne pas afficher le nombre brut du pool comme promesse principale.

## Regles pour les futurs lots

- Chaque lot doit rester petit ou moyen.
- Chaque lot doit avoir tests cibles et rapport.
- Les changements App doivent eviter les faux boutons.
- Les scores canoniques restent serveur.
- Les documents V2 et V3 existants ne doivent pas etre reecrits.
- Les trackers V3.1 doivent etre mis a jour a chaque lot.
