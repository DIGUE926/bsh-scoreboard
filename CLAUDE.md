# Gel des nouvelles fonctionnalités : LEVÉ par Digue le 2026-10-13

- Le gel décidé le 2026-10-10 est terminé. Les nouveautés en attente sont listées dans « L'APRÈS-GEL PRIORITY » du CLAUDE.md de `bsh-web`.

# Repères (2026-10-14)
- Adresse : https://bsh-scoreboard.vercel.app (projet Vercel `bsh-scoreboard`), connexion avec le compte BSH.
- Ligues proposées : toutes sauf AHBB (interrupteur `app_settings.scoreboard_ahbb_enabled`). « Répétition (privé) » est choisie par défaut dans /demarrer : un test ne doit jamais aller dans une ligue publique (le 2026-10-14, un test « lakers vs warriors » était parti dans SUBLE, seule ligue proposée alors).
- Une stat qui ne s'enregistre pas affiche un message rouge (avant : échec silencieux).
- Ajout d'un joueur en direct : champ « N° » ; un numéro seul suffit (le joueur s'appelle alors « #12 », `jersey_number` = 12). Affichage `joueurLabel` : « #12 Jean », « #12 » ou « Jean ».
- Notifications : écrites par bsh-web (`/api/push/notify` début/fin, `/api/push/live` en cours de match) via les déclencheurs Postgres ; une ligue cachée (Répétition) ne notifie personne.
