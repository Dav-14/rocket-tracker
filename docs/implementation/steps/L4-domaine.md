# L4 — Domaine et observations

**Statut de préparation : proposé à la révision de référence.** L’avancement effectif se vérifie dans les PR et les preuves ci-dessous ; cette fiche seule ne prouve aucun changement livré. Base de l’audit : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3` ; revalider la révision avant exécution. Responsable et réviseur : à attribuer.

[Plan et contrats communs](../README.md) · [Audit source](https://github.com/KcivazB/rocket-tracker/issues/2)

## Rattachement et objectif

Epic **E3** ; stories **US-02, US-03, US-06**. Extraire les types/règles utiles et mapper Stats API sans dépendance du cœur aux DTO ou à SQLite.

Dépendances : Contrat L0 ; contrat L1 accepté pour les validations extraites.

Périmètre : Types store, observations, tracker/tilt utiles ; pas de duplication systématique des modèles.

## Documentation avant, pendant et après

**Avant le code :** Glossaire et diagramme de dépendances de la tranche ; absence/unités/identité et mapping.

**Dans la PR d’implémentation :** Mettre à jour docs/ARCHITECTURE.md, docs/SPEC.md et le routage agent pour la seule tranche effective. Les chemins cités sont des cibles documentaires ; cette fiche ne modifie pas leur contenu actuel. Une conception proposée ne remplace pas la documentation du fonctionnement livré.

**Après vérification :** joindre révision, scénarios, commandes/résultats exacts, limites et liens PR/artefact s’ils existent. Mettre à jour la matrice epic→US→lot→preuve et conserver les décisions/hypothèses ouvertes. Aucun résultat n’est acquis à la création de cette fiche.

## Critères de passage

Imports inspectés, tests purs et fixtures compatibles ; couplages restants nommés, aucun cycle.

Revue architecture, impact joueur et exploitation ; ajouter la frontière sécurité lorsqu’elle est concernée. Vérifier les liens/commandes documentés. Une proposition, une intégration et une release restent des états distincts.

## Prochaine action

Choisir la première règle dont l’extraction inverse une dépendance concrète.

