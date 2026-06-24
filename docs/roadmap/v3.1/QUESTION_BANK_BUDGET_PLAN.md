# Question Bank Budget Plan V3.1

## Probleme

La question bank quick prepare aujourd'hui un minimum par notion. Ce choix protege la diversite du pool, mais il rend le nombre visible cote produit trompeur.

Le comportement actuel :

```text
sessionQuestionCount = demande utilisateur, par exemple 10
knowledgeUnitCount = nombre de notions candidates
targetQuestionCountPerKnowledgeUnit = max(5, ceil(sessionQuestionCount / knowledgeUnitCount))
jobCount = knowledgeUnitCount
poolPreparedPotential = targetQuestionCountPerKnowledgeUnit * knowledgeUnitCount
```

Exemples :

| Demande | Notions | Target par notion | Pool potentiel |
| --- | ---: | ---: | ---: |
| 10 | 7 | 5 | 35 |
| 10 | 13 | 5 | 65 |
| 20 | 7 | 5 | 35 |
| 30 | 7 | 5 | 35 |

## Decision

`QB-01` doit separer trois notions :

| Nom | Sens |
| --- | --- |
| `sessionQuestionCount` | Nombre demande pour la session utilisateur. |
| `poolTarget` | Nombre total souhaite dans le pool pour servir les sessions proches. |
| `perKnowledgeUnitTarget` | Budget cible par notion, calcule depuis le deficit reel et borne. |

## Contrat QB-01

Un lot `QB-01` reussi doit garantir :

- Une demande de 10 questions sur 7 notions ne cree pas 35 questions par defaut.
- Une demande de 10 questions sur 13 notions ne cree pas 65 questions par defaut.
- Si le pool course-level est deja suffisant, aucun job n'est cree.
- Les jobs sont crees seulement pour un deficit reel.
- Le systeme garde une repartition raisonnable entre notions sans viser 5 questions partout.
- Le cap course-level reste respecte.
- La readiness distingue clairement `readyForSession` et `poolExpansionInProgress`.

## Algorithme cible

1. Calculer `sessionQuestionCount` avec les bornes existantes 5..30.
2. Compter les questions actives course-level sur les notions candidates.
3. Si `activeCourseCount >= sessionQuestionCount`, ne creer aucun job.
4. Calculer `deficit = sessionQuestionCount - activeCourseCount`.
5. Selectionner les notions les moins couvertes.
6. Distribuer le deficit sur ces notions, avec un petit buffer optionnel mais borne.
7. Creer des jobs uniquement pour les notions dont `activeKnowledgeUnitCount < perKnowledgeUnitTarget`.
8. Ne pas depasser le cap course-level.

## Exemple cible

| Situation | Comportement cible |
| --- | --- |
| 7 notions, 0 question, demande 10 | Creer environ 10 a 14 questions, pas 35. |
| 13 notions, 0 question, demande 10 | Creer environ 10 a 16 questions, pas 65. |
| 13 notions, 12 questions actives, demande 10 | Aucun job. |
| 13 notions, 8 questions actives, demande 10 | Creer seulement le deficit utile, pas 13 jobs de 5. |

## Donnees a exposer apres QB-01

La readiness devrait exposer ou permettre de deduire :

- `readyQuestionCount`
- `sessionQuestionCount`
- `poolTarget`
- `missingForSession`
- `isPreparing`
- `canStartQuickRevision`
- `canPrepareMore`

## Non-objectifs QB-01

- Pas de dedup semantique.
- Pas de flag lifecycle.
- Pas de refonte rich closed.
- Pas d'examen mixte.
- Pas de changement de prompts IA sauf necessite separee et explicite.
