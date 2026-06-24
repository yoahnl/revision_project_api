# Roadmap V3.1 Decisions

## Decisions structurantes

1. On ne lance pas `PLUS-01A` avant clarification des modes. La revision approfondie doit etre redessinee comme `DEEP-01A` puis `DEEP-01B`.
2. La preparation examen actuelle est QCM-only. Elle utilise une session `EXAM`, mais son activite principale reste un `DIAGNOSTIC_QUIZ`.
3. La preparation examen doit etre renommee temporairement `Preparation examen - QCM` cote utilisateur.
4. `QCM complet` doit etre separe de `Preparation examen`. Les questions riches portent la promesse d'entrainement varie ; l'exam porte a terme une promesse mixte.
5. `Revision approfondie` doit porter la question ouverte, la redaction et la correction IA detaillee.
6. Le pool quick ne doit plus piloter toutes les promesses produit. Il sert quick et exam QCM-only, pas QCM complet ni deep.
7. Les 35/65 questions viennent du minimum par notion : `max(5, ceil(questionCount / knowledgeUnitCount))`.
8. Le prochain lot code prioritaire est `QB-01` apres `RESET-01`.
9. L'examen mixte doit etre un chantier ulterieur `EXAM-02`, apres QCM complet course-level et deep result/history.
10. Rena / mascotte est reportee apres `POLISH-01`, car l'identite ne doit pas compenser une taxonomie confuse.

## Decisions de wording

| Surface actuelle | Wording V3.1 recommande | Raison |
| --- | --- | --- |
| Revision rapide | Revision rapide | Promesse courte et deja fonctionnelle. |
| Preparation examen | Preparation examen - QCM | Evite de promettre un examen mixte. |
| Questions riches | QCM complet | Plus clair depuis un cours. |
| Revision approfondie | Revision approfondie | A associer explicitement a la question ouverte. |
| Historique | Historique, puis filtres/labels par mode | Evite l'empilement indifferencie. |

## Decisions de priorite

`QB-01` passe avant `MODE-01`, car la readiness et les compteurs influencent l'UX. `MODE-01` passe avant `RICH-01` et `DEEP-01A`, car les nouvelles entrees doivent s'inscrire dans une taxonomie stable.

`QUALITY-01` attend que quick, QCM complet, deep et exam soient separes. Sinon le travail de qualite risque de corriger le mauvais pool.
