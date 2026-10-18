# L2 — Enveloppe JSON

**Statut de préparation : proposé à la révision de référence.** L’avancement effectif se vérifie dans les PR et les preuves ci-dessous ; cette fiche seule ne prouve aucun changement livré. Base de l’audit : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3` ; revalider la révision avant exécution. Responsable et réviseur : à attribuer.

[Plan et contrats communs](../README.md) · [Audit source](https://github.com/KcivazB/rocket-tracker/issues/2)

## Rattachement et objectif

Epic **E1** ; stories **US-02, US-09**. Valider une valeur JSON et l’intégralité de son enveloppe dans la borne avant persistance.

Dépendances : Contrat L0 relatif au corps ; coordination avec L1.

Périmètre : Lecture HTTP et statuts ; ni qualification réseau ni changement arbitraire de compatibilité des champs inconnus.

## Documentation avant, pendant et après

**Avant le code :** Borne, EOF, secondes valeurs, suffixes, erreurs de format/dépassement.

**Dans la PR d’implémentation :** Mettre à jour docs/SPEC.md et la section ingestion de docs/SELF_HOSTING.md avec les limites réelles. Les chemins cités sont des cibles documentaires ; cette fiche ne modifie pas leur contenu actuel. Une conception proposée ne remplace pas la documentation du fonctionnement livré.

**Après vérification :** joindre révision, scénarios, commandes/résultats exacts, limites et liens PR/artefact s’ils existent. Mettre à jour la matrice epic→US→lot→preuve et conserver les décisions/hypothèses ouvertes. Aucun résultat n’est acquis à la création de cette fiche.

## Critères de passage

Objet valide, espaces, suffixes, limite exacte/dépassée et longueur inconnue testés ; zéro écriture en erreur.

Revue architecture, impact joueur et exploitation ; ajouter la frontière sécurité lorsqu’elle est concernée. Vérifier les liens/commandes documentés. Une proposition, une intégration et une release restent des états distincts.

## Prochaine action

Transformer S2 en test qui exige le rejet, avec contrôle d’absence de persistance.


## Retrait de cette fiche temporaire

Avant retrait, conserver les décisions et leurs compromis dans les [ADR](../../decisions/README.md), les contrats livrés dans le [guide concerné](../../SPEC.md), et les scénarios, commandes, résultats et limites dans la PR ou l’issue de suivi. Rattacher les besoins/personas validés à la documentation produit. Vérifier les liens entrants et reporter toute tâche ou décision ouverte ; cette fiche ne se supprime pas tant qu’elle porte une information nécessaire non transférée.
