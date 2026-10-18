# L7 — Livraison durable

**Statut de préparation : proposé à la révision de référence.** L’avancement effectif se vérifie dans les PR et les preuves ci-dessous ; cette fiche seule ne prouve aucun changement livré. Base de l’audit : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3` ; revalider la révision avant exécution. Responsable et réviseur : à attribuer.

[Plan et contrats communs](../README.md) · [Audit source](https://github.com/KcivazB/rocket-tracker/issues/2)

## Rattachement et objectif

Epic **E4** ; stories **US-08, US-09**. Rendre récupérable l’intention d’envoi d’un résultat sauvegardé pour un serveur configuré.

Dépendances : Contrat L0 identité/destination et garantie décidée ; ne dépend pas du refactor complet.

Périmètre : Choisir transaction résultat+outbox ou réconciliation ; migration des files/rejets/mises à l’écart.

## Documentation avant, pendant et après

**Avant le code :** Décision de garantie et schéma ; destination serveur+compte, révision et migration/recovery. Destination ambiguë : conservation sans envoi automatique.

**Dans la PR d’implémentation :** Mettre à jour docs/ARCHITECTURE.md, docs/SELF_HOSTING.md et aide de reprise ; documenter nouvelles migrations et limites de downgrade. Les chemins cités sont des cibles documentaires ; cette fiche ne modifie pas leur contenu actuel. Une conception proposée ne remplace pas la documentation du fonctionnement livré.

**Après vérification :** joindre révision, scénarios, commandes/résultats exacts, limites et liens PR/artefact s’ils existent. Mettre à jour la matrice epic→US→lot→preuve et conserver les décisions/hypothèses ouvertes. Aucun résultat n’est acquis à la création de cette fiche.

## Critères de passage

Crash avant/après commit/ack, restart, migration rejouée, token, serveur/compte et ancien ack testés ; sources conservées jusqu’au transfert durable vérifié.

Revue architecture, impact joueur et exploitation ; ajouter la frontière sécurité lorsqu’elle est concernée. Vérifier les liens/commandes documentés. Une proposition, une intégration et une release restent des états distincts.

## Prochaine action

Décider la garantie et le traitement des anciennes entrées dont le compte historique est inconnu.

