# ADR-0002 — Rendre l’intention d’envoi récupérable

- Statut : Proposé, option à trancher avant migration
- Date : 2026-10-18
- Décisionnaire : mainteneurs
- Référence : [audit, architecture et reprise](https://github.com/KcivazB/rocket-tracker/issues/2)

## Contexte

À la révision auditée, sauvegarde SQLite et outbox fichier sont deux écritures. Un échec après commit peut laisser un résultat uniquement local. Le tracker ne rejoue pas automatiquement le callback. La file trace un serveur mais ne prouve pas le compte historique de chaque entrée ; le token courant ne le reconstitue pas.

## Décision proposée

Retenir la garantie : si un résultat est sauvegardé avec une destination configurée, une intention d’envoi récupérable existe. Choisir **une** stratégie avant changement de schéma : résultat et intention dans la même transaction SQLite, ou marqueur durable accompagné d’une réconciliation démontrée. La transaction SQLite est la première option à évaluer pour l’atomicité ; elle n’est pas annoncée implémentée ni acceptée ici.

Identifier séparément observation locale, destination serveur+compte et révision d’envoi. Une rotation du secret ne change pas la destination. Un acquittement tardif ne supprime que la révision correspondante. Les anciennes entrées à destination ambiguë restent conservées à l’écart sans envoi automatique ; leur rattachement exige une décision explicite.

## Options et conséquences

Garder seulement deux écritures indépendantes ne satisfait pas la garantie. Une table transactionnelle simplifie la fenêtre de commit mais demande migration/worker et compatibilité de rétrogradation. Une réconciliation peut réutiliser la file mais doit prouver sa source de vérité et toutes les fenêtres de panne. Ne pas cumuler deux sources de vérité pour éviter de trancher.

Migration rejouable des files normales, rejetées et mises à l’écart ; conserver les sources jusqu’au transfert durable vérifié. Ne pas réécrire des migrations déjà appliquées ni assimiler GUID de partie et clé de livraison.

## Validation et mise en œuvre

Tests d’interruption avant/après commit et ack, restart, concurrence, rejeu, token, compte/serveur, ancienne révision et migration interrompue. Restaurer un jeu synthétique complet DB/WAL/config/file et sa destination. La récupération d’anciennes intentions inconnues et le downgrade sont des conditions explicites, sans promesse de reprise aveugle. Revoir si l’identité de destination ne peut pas être établie avec le contrat choisi.
