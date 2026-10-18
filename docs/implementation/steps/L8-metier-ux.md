# L8 — Métier et états UX

**Statut de préparation : proposé à la révision de référence.** L’avancement effectif se vérifie dans les PR et les preuves ci-dessous ; cette fiche seule ne prouve aucun changement livré. Base de l’audit : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3` ; revalider la révision avant exécution. Responsable et réviseur : à attribuer.

[Plan et contrats communs](../README.md) · [Audit source](https://github.com/KcivazB/rocket-tracker/issues/2)

## Rattachement et objectif

Epic **E5** ; stories **US-01, US-03 à US-07, US-10**. Corriger le bon profil, les populations et les messages sans promettre une causalité sportive.

Dépendances : Cas L0 encore reproduit ; décision propre à la métrique ou à la visibilité si nécessaire.

Périmètre : Une PR par invariant ; commencer absence/identité puis éligibilité/prédicats/aide ; M-04 exige unité qualifiée.

## Documentation avant, pendant et après

**Avant le code :** Story, fixture et contrat de mesure (unité/population/dénominateur/effectif) ; maquette des états utiles.

**Dans la PR d’implémentation :** Mettre à jour docs/SPEC.md, aide FR/EN et contrat d’identité/partage ; garder la justification dans une décision. Les chemins cités sont des cibles documentaires ; cette fiche ne modifie pas leur contenu actuel. Une conception proposée ne remplace pas la documentation du fonctionnement livré.

**Après vérification :** joindre révision, scénarios, commandes/résultats exacts, limites et liens PR/artefact s’ils existent. Mettre à jour la matrice epic→US→lot→preuve et conserver les décisions/hypothèses ouvertes. Aucun résultat n’est acquis à la création de cette fiche.

## Critères de passage

Fixture et voisins vérifiés ; profil correct et états local/en attente/livré explicites ; DOM/notifications/jeu annoncés selon preuve réelle.

Revue architecture, impact joueur et exploitation ; ajouter la frontière sécurité lorsqu’elle est concernée. Vérifier les liens/commandes documentés. Une proposition, une intégration et une release restent des états distincts.

## Prochaine action

Sélectionner un cas requalifié et convenir de son oracle avant de modifier le calcul.

