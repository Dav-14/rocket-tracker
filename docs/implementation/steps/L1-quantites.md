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

