# L4 — Modèles de partie et frontière Tilt

Fiche temporaire de préparation et de preuves, à retirer après transfert des
informations utiles. Elle ne constitue ni un ADR accepté ni une nouvelle
politique d'architecture.

- Base : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3`.
- Branche : `refactor/domain-models`.
- État : code et guides vérifiés localement ; la PR porte l’état d’intégration.
- Périmètre : modèles partagés et frontière Tilt uniquement.
- Revue indépendante : PASS des sources par Carver signalé par le coordinateur ;
  ce signal n'est pas une nouvelle revue des guides ou du commit d'intégration.

## Contrat et périmètre

Copie exacte des six seuls fichiers L4 de code/tests :

- `internal/domain/model.go`
- `internal/domain/model_test.go`
- `internal/domain/dependencies_test.go`
- `internal/store/model.go`
- `internal/tilt/tilt.go`
- `internal/tilt/domain_contract_test.go`

Le domaine possède les neuf types de partie et les règles `Normalize`,
`ProfileKey`, `SameProfile` ; ses imports de production sont `strings` et `time`.
Le store conserve les alias et fonctions de délégation ; Tilt consomme le modèle
du domaine. JSON, unités, identité, normalisation et règles Tilt sont conservés.
Les tests existants ne changent pas.

Les guides [d'architecture](../../ARCHITECTURE.md),
[de développement](../../DEVELOPMENT.md) et le [routage agent](../../../AGENTS.md)
décrivent cette seule frontière effective. Le contrat JSON ne change pas ;
`docs/SPEC.md` reste inchangé. Aucun dossier d'audit n'est copié.

`Training`, ses règles et sa fusion restent dans store. Le tracker et Stats API
restent inchangés : le tracker importe encore store et les DTO Stats API.
Observations, cas d'usage, composition, ingestion et outbox restent à extraire ou
traiter dans leurs lots propres. Aucun correctif M03 ou S1/S2 n'est inclus.
L'identité nominale Go des types déplacés devient celle du package domain ; la
compatibilité garantie porte sur la source et le JSON, pas sur le nom obtenu par
réflexion.

## Vérification isolée

Oracle : tests domaine/JSON/alias, toute la suite tracker originale sans filtre,
store (identité, profils, ingestion, trainings), Tilt, Stats API et clients.
Vérifications exécutées le 18 octobre 2026 dans ce checkout isolé :

```sh
go test -count=1 -cover ./internal/domain ./internal/store ./internal/tilt ./internal/tracker ./internal/statsapi ./internal/agent ./internal/server ./internal/sim ./internal/update ./cmd/rltracker-server
go test -race -count=1 ./internal/domain ./internal/store ./internal/tilt ./internal/tracker ./internal/statsapi ./internal/agent ./internal/server
go vet ./internal/domain ./internal/store ./internal/tilt ./internal/tracker ./internal/statsapi ./internal/agent ./internal/server ./cmd/rltracker-server
```

**Résultats : PASS**, sans sélection ni exclusion de tests tracker. Aucun fichier
M03 n'est présent. Couverture des statements : domaine 100,0 %, store 80,9 %,
Tilt 96,6 %, tracker 91,2 %, Stats API 82,8 %. Les tests de simulation synthétique
passent aussi ; ils ne constituent pas une session de jeu réelle.

```sh
go list -f '{{.ImportPath}}: {{join .Imports ", "}}' ./internal/domain ./internal/tilt
go list -deps -f '{{if not .Standard}}{{.ImportPath}}{{end}}' ./internal/domain ./internal/tilt
```

**Résultats :** domaine = `strings,time` ; Tilt = `domain,sort,time`.
Les seuls packages non standard dans leur graphe de production sont domain et
Tilt : aucune dépendance store/SQLite, Stats API, HTTP ou Windows.

```sh
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o /dev/null .
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /dev/null ./cmd/rltracker-server
go run ./cmd/rltracker-server --version
```

Les deux cross-builds passent. La commande serveur retourne `0.20.1` et quitte
avant de démarrer un serveur. Les deux fichiers d'entrée sont identiques à la
base : la consigne explicite conserve leurs variables Version ; les changements
de convention sont réservés à une PR dédiée. `main.Version` reste injectable
par ldflags. Ces cross-builds vérifient la compilation, pas les tests Windows.

Contrôles de livraison : `git --no-optional-locks diff --check`, `gofmt -l` sur
les fichiers Go du lot, comparaison octet par octet des six copies, empreintes
SHA-256 avant/après et vérification des liens locaux : PASS. Le manifeste du
checkout borne les écritures aux six copies, aux trois guides/routage et à cette
fiche ; aucun fichier existant n'est supprimé. `docs/SPEC.md`, Training, tracker,
Stats API, server, agent et les tests existants sont identiques à la base.

## Revue et limites

| Angle analytique | Verdict local | Objection examinée et preuve | Limites |
| --- | --- | --- | --- |
| Principal Engineer | PASS | Les alias doivent préserver les consommateurs et les imports doivent être inversés : comparaison exacte, contrats de types/JSON, suites sans filtre et graphe de production vérifiés. | Tracker/Training/observations ne sont pas extraits. |
| Product Engineer | PASS | Le déplacement ne doit changer ni identité ni absence/unité : fixtures historique/complète, profils inconnus, zéro observé et normalisation inchangée. | Aucun nouveau parcours ; rendu navigateur et jeu réel non testés. |
| SRE | PASS | Les données et les effets doivent rester inchangés : store/clients/simulation/race passent ; aucun SQL, migration ou outbox déplacé ; compilation Windows et serveur Linux réussie. | Race Go ne prouve pas absence de race SQL ; tests Windows natifs, IdP, restauration et déploiement non exécutés. |

La revue indépendante des sources par Carver est rapportée par le coordinateur.
Les guides ajoutés ici ont été relus localement ; aucune revue indépendante de
ces guides n'est revendiquée. Ce lot ne vaut pas acceptation des choix proposés
dans un ADR. L4 global reste partiel.

## Retrait de la fiche

Après intégration, conserver le fonctionnement et les commandes dans les guides
ci-dessus ; conserver les raisons et compromis durables dans ADR-0001, qui
reste **proposé dans la [PR #3](https://github.com/KcivazB/rocket-tracker/pull/3)**
tant que les mainteneurs ne l'ont pas accepté. Reporter les preuves exactes et
les limites dans la PR d'implémentation avant de retirer cette fiche. La PR de ce lot porte le suivi des preuves et tâches restantes.
Ni le code ni les ADR durables ne sont supprimés avec les fiches de travail.
Le retrait n'efface pas les couplages ou tâches encore ouverts et n'annonce
aucune release. Aucune release ou opération sur des données utilisateur ne fait partie de ces vérifications.
