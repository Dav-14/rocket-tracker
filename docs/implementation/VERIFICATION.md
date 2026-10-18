# Vérification de la proposition complète

Cible : branche `implementation/complete-audit`, construite sur l’amont
`6f531fd43be3bcd6f3a746e3b352103ef2a06ef3` et les premières PR #3–#7.
La révision finale et les checks distants sont consignés dans la PR.
Aucun merge, tag, release, push registre ou déploiement réalisé.

## Vérifications locales exécutées

Hôte Darwin/arm64, Go 1.27.2, Node 26.11.0. Le lot pipeline a aussi exécuté
les quatre scripts avec Node 22.23.3 depuis un cache temporaire.

| Vérification | Résultat |
| --- | --- |
| `go test ./internal/... ./web ./cmd/rltracker-server` | PASS, y compris simulation et nouvelle restauration synthétique. |
| `go vet ./internal/... ./web ./cmd/rltracker-server` | PASS. |
| `go test -race ./internal/application ./internal/domain ./internal/agent ./internal/config ./internal/server ./internal/statsapi ./internal/store ./internal/tilt ./internal/tracker ./internal/update ./web ./cmd/rltracker-server` | PASS. |
| Quatre scripts `web/tests/{i18n,analytics,profiles,polling}.test.js` | PASS ; 949 clés, 887 utilisées ; huit scénarios de polling contrôlés ; DOM minimal et HTTP capturé pour profils/sessions/livraison. |
| Couverture application instrumentée avec application + server | 89,3 % des instructions à la première intégration `33674b3` ; pas une nouvelle mesure après les correctifs de revue. |
| Cross-build Windows bureau + compilation de `internal/desktopapp` tests + vet ciblé Windows | PASS compilation ; exécution Windows réservée à CI. |
| Serveur natif `--version`, simple/injecté/ancien symbole | `dev` / `1.2.3` / `dev`, vérifié dans la lane pipeline ; ancien symbole silencieusement inefficace documenté. |
| `actionlint` 1.7.12, syntaxe Bash/Python et 158 assertions policy/négatives du suivi pipeline | PASS ; ShellCheck/Pyflakes indisponibles. |
| Docker réel Linux/amd64 émulé sous OrbStack arm64 | PASS export/rechargement du même candidat, version `1.2.3`, santé hors réseau et checksums ; aucun push. |
| Chromium 148, serveur loopback, utilisateur de démonstration seedé | DOM du dashboard authentifié, KPIs et canvases présents ; pas de qualification visuelle/screenshot réussie. |
| `git diff --check` | PASS sur la proposition locale. |

Le premier lancement Chromium demandait des données à un compte neuf vide :
le timeout n’était pas une réussite. Ce contrôle navigateur portait sur
la première intégration `33674b3`, avant les corrections de revue ; les quatre
scripts frontend et les tests Go ont ensuite été rejoués sur le code corrigé. Le contrôle sur le compte de démonstration
vérifie les conditions DOM. La capture d’image n’a pas abouti ; aucune revue
visuelle n’est revendiquée. Le serveur est strictement lié à loopback et toutes
ses données sont synthétiques et temporaires.

## Revue indépendante et gates

Les auteurs des lanes ont figé leurs surfaces puis des agents distincts ont
reçu les revues croisées domaine/mesures, journal/identité, reprise et imports.
Les objections reproduites et leurs corrections figurent ci-dessous. Modèle hérité : aucune diversité de fournisseur
ni approbation humaine n’est revendiquée.

- Principal Engineer : vérifier cohérence des ports, absence/null/unités,
  révisions et propriétaire. Tests d’import et tests transactionnels exécutés.
- Product Engineer : vérifier profil destinataire, population/dénominateur,
  libellés FR/EN et états de livraison ; VM/DOM réel synthétique, sans revue
  visuelle ni validation des personas par entretiens.
- SRE : vérifier identité et reprise, limites d’import et backup arrêté ;
  restauration et Docker synthétiques exécutés. Pas de RPO/RTO mesuré.

## Disposition des défauts reproduits en revue

| Défaut | Correction et preuve indépendante |
| --- | --- |
| Fusion d’entraînements entre destinations, y compris après ack | Origine persistante v9 et filtre de rapprochement ; repro Hooke/Euler et tests store passent. |
| Deux profils fusionnés par une même clé d’import training | Filtre de profil sur clé et proximité ; deux imports HTTP conservent deux lignes à 10/20 touches ; Euler relecture et race PASS. |
| Réponse heartbeat A remplaçant le setup B | Génération/cible comparées sous verrou OS, patch du fichier courant ; repro indépendante Euler et cas interprocessus PASS. |
| Configuration partagée et reload incomplet | Copie propriétaire, getter synchronisé, réglages et auto-identité remplacés ; reproductions Euler sous race PASS. |
| JSON `null` devenu zéro malgré temps car positif | Présence des dix agrégats exigée ; HTTP 400 sans insert/remplacement/révision ; Carver relecture indépendante, tests domaine et HTTP PASS. |
| Mélange des vitesses legacy et unknown | Cohortes distinctes ; aucune conversion ; ancien snapshot échoue et source corrigée passe, contrelecture Copernicus. |
| Rang jamais réessayé et manuel non invalidé | Révisions par population et huit scénarios de promesses contrôlées ; contrelecture Copernicus PASS. |
| SQLite `user_version` négatif provoquant un panic | Versions négatives/futures refusées ; compteurs partiels conservés ; reproduction et contrelecture Euler PASS. |
| Ancien publisher écrasant un main plus récent | Sérialisation et contrôle distant avant chaque push ; 158 assertions rejouées par le coordinateur et actionlint PASS. Le scheduler distant et le registre restent des preuves séparées. |

Principal Engineer : frontières, disponibilité et identité examinées ; objections
reproduites corrigées et recontrôlées. Product Engineer : profils, mesures,
retry et états actionnables couverts ; personas et revue visuelle restent ouverts.
SRE : migration, lock interprocessus, reprise, budgets et candidats immuables
examinés ; tests synthétiques PASS. Les limites ci-dessous restent des gates
d’environnement. Ces angles sont analytiques, sans approbation de mainteneur.

Ordre des fondations vérifié par `git merge-tree --write-tree` : #3, #4, #5,
#6 (`b2b6981`), #7 (`e556ea7`). Les conflits de guides/workflows ont été résolus
dans les branches concernées, sans force-push ni merge amont. L’arbre obtenu
égale le socle combiné initial `17c9fe7`. La proposition complète est ensuite
rattachée à #7 ; la PR/issue porte son SHA final et les checks distants.
Un merge squash/rebase requiert un nouveau contrôle de la base et du diff.

Restent des qualifications d’environnement séparées : tray/élévation/autostart/
update interactifs Windows avec vrai jeu, unité de capture attestée, fournisseur
OIDC/proxy réels, charge/capacité, incident matériel, publication et déploiement.
Ces limites n’autorisent pas à présenter des fixtures comme une preuve réelle.
