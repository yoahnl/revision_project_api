# Product Mode Contract V3.1

## Principes

Un mode produit doit avoir une promesse, une entree utilisateur, une source de donnees, une validation et un historique coherent. Un mode ne doit pas emprunter le wording d'un autre mode s'il n'en livre pas la promesse.

## Fiche

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux comprendre le cours. |
| Contenu cible | Resume structure, notions importantes, definitions, exemples, sources. |
| Entree | Carte ou onglet `Fiche` depuis le cours. |
| Donnees | Study artifacts et revision sheets existants. |
| Resultat | Pas une session notee ; lecture et comprehension. |
| Historique | Pas prioritaire en V3.1. |
| Interdits | Ne pas presenter une fiche comme un entrainement. |

## Revision rapide

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux me tester vite. |
| Contenu cible | 5 ou 10 QCM simples, choix simple ou multiple, session courte. |
| Entree | Carte `Revision rapide` depuis le cours. |
| Donnees | Question bank quick, `DIAGNOSTIC_QUIZ`, session `QUICK`. |
| Resultat | Score simple serveur, corrections simples, historique quick. |
| Compteurs | Afficher une readiness simple, pas le nombre brut du pool comme promesse. |
| Interdits | Ne pas laisser croire que quick couvre les questions riches ou la redaction. |

## QCM complet

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux m'entrainer serieusement avec des questions variees. |
| Contenu cible | 6, 10 ou 13 questions riches. |
| Types | Single choice, multiple choice, matching, ordering, case qualification, error detection, timeline, date slider, true/false grid, cause/consequence, institution matrix, diagram labeling, calculation MCQ. |
| Image choice | Disponible techniquement, mais a garder optionnel si le contenu visuel n'est pas fiable. |
| Entree | Carte `QCM complet` depuis le cours apres `MODE-01`/`RICH-01`. |
| Donnees | Rich closed exercise existant. |
| Resultat | Resultat rich closed existant. |
| Historique | Historique rich closed existant, expose comme `QCM complet`. |
| Interdits | Ne pas melanger avec `Preparation examen`. |

## Revision approfondie

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux rediger et recevoir une correction detaillee. |
| Contenu cible | Question ouverte, reponse longue, correction IA, score si disponible, points reussis, points manquants, erreurs, reponse modele, conseils, sources. |
| Entree | Carte `Revision approfondie` depuis le cours apres `DEEP-01A`. |
| Donnees | Open question existant, evaluation IA existante, session `DEEP` a finaliser. |
| Resultat | A construire dans `DEEP-01B`. |
| Historique | A construire dans `DEEP-01B`. |
| Interdits | Ne pas reduire deep a une fiche ou a un QCM. |

## Preparation examen - QCM

| Champ | Contrat |
| --- | --- |
| Nom temporaire | `Preparation examen - QCM`. |
| Promesse | Je veux un entrainement examen court, actuellement limite aux QCM. |
| Contenu actuel | QCM simples issus du pool quick, session `EXAM`, resultat/historique exam. |
| Entree | Page `Preparation examen` existante, wording a clarifier dans `MODE-01`. |
| Donnees | Question bank quick, `DIAGNOSTIC_QUIZ`, routes exam preparation. |
| Resultat | Resultat exam existant, score serveur. |
| Historique | Historique exam existant. |
| Interdits | Ne pas pretendre que ce mode contient deja QCM riche + question ouverte. |

## Preparation examen mixte

| Champ | Contrat |
| --- | --- |
| Lot | `EXAM-02A`, `EXAM-02B`, `EXAM-02C`. |
| Promesse cible | Je veux simuler un entrainement global proche d'un sujet. |
| Contenu cible | Section QCM simple, section questions riches, section question ouverte, resultat global, historique examen. |
| Donnees | Quick pool, rich closed, open question/deep. |
| Resultat | Score serveur agrege, detail par section. |
| Interdits | Ne pas le lancer avant `RICH-01` et `DEEP-01B`. |
