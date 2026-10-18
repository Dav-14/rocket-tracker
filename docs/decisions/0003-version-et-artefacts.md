# ADR-0003 — Version injectée et candidat de release identifiable

- Statut : Proposé
- Date : 2026-10-18
- Décisionnaire : mainteneurs
- Référence : [audit des versions et LDFLAGS](https://github.com/KcivazB/rocket-tracker/issues/2)

## Contexte

Le linker sait injecter `main.Version`, mais les builds simples utilisent deux littéraux. La politique actuelle exige leur bump commun ; elle reste applicable tant qu’un changement de convention n’est pas adopté. Une CI verte ne prouve ni les octets distribués ni un déploiement.

## Décision proposée

Conserver `main.Version` injectable dans chaque entrée, avec une convention commune de fallback de développement. Préférence : un fallback explicitement non-release plutôt que deux numéros maintenus manuellement. Faire évoluer ensemble instructions, scripts, Docker, workflows, affichage/logs et updater. Une version de développement ne doit pas se faire passer pour une release installée. La valeur exacte et la stratégie updater sont à confirmer par les mainteneurs dans la PR de changement.

Séparer Build et Tests des autorisations Release/Deploy. Identifier le candidat et publier les mêmes octets que ceux vérifiés. Configurer Node explicitement pour les tests frontend ; un saut du test ne vaut pas une validation.

## Options et conséquences

Garder les littéraux est compatible mais maintient une coordination évitable. Un package `buildinfo` partagé est une alternative si des consommateurs le justifient ; ne pas l’ajouter en même temps sans nécessité. Aucun nouveau système de déploiement n’est exigé.

## Validation et mise en œuvre

Tester builds simples/injectés des deux exécutables, normalisation de tag, updater et preuves d’artefact. Faire vérifier les gates des workflows et les identifiants/digests utiles. Une acceptation de cette proposition n’est pas une release ou une preuve de protection de branche. Revoir si un consommateur exige un format/version de développement différent.
