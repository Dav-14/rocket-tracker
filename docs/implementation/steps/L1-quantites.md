# L1 — Validation des quantités

**Statut de préparation : proposé à la révision de référence.** L’avancement effectif se vérifie dans les PR et les preuves ci-dessous ; cette fiche seule ne prouve aucun changement livré. Base de l’audit : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3` ; revalider la révision avant exécution. Responsable et réviseur : à attribuer.

[Plan et contrats communs](../README.md) · [Audit source](https://github.com/KcivazB/rocket-tracker/issues/2)

## Rattachement et objectif

Epic **E1** ; stories **US-02, US-09**. Empêcher la persistance des durées/compteurs impossibles sans invalider absence, zéro ou grandeurs signées légitimes.

Dépendances : Contrat L0 relatif aux quantités ; coordination avec L2 sur les handlers.

Périmètre : Validation, upload/import et store concernés ; pas de refactor global préalable.

## Documentation avant, pendant et après

**Avant le code :** Table champs/unités/absence/zéro/signé, rejet attendu et frontière d’atomicité d’import.

**Dans la PR d’implémentation :** Mettre à jour docs/SPEC.md et l’aide d’ingestion nécessaire avec les règles effectivement livrées. Les chemins cités sont des cibles documentaires ; cette fiche ne modifie pas leur contenu actuel. Une conception proposée ne remplace pas la documentation du fonctionnement livré.

**Après vérification :** joindre révision, scénarios, commandes/résultats exacts, limites et liens PR/artefact s’ils existent. Mettre à jour la matrice epic→US→lot→preuve et conserver les décisions/hypothèses ouvertes. Aucun résultat n’est acquis à la création de cette fiche.

## Critères de passage

Test du refus authentifié sans nouvel effet DB ; données partielles/anciennes et positions signées acceptées ; scope/rejeu/abandon→final conservés.

Revue architecture, impact joueur et exploitation ; ajouter la frontière sécurité lorsqu’elle est concernée. Vérifier les liens/commandes documentés. Une proposition, une intégration et une release restent des états distincts.

## Prochaine action

Construire le test du résultat attendu à partir de S1 et vérifier l’échec initial.


## Retrait de cette fiche temporaire

Avant retrait, conserver les décisions et leurs compromis dans les [ADR](../../decisions/0004-validite-et-disponibilite-des-mesures.md), les contrats livrés dans le [guide concerné](../../SPEC.md), et les scénarios, commandes, résultats et limites dans la PR ou l’issue de suivi. Rattacher les besoins/personas validés à la documentation produit. Vérifier les liens entrants et reporter toute tâche ou décision ouverte ; cette fiche ne se supprime pas tant qu’elle porte une information nécessaire non transférée.
