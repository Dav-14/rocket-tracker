# L4 — Domaine, observations et corrections M03/M04

Fiche temporaire de livraison locale, le 18 octobre 2026. Cible intégrée :
`implementation/complete-audit`, HEAD de référence
`17c9fe71df7ac9a1d8d7ffda4d205e02c263bf87`, avec modifications locales des lanes
parallèles. Cette fiche ne vaut ni acceptation d'ADR ni qualification en jeu réel.

## Frontière livrée

- `internal/domain/training.go` possède Training, Normalize, Merge, ValidFocus,
  Focuses, MaxTraining, TrainingJoin et ErrInvalidTraining. Le texte historique
  de l'erreur et son identité via l'alias store sont conservés. Normalize refuse
  aussi explicitement NaN/Inf et les unités inconnues du vocabulaire.
- `internal/domain/observations.go` contient les seuls faits consommés par le
  tracker, sans DTO JSON, décodage, transport ou persistance. Les pointeurs
  préservent absence et zéro/false observé. Les producteurs ne doivent plus
  modifier les observations après leur remise au tracker.
- `internal/domain/model.go`, `movement.go`, `speed.go` portent la disponibilité
  et l'unité ; `dependencies_test.go`, `model_test.go`, `movement_test.go` et
  `training_test.go` vérifient pureté et contrats. `model_test.go` préexistant
  reste inchangé et son fixture historique garde exactement sa forme JSON.
- `internal/tracker/tracker.go` et `movement.go` importent domain et la
  bibliothèque standard uniquement. Les tests existants sont conservés avec
  adaptation du harness au mapping. Le test d'inférence d'unité devient un
  oracle de conservation brute, conformément à M04. Son fixture voiture est
  rendu complet ; les tests M03 couvrent séparément chaque champ absent.
  Nouveaux tests : `dependencies_test.go`, `movement_test.go`,
  `observations_test.go`.
- `internal/statsapi/observations.go` et `observations_test.go` portent le
  mapping externe et ses contrats. Les fichiers de transport et de décodage
  préexistants restent inchangés par cette lane.
- `internal/store/trainings.go` conserve les noms publics comme alias/wrappers,
  délègue la fusion à domain et raccorde uniquement le hook transactionnel L7.
  `internal/store/model.go` reste inchangé.

`internal/domain/delivery.go` et `internal/store/delivery.go` sont réservés au
coordinateur. Aucun fichier main, agent, server, sim, web, CI ou guide partagé
n'est modifié par cette lane. Aucune version, opération Git ou remote modifiée.
Les modifications de ces autres surfaces visibles dans ce checkout partagé
appartiennent à leurs autres writers.

## API de composition

```go
// Core : aucun événement transport ni décodage ici.
tr.HandleEvent(domain.Observation{ /* Name et payload typé */ })

// Callback compatible avec StatsAPI Options.OnEvent :
onEvent := statsapi.ObserveEvents(tr.HandleEvent)

// Variante pour une unité source attestée, fixe pendant le flux :
onEvent = statsapi.ObserveEventsWithOptions(tr.HandleEvent,
    statsapi.ObservationOptions{SpeedUnit: domain.SpeedUUPerSecond})

// Mapping explicite, si l'appelant veut observer les erreurs :
observation, err := statsapi.ToObservation(event)
observation, err = statsapi.ToObservationWithOptions(event,
    statsapi.ObservationOptions{SpeedUnit: domain.SpeedKilometresPerHour})
```

`ObserveEvents` retourne `func(statsapi.Event)`. Les callbacks Save et
SaveTraining utilisent les types domain, identiques aux alias store.
Le coordinateur a raccordé main et les tests sim à l'adaptateur.

Le décodage conserve sa tolérance : objets ou tableaux de références de touche,
scalaires coercibles, enveloppes encodées en chaîne, champs manquants et faux
explicites. UpdateState syntaxiquement invalide est rejeté ; les autres
événements conservent l'ancien comportement de décodage partiel/par défaut.
Les payloads typés absents sont ignorés par le core. Identité, spectateur,
reconnexion, score, replay, pause et coordonnées conservent leurs règles.

Dans store : `AddTraining(ctx,t,key)` appelle
`sc.addTraining(ctx,t,key,nil)`. Le helper a exactement quatre arguments, le
quatrième étant `*domain.Destination`. Après l'écriture SQL et juste avant
`tx.Commit()`, il appelle `sc.queueTrainingDelivery(ctx,tx,t,destination)` et
propage son erreur. Transaction, sélection de la ligne cible, clés et ordre de
fusion restent inchangés. Aucun autre traitement L7 n'est ajouté ici.

## Invariants M03 et M04

M03 accepte les neuf champs voiture complets, dont HasCar vrai et Demolished
explicitement faux. Un paquet incomplet n'ajoute ni temps ni zéro supposé aux
moyennes. Une démolition explicitement observée ajoute son temps même sans
HasCar ou autre détail. Les pourcentages ont le temps voiture accepté comme
seul dénominateur ; la priorité mur avant sol est conservée.

`movement.car_sample_s` est optionnel : absent dans l'historique, positif quand
une voiture complète est observée, zéro si seule une démolition l'est. Dans ce
dernier cas, sample_s et demolished_s sont conservés et les dix moyennes ou
pourcentages voiture sont JSON null. L'aller-retour JSON conserve cette
indisponibilité. Sans aucune observation admissible, movement reste nil.
Le choix des neuf champs peut réduire la couverture de capture ; ce compromis
évite d'inventer les métriques absentes. Les floats Go restent source compatibles ;
les consommateurs Go doivent consulter CarSampleS pour distinguer indisponible
et zéro. Carver possède l'adaptation web.

M04 supprime speedFactor, ses seuils et toute conversion fondée sur l'amplitude.
Match, Training et Live exposent `speed_unit`. Les nouvelles observations sont
`unknown` par défaut ; les options acceptent aussi `uu/s` et `km/h`.
Toutes les valeurs restent brutes, quelle que soit l'unité déclarée. Aucun
rééchelonnement km/h/uu/s n'est effectué, même sur une petite valeur. Un changement
d'unité pendant une partie est refusé avec un diagnostic ; les observations d'un
flux doivent donc toutes utiliser la même configuration. Une reconnexion ne
reprend pas les agrégats d'une ancienne unité différente.

Un champ speed_unit absent dans un ancien JSON conserve le contrat historique
uu/s, sans nouvelle preuve de l'unité physique réellement émise par le jeu.
Aucun ancien enregistrement n'est réinterprété ou migré. Training.Merge conserve
les règles historiques à unité comparable : bornes temporelles élargies, source
game prioritaire, focus/profil/arène existants préservés, moyenne du plus grand
nombre de touches et vitesse maximale. Un timer sans métriques adopte l'unité
du jeu ; des unités différentes conservent les vitesses existantes au lieu de
comparer leurs amplitudes, tout en fusionnant temps et nombre de touches.
Ce maintien peut conserver un sous-ensemble ancien de vitesses : il ne prétend
pas recalculer un agrégat couvrant toutes les touches.

## Preuves exécutées

```sh
go test ./internal/domain ./internal/tracker ./internal/statsapi ./internal/store
go test ./internal/sim
go test -count=1 -cover ./internal/domain ./internal/tracker ./internal/statsapi ./internal/store ./internal/tilt ./internal/agent ./internal/server ./internal/application ./cmd/rltracker-server
go test -race -count=1 ./internal/domain ./internal/tracker ./internal/statsapi ./internal/store ./internal/tilt
go vet ./internal/domain ./internal/tracker ./internal/statsapi ./internal/store ./internal/tilt ./internal/sim
go list -deps -f '{{if not .Standard}}{{.ImportPath}}{{end}}' ./internal/domain ./internal/tracker
```

Résultats : PASS. Toute la suite tracker est exécutée, sans filtre ni exclusion.
Couverture : domain 87,3 %, tracker 92,2 %, StatsAPI 84,5 %, store 80,3 %, Tilt
96,6 %. Les couvertures des lanes parallèles sont des observations du checkout
partagé, pas une qualification de leur code. Le graphe de production des deux
packages core ne contient que domain/tracker et la bibliothèque standard :
aucun store, SQLite, StatsAPI, HTTP ou package Windows. Les gardes d'import
inspectent aussi les fichiers spécifiques à d'autres plateformes.

Le test sim a d'abord exposé le callback direct à remplacer ; il passe après
raccordement par le coordinateur. Un nouveau test de freeplay a été corrigé
pour inclure le MatchCreated requis après le podium ; le comportement de
lifecycle n'a pas été modifié pour satisfaire ce test.

Contrôles complémentaires : gofmt et diff --check sur les fichiers de la lane.
Les cross-builds Windows desktop et Linux serveur passent :

```sh
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o /dev/null .
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /dev/null ./cmd/rltracker-server
```
Ils ne constituent pas une exécution de tests Windows ni une partie réelle.

## Revue et limites de livraison

Auto-revue analytique, distincte d'une revue indépendante :

| Angle | État local | Objection et preuve | Gate restant |
| --- | --- | --- | --- |
| Principal Engineer | PASS local | Le core doit rester indépendant et les alias préserver la composition : gardes d'import, JSON historique, graphe, suites store/tracker et sim passent. | Revue indépendante sur la cible figée ; mise à jour des guides par le coordinateur. |
| Product Engineer | PASS local | L'absence et l'unité ne doivent produire aucun faux chiffre : tests de chaque champ absent, zéros explicites, démolition seule, unités brutes et fusion mixte. | Intégration web par Carver et qualification de capture réelle ; aucune unité jeu attestée. |
| SRE | PASS local | Fusion/rejeu et transaction doivent conserver leurs garanties : store complet et race passent, hook dans la transaction existante avant commit. | Revue journal/application L7 et validation des nouveaux champs côté ingestion ; aucun test réel de panne/jeu/déploiement. |

La validation HTTP/application des nouveaux champs appartient au coordinateur :
valeurs autorisées de speed_unit, finitude/non-négativité et cohérence de
car_sample_s avec la disponibilité. La suite existante ne qualifie pas à elle
seule cette extension du contrat d'ingestion. La présentation web ne relève
pas de cette lane. Aucun verdict indépendant ni readiness globale n'est déduit
de l'auto-revue ou des tests locaux.

## Retrait

Transférer le contrat courant et les commandes dans
[ARCHITECTURE](../../ARCHITECTURE.md), [DEVELOPMENT](../../DEVELOPMENT.md) et
[SPEC](../../SPEC.md), sous ownership du coordinateur. Conserver la justification
durable dans [ADR-0001](../../decisions/0001-architecture-hexagonale.md) et
[ADR-0004](../../decisions/0004-validite-et-disponibilite-des-mesures.md), proposés
tant qu'ils ne sont pas acceptés. Reporter les preuves et limites exactes dans
la PR d'implémentation, puis retirer cette fiche temporaire ; code et ADR restent
durables. Le retrait ne signifie ni acceptation de l'ADR, ni release, ni
qualification des unités ou de la télémétrie réelle.

## Cible figée pour revue

Manifeste des 17 fichiers Go écrits par cette lane, hors fiche et fichiers
réservés L7. SHA-256 du bloc ci-dessous (chaque ligne terminée par LF) :
`d0d3667b1b051fadcbe524a53cece23019dfcb151f2867345f317ce3c61087f2`. Aucune autre écriture de code après ce manifeste.

```text
a22059ebf76e109237ea28a7614b74ab1e4605c6911a6be2dc58eeac883c0b0c  internal/domain/dependencies_test.go
1c7b40145cc46306711ebc17b8e65572c9ac455651a24a2c96ccf587c75ca3df  internal/domain/model.go
3422354c6681b1237185053af02ede947d32241a011702cd33c635ec11d7454a  internal/domain/movement.go
421594b48cd7389a891cbb32efc9d7b5c79077330cf5a5ee27b98343a8289b25  internal/domain/movement_test.go
b3408680fd1db27fa441f23ec89d75457b4cf85d47b089f50ed767009c04a4d2  internal/domain/observations.go
9dcfde1942e4c55ff01b70d759fd462f92efa1cdcba56d8e3fc0d60e563a78b7  internal/domain/speed.go
170b33d5313bff49a42021aa61e9ae1ad6d9f53765d7347116b8a391ed750465  internal/domain/training.go
fa53381711403fb0c468671ab109db331014968c5696916ff1a84d0e7552340f  internal/domain/training_test.go
1182cacb274ab6e1c380927755ef1c653e389aeea40cd9e86fc631df4ab5173b  internal/statsapi/observations.go
b808dade604b54110e79fe1e5fa954508c4fc75671d26740a657692ad84eed0a  internal/statsapi/observations_test.go
1948e725f61fd4722f5941a399e82cd34510dfff61daaf3414796721f82972eb  internal/store/trainings.go
ab66c45f03398f9e748eb16f97d8091d5178d6b02f23a3c803d82c7f7a4ca877  internal/tracker/dependencies_test.go
cd0015cdc7b8d1751a0178dc1c53abe393b7df3d7363ca51abb39af979347c9a  internal/tracker/movement.go
9a836158c36a66d912bbe36e32c34e0fb26336648a96495d080c4175aa7604cc  internal/tracker/movement_test.go
afe52d0e7d0cd25fb64070b81bdc8fb3b0f8e323c21ac1e351d211177e332a1d  internal/tracker/observations_test.go
22563d9763eae426c5888ee1f92358f4c9606aae7ff86e8e4b2d344ff7f20ee2  internal/tracker/tracker.go
4f70e9085281949a356dc747cb722996af75a3bc56fe8176afa7ae754fe9103e  internal/tracker/tracker_test.go
```
