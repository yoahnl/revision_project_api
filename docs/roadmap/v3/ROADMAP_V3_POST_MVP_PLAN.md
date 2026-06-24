# Roadmap V3 post-MVP - Neralune

Version canonique commune API/App. Ce fichier est miroir de `revision_project_app/docs/roadmap/v3/ROADMAP_V3_POST_MVP_PLAN.md`; toute mise à jour doit rester synchronisée dans les deux repos.

Baselines auditées le 2026-06-24 :

| Repo | Baseline |
| --- | --- |
| API | `4e0f0c398b6faddd11465362a3720246c9c79a72` |
| App | `467b6c18ed66b71a614bca35be11fa4079cebf22` |

## 1. État actuel du MVP

Le MVP core est considéré fermé après `CORE-09`, `CORE-10`, `CORE-11`, `RELEASE-01A` et `RELEASE-01`. Le smoke MVP complet a été confirmé manuellement par l'opérateur humain du projet. Cette V3 ne relance pas le MVP : elle organise la suite produit de Neralune.

État vérifié dans les trackers V2 :

- App : `STAB-01`, `STAB-02`, `CORE-09`, `CORE-10`, `CORE-11`, `RELEASE-01` sont à `DONE`.
- API : `CORE-09`, `CORE-10`, `CORE-11`, `RELEASE-01` sont à `DONE`; les lignes `STAB-01` et `STAB-02` restent historiquement orientées App dans le tracker API V2 et ne doivent pas être reprises comme dette V3.
- `RELEASE-01A` a servi de gate runtime et de smoke MVP. Il ne vaut pas release publique App Store.

## 2. Ce qui est considéré stable

- Lifecycle source, cours et matière : archive/delete safe, stockage et cleanup couverts par `CORE-09`.
- Banque de questions quick : readiness asynchrone, préparation course-level, sélection multi-KU, concurrence et métriques couverts par `CORE-10`.
- Sessions quick : démarrage, draft, reprise, complétion, résultat et historique couverts par `CORE-11`.
- UI MVP : navigation principale, parcours canonique, détail cours, fiche V0, progression, sources, historique et résultat sont stabilisés côté App.
- Contrats existants utiles : sources/chunks, `KnowledgeUnit`, `QuestionBankItem`, `Question`, sources et visuels de question, `RevisionSession`, `RevisionSessionAction`, draft answers, flags de question de session.
- Surfaces déjà présentes : rich closed activities, widgets single/multiple et autres types riches, page Today, contrôleur coach/next-action, routes result/history.

## 3. Ce qui est volontairement incomplet

- QCM complet post-MVP : les briques rich closed existent, mais le produit n'est pas traité comme un mode QCM complet stable dans les sessions, résultats et historiques.
- Préparation examen : les modes `EXAM` existent dans les modèles, mais la préparation examen complète n'est pas un parcours canonique validé.
- Révision approfondie : les modes `DEEP` et open question existent partiellement, mais le lifecycle/result deep réel reste à construire.
- Fiches complètes : la fiche V0/course-level existe; les fiches complètes, mieux sourcées et plus pédagogiques restent post-MVP.
- Quality du pool : flags, doublons, quotas adaptatifs et remplacement progressif des mauvaises questions ne sont pas un système qualité complet.
- Today/coach adaptatif : des fondations existent, mais la recommandation quotidienne n'est pas encore le cerveau produit principal.
- Rena : mascotte, animations d'attente, réactions et micro-interactions ne font pas partie du MVP fermé.
- Release publique : TestFlight, App Store, privacy, screenshots, versioning et checklist distribution restent à faire.

## 4. Objectifs post-MVP

1. Restaurer ou reconstruire proprement un QCM riche, clair et corrigé.
2. Créer une préparation examen distincte, testable et historisée.
3. Ajouter une révision approfondie réelle sans casser le quick MVP.
4. Compléter les fiches de cours avec sources, structure pédagogique et lecture utile.
5. Améliorer la qualité du pool de questions après stabilisation des modes de pratique.
6. Polir l'expérience release sans ajouter de feature déguisée.
7. Introduire Rena comme identité émotionnelle séparée des lots fonctionnels critiques.
8. Faire de Today/coach un guide adaptatif fiable, après consolidation des données.
9. Préparer une release publique contrôlée.

## 5. Horizons produit

| Horizon | Intention | Lots principaux |
| --- | --- | --- |
| H1 - Questions et examen | Retrouver une pratique riche et un mode examen crédible. | `PLUS-02A`, `PLUS-02B`, `PLUS-03A`, `PLUS-03B` |
| H2 - Profondeur pédagogique | Étendre la valeur d'apprentissage au-delà du quick. | `PLUS-01A`, `PLUS-01B`, `PLUS-04A`, `PLUS-04B` |
| H3 - Qualité et polish | Rendre l'existant plus fiable, lisible et publiable. | `QUALITY-01A`, `QUALITY-01B`, `POLISH-01A`, `POLISH-01B` |
| H4 - Identité et adaptation | Ajouter personnalité, coaching et continuité. | `IDENTITY-01A`, `IDENTITY-01B`, `ADAPT-01A`, `ADAPT-01B` |
| RELEASE | Préparer la distribution publique. | `RELEASE-02A` |

## 6. Ordre recommandé des chantiers

1. `PLUS-02A` - QCM complet / rich questions recovery.
2. `PLUS-02B` - QCM result/correction/history integration.
3. `PLUS-03A` - Exam preparation V1 foundations.
4. `PLUS-03B` - Exam preparation session/result/history.
5. `PLUS-01A` - Deep revision course-level open question.
6. `PLUS-01B` - Deep revision lifecycle/result.
7. `PLUS-04A` - Fiches complètes course-level V1.
8. `PLUS-04B` - Fiches complètes sources, navigation et état vide.
9. `QUALITY-01A` - Question pool audit & duplicate detection design.
10. `QUALITY-01B` - Flag system redesign.
11. `POLISH-01A` - MVP UX cleanup.
12. `POLISH-01B` - Empty states, errors, loaders, wording.
13. `IDENTITY-01A` - Rena mascot integration design.
14. `IDENTITY-01B` - Rena animation implementation.
15. `ADAPT-01A` - Today recommendation foundations.
16. `ADAPT-01B` - Today UI and coach.
17. `RELEASE-02A` - TestFlight/App Store preparation.

Justification de l'ordre : le QCM riche redevient le socle pédagogique prioritaire, car la préparation examen dépend de questions riches, de corrections propres et de résultats fiables. La qualité du pool arrive seulement après QCM/examen, sinon elle optimise une cible instable. Rena et Today sont séparés des lots critiques pour éviter de mélanger identité, animations et logique d'apprentissage.

## 7. Dépendances entre lots

| Lot | Dépend de | Dépendance produit |
| --- | --- | --- |
| `PLUS-02A` | MVP core fermé | Réutiliser sources, knowledge units, question bank et rich closed existants sans changer prompts/providers pendant le lot documentaire. |
| `PLUS-02B` | `PLUS-02A`, `CORE-11B` | Intégrer résultats, correction et historique sans rouvrir le quiz terminé. |
| `PLUS-03A` | `PLUS-02A` | Définir le mode examen sur des questions riches stabilisées. |
| `PLUS-03B` | `PLUS-03A`, `PLUS-02B`, `CORE-11B` | Persister session/result/history examen. |
| `PLUS-01A` | `CORE-10A`, `CORE-11A` | Démarrer une deep revision ouverte course-level sans résultat complet. |
| `PLUS-01B` | `PLUS-01A`, `CORE-11B` | Ajouter completion, résultat et historique deep. |
| `PLUS-04A` | `CORE-09A`, study artifacts existants | Construire une fiche complète course-level sans inventer de sources. |
| `PLUS-04B` | `PLUS-04A` | Améliorer navigation, citations et états fiche. |
| `QUALITY-01A` | `PLUS-02B`, `PLUS-03B` | Auditer doublons, quotas et similarité sur des modes stabilisés. |
| `QUALITY-01B` | `QUALITY-01A` | Redessiner flags et remplacement progressif. |
| `POLISH-01A` | `PLUS-02B`, `PLUS-03B` | Nettoyer l'UX après stabilisation des parcours lourds. |
| `POLISH-01B` | `POLISH-01A` | Uniformiser erreurs, loaders, empty states et wording. |
| `IDENTITY-01A` | `POLISH-01A` | Designer Rena sans masquer les dettes UX. |
| `IDENTITY-01B` | `IDENTITY-01A`, `POLISH-01B` | Implémenter animations une fois les états stabilisés. |
| `ADAPT-01A` | `QUALITY-01A`, `PLUS-01B` | Recommander à partir de données fiables. |
| `ADAPT-01B` | `ADAPT-01A`, `IDENTITY-01A` | Brancher UI Today/coach avec personnalité cohérente. |
| `RELEASE-02A` | `POLISH-01B`, décision produit sur scope public | Préparer TestFlight/App Store sans mélanger feature work. |

## 8. Risques

- Big bang QCM/examen : risque réduit en séparant QCM recovery, intégration résultat, fondations examen et historique examen.
- Régression quick MVP : chaque lot doit préserver quick revision, history et result existants.
- Qualité IA mal placée : duplicate detection, flags et quotas ne doivent pas précéder la stabilisation des modes.
- Confusion V1/V2/V3 : V1 et V2 restent historiques; V3 est la source de reprise post-MVP.
- Dette UI masquée par Rena : la mascotte ne doit pas cacher loaders, erreurs ou états vides.
- Secrets/release : TestFlight/App Store ne doit jamais documenter de secret réel.
- Worktree API sale : les changements IA non commités observés pendant l'audit ne font pas partie de V3.

## 9. Non-objectifs

- Aucun commit, push, merge, rebase, tag ou déploiement dans ce lot documentaire.
- Aucun changement code produit, UI, prompts IA, providers IA, Prisma ou migrations.
- Pas de refactor.
- Pas d'ajout de feature pendant la création V3.
- Pas de suppression ou réécriture destructive de la roadmap V2.
- Pas de GenUI arbitraire post-MVP dans l'ordre prioritaire V3; tout retour GenUI devra rester contrôlé et faire l'objet d'une décision dédiée.

## 10. Critères de succès

- Les documents V3 existent dans les deux repos.
- Les trackers V3 utilisent seulement `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.
- Le prochain lot recommandé est explicite : `PLUS-02A`.
- L'ordre post-MVP est clair et justifié.
- Les lots sont petits ou moyens, testables et revertables.
- Aucun code produit n'est modifié.
- La V2 reste conservée.
- `git diff --check` passe dans l'API et dans l'App.
