# L5–L7 — Cas d’usage, composition et livraison durable

État : implémenté dans la proposition ; intégration et qualification Windows
natives à vérifier dans la PR. E3/E4, US-02/08/09 et US-11. Les besoins/personas
restent des hypothèses du plan, sans validation utilisateur inventée.

## Contrat avant code

- Le tracker consomme des observations domaine ; les DTO restent dans Stats API.
- Record local et Ingest serveur sont deux parcours distincts, scoped explicitement.
- Un enregistrement avec destination configurée et son intention sont atomiques.
- Destination : URL, installation serveur, compte authentifié. Secret ≠ identité.
- Une absence d’identité retient l’intention. Pas de réattribution implicite.
- L’acquittement porte sur la révision lue ; rejeu idempotent après panne réseau.
- Arrêter et joindre la capture, flush tracker, tentative d’envoi bornée, joindre
  l’agent, fermer SQLite, libérer le verrou puis redémarrer après update.

## Réalisation et documentation durable

`internal/application` définit les ports étroits et les quatre cas d’usage.
SQLite implémente les écritures atomiques et le journal v8. Le worker vérifie
l’identité avant chaque lot de 100. Le timer local utilise RecordTraining.
L’entrée Windows délègue à `internal/desktopapp`. Les fichiers Windows et tests
sont exclus du build portable par leur suffixe ; CI Windows teste `./...`.

[Architecture](../../ARCHITECTURE.md), [ADR-0001](../../decisions/0001-architecture-hexagonale.md),
[ADR-0002](../../decisions/0002-livraison-durable.md), [opérations](../../OPERATIONS.md)
portent les contrats et la récupération. Les sources anciennes restent intactes.
Une rétrogradation exige le backup pré-migration ; un ancien binaire ignore v8.

## Scénarios et preuves reproductibles

- `go test ./internal/application ./internal/store ./internal/agent ./internal/server` :
  port échoué sans notification, validation avant persistance, rollback sur panne
  du journal, rejeu, ancienne révision, autre destination, états held/rejected,
  migration v7, copies legacy rejouables, panne serveur, rotation même compte,
  autre compte à même URL. Les tests utilisent des bases et serveurs synthétiques.
- Compilation Windows : `CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build .`.
- Tests bureau : `go test ./internal/desktopapp` sur Windows ; ailleurs,
  `GOOS=windows GOARCH=amd64 go test -c ./internal/desktopapp` compile seulement.
- Restauration cohérente : test isolé et runbook L10 ; pas de RPO/RTO inventé.

Une compilation croisée n’exécute pas tray/autostart/élévation/restart. Une
qualification interactive Windows avec jeu réel et fournisseur OIDC de
production reste une preuve externe séparée ; elle ne doit pas être cochée sur
la seule base des fixtures synthétiques. Aucun merge/release/deploy autorisé.

## Revue et retrait

Principal : frontières vérifiées par imports et tests de ports/transactions.
Produit : historique local préservé, compteur de livraison et récupération
explicite ; les changements de compte ne déplacent pas les données.
SRE : rollback, rejeu, migration conservatrice et backup arrêté ; le matériel,
l’IdP et les surfaces interactives demandent leur qualification propre.

Avant retrait de cette fiche temporaire, reporter les preuves finales et
limites dans la PR/issue ; conserver les contrats dans les guides et ADR.
