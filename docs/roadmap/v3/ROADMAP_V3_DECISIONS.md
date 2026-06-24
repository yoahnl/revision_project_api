# Roadmap V3 decisions - Neralune post-MVP

Version commune API/App. Miroir attendu côté App : `revision_project_app/docs/roadmap/v3/ROADMAP_V3_DECISIONS.md`.

| Décision | Statut | Date | Raison | Conséquence |
| --- | --- | --- | --- | --- |
| DEC-V3-001 - La V3 est une roadmap post-MVP, pas une réouverture du MVP core. | ACCEPTED | 2026-06-24 | CORE-09/10/11 et RELEASE-01 sont fermés, smoke MVP confirmé manuellement. | Les lots V3 partent de l'état stable et ne modifient pas les trackers V2. |
| DEC-V3-002 - Les documents V3 sont dupliqués dans API et App comme miroirs synchronisés. | ACCEPTED | 2026-06-24 | Les lots post-MVP traversent les deux repos. | Aucun repo ne dépend d'un document caché dans l'autre; les mises à jour doivent rester synchrones. |
| DEC-V3-003 - `PLUS-02A` est le prochain lot recommandé. | ACCEPTED | 2026-06-24 | La préparation examen dépend de questions riches, sources, correction et résultats fiables. | Codex doit commencer par QCM complet / rich questions recovery. |
| DEC-V3-004 - QCM complet et préparation examen sont séparés. | ACCEPTED | 2026-06-24 | Les mélanger ferait un lot trop gros et difficilement revertable. | `PLUS-02A/B` précèdent `PLUS-03A/B`. |
| DEC-V3-005 - La qualité du question pool attend la stabilisation QCM/examen. | ACCEPTED | 2026-06-24 | Détecter doublons, quotas et flags avant le produit cible créerait du churn. | `QUALITY-01A/B` dépend de `PLUS-02B` et `PLUS-03B`. |
| DEC-V3-006 - Révision approfondie reste distincte du QCM et de l'examen. | ACCEPTED | 2026-06-24 | Deep revision a une logique ouverte, corrective et de lifecycle propre. | `PLUS-01A/B` arrive après le socle QCM/examen. |
| DEC-V3-007 - Fiches complètes deviennent `PLUS-04`. | ACCEPTED | 2026-06-24 | La V2 mélangeait fiche complète et exam modes sous `PLUS-02`; la V3 réserve `PLUS-02` au QCM. | Les fiches complètes sont visibles dans les trackers sans grossir QCM/exam. |
| DEC-V3-008 - Rena est un chantier identité séparé. | ACCEPTED | 2026-06-24 | Mascotte, animations et micro-interactions ne doivent pas retarder les lots pédagogiques critiques. | `IDENTITY-01A/B` démarre après polish initial. |
| DEC-V3-009 - Today/coach adaptatif attend des données plus fiables. | ACCEPTED | 2026-06-24 | Un coach utile dépend de résultats, historique, qualité et signaux de maîtrise. | `ADAPT-01A/B` est placé après quality/deep foundations. |
| DEC-V3-010 - Release publique est `RELEASE-02`, pas `RELEASE-01`. | ACCEPTED | 2026-06-24 | `RELEASE-01` a validé le runtime MVP, pas TestFlight/App Store. | `RELEASE-02A` couvre checklist publique sans déploiement automatique. |
| DEC-V3-011 - Les statuts V3 sont strictement bornés. | ACCEPTED | 2026-06-24 | Les trackers doivent rester lisibles et comparables. | Seuls `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED` sont autorisés. |
| DEC-V3-012 - GenUI arbitraire est hors ordre prioritaire V3. | ACCEPTED | 2026-06-24 | Les surfaces contrôlées existent historiquement, mais les priorités post-MVP sont QCM, exam, deep, qualité, polish, identité et coach. | Tout retour GenUI devra être cadré dans une décision dédiée. |
| DEC-V3-013 - Après `PLUS-02A`, le prochain lot recommandé est `PLUS-02B`. | ACCEPTED | 2026-06-24 | `PLUS-02A` a borné le contrat et le rendu rich closed, mais le parent `PLUS-02` reste incomplet sans result/correction/history produit. | Ne pas démarrer `PLUS-03A` avant d'avoir durci le résultat et l'historique QCM riche. |
| DEC-V3-014 - `image_choice` reste reporté comme support produit visuel complet. | ACCEPTED | 2026-06-24 | Le type existe techniquement côté API/App, mais l'app n'a pas encore d'assets inspectables branchés. | Le contrat peut rester testé, mais la promesse de visuels réels attend un lot dédié ou `PLUS-02B` si le scope l'autorise. |
