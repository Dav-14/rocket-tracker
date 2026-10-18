# L9 — Version unique injectée au build

**État : implémenté et vérifié localement.** La PR porte l’état de revue et d’intégration ; aucune release n’est démontrée. Tranche limitée au contrat de version, pas à la refonte de livraison L9. Checkout dédié `rocket-tracker-version-delivery`, branche `fix/build-version`, base vérifiée `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3`, propre au début du lot, 18 octobre 2026. La revue indépendante reste distincte des preuves d’exécution ci-dessous.

## Contrat et choix explicite

La demande utilisateur remplace l’ancienne consigne de deux littéraux numérotés et de suffixes de version dans les commits. Une seule variable existe : `internal/buildinfo.Version`, initialisée à `dev`. Les deux exécutables l’utilisent directement ; aucune détection Git, génération, nouvelle dépendance ou automatisation de bump.

| Chemin de build | Version rapportée |
| --- | --- |
| `go build` sans injection | `dev` |
| `build.ps1` sans `-Version` (GUI ou console, serveur facultatif) | `dev` |
| `build.ps1 -Version 1.2.3` | `1.2.3`, les deux exécutables |
| Release d’un tag `v1.2.3` | `1.2.3`, les deux exécutables |
| Docker sans argument `VERSION`, notamment build de branche | `dev` |
| Docker avec `VERSION=1.2.3`, notamment tag `v1.2.3` | `1.2.3` |

Le symbole linker devient `rocket-tracker/internal/buildinfo.Version`. Les scripts externes utilisant l’ancien `main.Version` doivent migrer : une cible `-X` inexistante peut être ignorée sans échec de build et laisser `dev`. Vérifier ensuite `rltracker version` ou `rltracker-server --version`. Aucun shim ne conserve l’ancien symbole.

L’updater desktop existant quitte déjà `Checker.Run` avant toute requête quand la version courante n’est pas un `x.y.z` numérique. Ainsi `dev` ne consulte pas les releases et ne propose pas de mise à jour automatique ; l’injection d’une version numérique réactive le mécanisme habituel. Aucune logique d’updater de production n’a été changée.

## Surface et ownership

| Fichiers | Changement |
| --- | --- |
| `internal/buildinfo/buildinfo.go` | Unique variable, sans imports. |
| `main.go`, `cmd/rltracker-server/main.go` | Suppression des deux déclarations ; version CLI, HTTP et logs issue du package unique. |
| `desktop.go`, `agent_cmd.go`, `wizard.go` | Même valeur pour tray, updater, user-agent et rapports/heartbeats. Les champs `Version` des DTO restent inchangés. |
| `build.ps1`, `Dockerfile`, `.github/workflows/release.yml` | Migration du seul symbole injecté ; déclencheurs et mécanisme de publication conservés. |
| `.github/workflows/ci.yml` | Contrôles de vrais binaires : serveur Linux et desktop console Windows, simples puis injectés, avec assertion de sortie. Aucun nouveau workflow/framework. |
| `internal/update/update_test.go` | Test dev sans socket : transport interdit et notification interdite. |
| `AGENTS.md`, `docs/DEVELOPMENT.md` | Contrat courant, suppression de la règle de bump/suffixe, migration des scripts externes et comportement updater dev. |
| Cette fiche | Contrat, preuves locales et limites de la tranche. |

Writer exclusif dans ce checkout ; aucune écriture dans les autres lanes. L3/Node n’est pas importé ni modifié. Travail séquentiel pour la migration commune, puis builds Linux/Windows et tests ciblés indépendants exécutés en parallèle. Aucune mutation Git, changement de remote ou publication.

## Vérifications exécutées

Hôte macOS arm64, Go `go1.27.2`. Docker utilise la socket Unix locale OrbStack ; daemon Linux/arm64. Image de support déjà présente `docker:27.5.1-cli`, lancée avec un entrypoint remplacé par le seul binaire `--version`, sans réseau, filesystem racine en lecture seule, aucune capacité Linux et aucun service démarré.

Avant correction : build Linux/arm64 du serveur de base et exécution `--version` dans ce conteneur : **`0.20.1`**, donc non conforme au nouveau défaut `dev`.

Commandes de compilation exécutées depuis la racine, sorties temporaires hors dépôt :

```sh
mkdir -p /tmp/rocket-tracker-version-check

GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -o /tmp/rocket-tracker-version-check/server-dev ./cmd/rltracker-server
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags '-X rocket-tracker/internal/buildinfo.Version=1.2.3' -o /tmp/rocket-tracker-version-check/server-injected ./cmd/rltracker-server

GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags '-s -w' -o /tmp/rocket-tracker-version-check/server-linux-amd64-dev ./cmd/rltracker-server
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags '-s -w -X rocket-tracker/internal/buildinfo.Version=1.2.3' -o /tmp/rocket-tracker-version-check/server-linux-amd64-injected ./cmd/rltracker-server

GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags '-H windowsgui -s -w' -o /tmp/rocket-tracker-version-check/desktop-dev.exe .
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags '-H windowsgui -s -w -X rocket-tracker/internal/buildinfo.Version=1.2.3' -o /tmp/rocket-tracker-version-check/desktop-injected.exe .
```

Les six builds ont réussi. `file` confirme les serveurs amd64 ELF statiques et les deux desktop PE32+ GUI x86-64. Les quatre binaires Linux ont été exécutés uniquement avec `--version` : valeurs observées **`dev` et `1.2.3`** sur arm64 et amd64 (compatibilité amd64 fournie par OrbStack, pas un hôte physique amd64). Exemple exact pour arm64 ; même commande avec les noms `server-linux-amd64-dev` et `server-linux-amd64-injected` pour amd64 :

```sh
docker run --rm --pull=never --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges -v /tmp/rocket-tracker-version-check:/version-check:ro --entrypoint /version-check/server-dev docker:27.5.1-cli --version
docker run --rm --pull=never --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges -v /tmp/rocket-tracker-version-check:/version-check:ro --entrypoint /version-check/server-injected docker:27.5.1-cli --version
```

Pour amd64, une boucle shell a aussi comparé chaque sortie à la valeur attendue avec `test`, code de sortie 0. Aucun exécutable Windows lancé ; compilation croisée uniquement.

```sh
go test ./internal/update -count=1 -v -timeout=60s
go test ./cmd/rltracker-server ./internal/buildinfo -count=1
go vet ./internal/update ./internal/buildinfo ./cmd/rltracker-server
git diff --check
```

Résultats : **PASS**. `TestDevCheckerDoesNotRequest` retourne sans solliciter le transport et sans annoncer de release ; les tests updater existants passent aussi (leurs serveurs httptest sont locaux). Les packages main serveur/buildinfo n’ont pas de tests unitaires propres ; la preuve d’injection porte sur les exécutables construits et exécutés, pas un test tautologique de constante.

Les deux workflows modifiés ont été parsés avec Ruby YAML, et leurs blocs `run` vérifiés avec `bash -n` : **PASS syntaxique**. Recherche des cibles et consignes courantes : plus de `-X main.Version` exécuté ni de littéral numéroté dans les mains ; l’ancien nom ne reste que dans l’explication de migration. `gofmt` appliqué aux fichiers Go modifiés.

## Vérification complémentaire du coordinateur

Sur macOS arm64 : tests updater/buildinfo/main serveur, puis server/agent avec `-count=1`, et vet updater/buildinfo/main serveur : PASS. Deux builds serveur natifs exécutés avec `--version` annoncent respectivement `dev` sans injection et `1.2.3` avec `-X rocket-tracker/internal/buildinfo.Version=1.2.3`. Les liens documentaires, l’absence de déclaration Version dans les deux mains et les cibles des producteurs ont été vérifiés.

## Auto-revue et limites de handoff

| Angle analytique | Conclusion locale | Objection et limite |
| --- | --- | --- |
| Principal Engineer | PASS sur le contrat de version | Ancien symbole incompatible avec les scripts externes : migration explicitement documentée, vérification de sortie nécessaire. Unique package sans dépendance ; tous les usages des deux mains migrés. |
| Product Engineer | PASS sur les sorties vérifiées | Une compilation ordinaire devient `dev` et ne propose plus d’auto-update ; c’est le nouveau choix utilisateur, pas une régression dissimulée. Sorties CLI Linux prouvées, tray/UI Windows non exécutés. |
| SRE | PASS local borné | Oublier une injection produit `dev` ; la CI ajoute un contrat sur les deux valeurs attendues, mais aucun workflow distant exécuté. Les déclencheurs Release/Docker ne sont pas refondus. |

PowerShell non disponible : `build.ps1` n’a pas été exécuté. Pas de build d’image via le Dockerfile, de CI GitHub, de publication, d’update réel, de tests Windows natifs ou de parcours application. Les éditions Dockerfile/release ont été relues ; elles ne constituent pas une qualification distante. Le reste de L9 (artefacts immuables, chaîne de release complète) reste hors périmètre.

Cette auto-revue ne remplace pas les lectures indépendantes du coordinateur/Copernicus. Après vérification finale, fichiers stables et writer quiescent ; l’intégration et la livraison restent au coordinateur.

## Retrait de cette fiche temporaire

Conserver le contrat livré et les commandes dans [DEVELOPMENT](../../DEVELOPMENT.md) et [AGENTS](../../../AGENTS.md). La décision durable et les compromis vont dans ADR-0003 (proposé dans la [PR #3](https://github.com/KcivazB/rocket-tracker/pull/3)). Avant retrait, transférer les preuves et limites dans la PR et l’issue #2 ; garder les autres travaux L9 ouverts. Le code et les ADR restent conservés.

## Revue indépendante

Principal Engineer, Product Engineer et SRE : PASS sur ce lot isolé. Le réviseur a exécuté les tests updater, un serveur Linux arm64 par défaut (`dev`), injecté avec `9.8.7` (`9.8.7`) et construit avec l’ancien `-X main.Version=9.8.7` (build réussi mais sortie `dev`), en conteneur OrbStack sans réseau. Il a aussi compilé le desktop Windows en modes simple/injecté, sans l’exécuter. Le piège de migration est donc reproduit ; aucun test CI de l’ancien symbole n’est ajouté. PowerShell et build réel du Dockerfile restent non exécutés.
