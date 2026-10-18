# L3 — Tests frontend

**État : implémenté et vérifié localement.** Base vérifiée : `6f531fd43be3bcd6f3a746e3b352103ef2a06ef3`. La PR porte l’état de revue et d’intégration ; ces tests ne prouvent aucune release. Les contrôles ci-dessous incluent une auto-revue, sans diversité de fournisseur démontrée.

[Audit and plan](https://github.com/KcivazB/rocket-tracker/issues/2#issuecomment-6250332932)

## Rattachement et objectif

Epic **E2** ; stories **US-03 à US-07**. Séparer traductions/analytique sous web/tests sans livrer leurs fichiers dans les assets.

Dépendances : Contrat L0 des assertions/assets ; intégration coordonnée sur web et workflows.

Périmètre réalisé : scripts Node, wrapper Go, embed, chemins et trois workflows CI. `web/i18n.js` reste runtime, inchangé. README, AGENTS et DEVELOPMENT sont actualisés avec les commandes et le prérequis Node. La convention de version est traitée séparément ; ce lot ne modifie aucun numéro de version.

## Documentation avant, pendant et après

**Avant le code :** inventaire du script à la base et des fichiers web, y compris le vendor suivi par Git mais ignoré par la recherche par défaut ; exécution du script et du wrapper existants.

**Dans la PR d’implémentation :** Adapter docs/DEVELOPMENT.md, le routage AGENTS.md et les commandes CI dans la même PR. Les chemins cités sont des cibles documentaires ; cette fiche ne modifie pas leur contenu actuel. Une conception proposée ne remplace pas la documentation du fonctionnement livré.

**Après vérification :** preuves locales ci-dessous. Les guides sont actualisés dans cette PR. La matrice commune suit l’issue #2 ; les preuves ci-dessous ne démontrent aucune release.

## Critères de passage

Deux scripts Node exécutés explicitement ; assertions conservées ; liste embarquée/servie sans tests/fixtures et assets produits présents.

Revue architecture, impact joueur et exploitation ; ajouter la frontière sécurité lorsqu’elle est concernée. Vérifier les liens/commandes documentés. Une proposition, une intégration et une release restent des états distincts.

## Changements et compatibilité

`devtools/i18n_test.js` est supprimé, sans relais de compatibilité. Ses contrôles deviennent `web/tests/i18n.test.js` et `web/tests/analytics.test.js` : comparaison avec le fichier de base, **49/49 lignes d’assertion conservées**, respectivement 16 et 33. Les contrôles de complétude et de placeholders restent présents ; le bloc analytique, fixtures et attentes incluses, est conservé à l’identique. Le second processus initialise explicitement la langue anglaise auparavant héritée des tests de traduction.

`web/web_test.go` exécute les deux scripts. Node absent devient un échec explicite, au lieu d’un test ignoré. Les jobs concernés de `ci.yml`, `release.yml` et `docker.yml` configurent Node 22 et exécutent explicitement les deux commandes ; le workflow release reçoit l’étape de configuration Node qui lui manquait. Le wrapper Go les exécute également lors de `go test` ; cette répétition courte est volontaire. Aucun framework ni bundler ajouté.

L’embed énumère exactement les sept assets runtime : `index.html`, `setup.html`, `app.js`, `setup.js`, `i18n.js`, `style.css`, `vendor/chart.umd.min.js`. Les deux pages et leurs références locales ont été inventoriées ; les images inline ne nécessitent pas de fichier supplémentaire. Aucun de ces assets n’a été modifié. Un nouvel asset runtime exigera de mettre à jour l’embed et son inventaire de test.

`TestEmbeddedAssets` vérifie l’inventaire exact, des contenus non vides et les réponses 200 avec contenu identique des sept assets via `http.FileServerFS`, en mémoire. Il exige 404 pour les deux scripts, `/tests/`, `/fixtures/`, `/embed.go` et `/web_test.go`. L’inventaire exact exclut aussi toute fixture future ajoutée hors liste. Ce contrôle porte sur le filesystem embarqué et le gestionnaire standard ; il ne prétend pas vérifier toute la chaîne HTTP du serveur applicatif. Le serveur existant filtre déjà les chemins `.go` : leur présence dans l’ancien embed ne prouve pas leur exposition publique.

## Vérifications locales

Environnement : macOS arm64, Node `v26.11.0`, Go `go1.27.2`. Node 22 est la cible CI configurée, non exécutée localement.

| Commande ou contrôle | Résultat observé |
| --- | --- |
| Avant modification : `node devtools/i18n_test.js` et `go test ./web -count=1 -v` | PASS ; 938 clés, 876 utilisées |
| Comparaison des scripts avec `git show 6f531fd:devtools/i18n_test.js` | 49/49 assertions conservées ; bloc analytique inchangé |
| Nouveau test avec l’ancien `embed *` : `go test ./web -run '^TestEmbeddedAssets$' -count=1 -v` | Échec attendu : scripts embarqués et servis, inventaire trop large |
| `node web/tests/i18n.test.js` | PASS ; 938 clés, 876 utilisées |
| `node web/tests/analytics.test.js` | PASS ; `analytics ok` |
| Les deux scripts par chemin absolu depuis `/tmp` | PASS ; chemins indépendants du répertoire courant |
| `go test ./web -count=1 -v` après correction embed | PASS ; deux sous-tests frontend et inventaire/réponses HTTP |
| `go vet ./web` | PASS, aucune sortie |
| `env PATH=/usr/bin:/bin /opt/homebrew/bin/go test ./web -run '^TestFrontend$' -count=1` | Échec attendu : `Node.js is required for frontend tests; CI uses Node 22`, aucun skip |
| Parse YAML Ruby des trois workflows | PASS syntaxique ; ne vaut pas exécution GitHub Actions |
| `git diff --check` | PASS |

Les requêtes de test utilisent `httptest.NewRecorder` et `NewRequest`, sans socket ni service externe. Aucun lancement d’application, navigateur, Docker, jeu, CI distante ou test Windows. Pas d’actionlint disponible ni installé ; aucune qualification de la matrice CI n’est revendiquée. Les changements simultanés des autres lanes restent hors de cette preuve.

## Auto-revue et limites

| Perspective | Conclusion et frontière |
| --- | --- |
| Principal Engineer | Assertions et fixtures conservées, aucun changement runtime ni dépendance ajoutée ; l’inventaire fermé impose une mise à jour explicite lors d’un ajout d’asset. |
| Product Engineer | Les sept assets nécessaires restent lisibles et servis en mémoire ; les calculs et traductions passent leurs assertions existantes. Cela ne prouve pas un parcours navigateur ou joueur réel. |
| SRE | Node requis explicitement, CI configurée en 22 et tests exclus de l’embed ; exécution Node 22/Windows et workflows distants restent à qualifier. |

## Retrait de cette fiche temporaire

Les contrats courants vivent dans README, AGENTS et DEVELOPMENT. Avant retrait, transférer les preuves et limites ci-dessus dans la PR et le suivi de l’issue #2 ; conserver les décisions durables dans les ADR du projet.
