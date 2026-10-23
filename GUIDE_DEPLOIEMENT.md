# Guide de déploiement - Visiplus

### Fichiers ajoutés

- `Dockerfile` : construit l'image de production de l'API
- `.dockerignore` : liste les fichiers à ne pas envoyer à Docker pendant le build (`node_modules`, `.env`, les tests...)
- `docker-compose.yml` : lance l'API et une base MongoDB ensemble

### Prérequis

- Docker Desktop installé et démarré (testé sous Windows 11 avec Docker 29.6.2)
- Un fichier `.env` à la racine du projet (copier `.env.example` et remplir les valeurs). `JWT_SECRET` doit faire au moins 32 caractères, sinon l'application refuse de démarrer.
- Toutes les commandes de ce guide sont à lancer dans l'invite de commandes Windows (cmd), depuis le dossier du projet.

### Le Dockerfile

Le projet est en TypeScript, mais Node.js ne lit que du JavaScript. Il faut donc d'abord compiler le code avec `npm run build`, ce qui crée le dossier `dist/`.

J'ai donc fait un Dockerfile en deux étapes :

1. Étape `builder` : on installe toutes les dépendances (avec TypeScript) puis on compile `src/` en `dist/`.
2. Étape `runner` : on repart d'une image Node propre, on installe seulement les dépendances de production (`npm ci --omit=dev`) et on récupère uniquement le dossier `dist/` de l'étape 1 avec `COPY --from=builder`.

L'image finale ne contient donc ni TypeScript, ni vitest, ni le code source `.ts`, qui ne servent pas à faire tourner le serveur. Je l'ai contrôlé dans l'image (voir Vérification, point 4).

Pour l'image de base j'ai pris `node:24-alpine` :

- Node 24 est une version LTS et c'est la version de `@types/node ^24` utilisée dans le projet.
- Alpine est une distribution Linux très légère, l'image est plus petite qu'avec la version Debian.

Le reste des lignes :

- `package*.json` est copié avant le code source : si on modifie seulement le code, Docker réutilise le cache et ne refait pas le `npm ci`, le build est beaucoup plus rapide.
- `ENV NODE_ENV=production` : l'application sait qu'elle tourne en production. Dans `src/config/logger.ts`, ça donne des logs au format JSON avec le niveau `info` (au lieu des logs colorés de `pino-pretty` en développement).
- `npm cache clean --force` : supprime le cache de téléchargement de npm, qui ne sert plus une fois les paquets installés. Il est dans le même `RUN` que `npm ci`, sinon le cache resterait dans une couche de l'image.
- `USER node` : le serveur ne tourne pas en root dans le conteneur, c'est plus sécurisé.
- `EXPOSE 3000` : indique le port utilisé par l'application. C'est seulement informatif, le port est réellement ouvert par `ports:` (docker compose) ou `-p` (docker run).
- `CMD ["npm", "start"]` : lance le serveur, c'est-à-dire `node dist/main.js` (script `start` du `package.json`). À l'arrêt du conteneur, npm transmet bien le signal à Node (voir Vérification, point 5).

Le fichier `.env` n'entre pas dans l'image, pour deux raisons : le Dockerfile ne copie que `package*.json`, `tsconfig.json` et `src/`, et le `.dockerignore` exclut `.env` et `.env.*`. Les variables sont donc données au lancement du conteneur.

### Le docker-compose.yml

# Service `mongo`

- `image: mongo:7` : image officielle, pas besoin de Dockerfile.
- `healthcheck` : toutes les 10 secondes, Docker lance `mongosh` pour envoyer un `ping` à la base. Après 5 échecs, le conteneur est marqué `unhealthy`.
- `volumes: mongo-data:/data/db` : les données de la base sont stockées dans un volume nommé `mongo-data` (déclaré en bas du fichier). Elles sont gardées même si on supprime le conteneur, sauf avec `docker compose down -v`.
- Pas de `ports:` : la base n'est accessible que depuis le réseau Docker, donc seulement par l'API.

# Service `app`

- `build: .` : l'image est construite avec notre `Dockerfile`.
- `depends_on` avec `condition: service_healthy` : l'API ne démarre que quand MongoDB répond à son healthcheck. Sans ça, l'API pourrait démarrer avant que la base soit prête.
- `healthcheck` : Docker appelle la route `/health` de l'API toutes les 30 secondes, pour savoir si elle répond vraiment.
- `ports: "3000:3000"` : rend l'API accessible sur `localhost:3000` depuis le PC.
- `restart: unless-stopped` (sur les deux services) : le conteneur redémarre tout seul s'il plante ou après un redémarrage de Docker, sauf si on l'a arrêté nous-mêmes.

# Les variables d'environnement

Docker Compose lit automatiquement le fichier `.env` qui est à côté du `docker-compose.yml` pour remplacer les `${...}` :

Variable : Valeur utilisée par docker compose
`JWT_SECRET` : Celle du `.env`. Si elle manque, docker compose refuse de démarrer (`:?`)
`JWT_EXPIRES_IN` : Celle du `.env`, sinon `7d` (`:-`)
`CORS_ORIGIN` : Celle du `.env`, sinon `*` (`:-`)
`MONGODB_URI` : Écrite dans le compose : `mongodb://mongo:27017/visiplus`
`NODE_ENV` : Écrite dans le compose : `production`

Les lignes `MONGODB_URI`, `NODE_ENV` et `PORT` du `.env` ne sont donc pas utilisées par docker compose, elles servent seulement pour `npm run dev` en local. Pour `MONGODB_URI`, c'est obligatoire : dans un conteneur, `localhost` correspond au conteneur lui-même. On utilise donc `mongo`, le nom du service, que Docker traduit en adresse du conteneur MongoDB sur le réseau créé par docker compose.

J'ai mis des valeurs par défaut (`:-7d` et `:-*`) parce que sans elles, une variable absente du `.env` est envoyée vide au conteneur, et les valeurs par défaut de `src/config/env.ts` ne s'appliquent plus. J'ai testé : avec `JWT_EXPIRES_IN` vide, l'inscription renvoie une erreur 500, et avec `CORS_ORIGIN` vide, l'API n'envoie plus d'en-tête CORS.

---

### Lancer le projet

Il y a deux façons de lancer le projet. Les deux utilisent le même `Dockerfile` pour construire l'image de l'API :

- Option 1 - Docker Compose (recommandée) : lance l'API et MongoDB en une seule commande. Docker Compose construit l'image de l'API à partir du `Dockerfile` grâce à la ligne `build: .` du service `app`.
- Option 2 - Docker seul : on fait les mêmes étapes à la main (build de l'image, réseau, MongoDB, API). Utile pour tester l'image seule ou pour utiliser une base MongoDB externe.

Il suffit de suivre une seule des deux options présentées.

#### Option 1 - Docker Compose

```
docker compose up -d --build
```

- `--build` reconstruit l'image de l'API à partir du `Dockerfile` (à relancer après chaque modification du code, sinon docker compose réutilise l'ancienne image)
- `-d` lance les conteneurs en arrière-plan

Autres commandes utiles :


Voir l'état des conteneurs
```
docker compose ps
```

Voir les logs de l'API (Ctrl+C pour quitter)
```
docker compose logs -f app
```

Stopper le docker compose (les données restent dans le volume)
```
docker compose down
```

Stopper le docker compose et supprimer le volume, donc les données
```
docker compose down -v
```

#### Option 2 - Docker seul (sans docker compose)

1. Construire l'image de l'API à partir du Dockerfile
```
docker build -t visiplus .
```

2. Créer un réseau pour que l'API puisse joindre MongoDB
```
docker network create visiplus-net
```

3. Lancer MongoDB, avec un volume pour garder les données
```
docker run -d --name mongo --network visiplus-net --restart unless-stopped -v visiplus-mongo-data:/data/db mongo:7
```

4. Lancer l'API
```
docker run -d --name visiplus --network visiplus-net --restart unless-stopped -p 3000:3000 --env-file .env -e MONGODB_URI=mongodb://mongo:27017/visiplus -e NODE_ENV=production visiplus
```

Explications :

- Sur un réseau créé avec `docker network create`, Docker permet de joindre un conteneur par son nom. C'est pour ça que `MONGODB_URI` utilise `mongo`, le nom donné au conteneur à l'étape 3.
- `--env-file .env` donne au conteneur les variables du `.env` (`JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`). Ça évite d'écrire le secret dans la commande, et donc dans l'historique du terminal. Si `JWT_EXPIRES_IN` ou `CORS_ORIGIN` ne sont pas dans le `.env`, elles ne sont pas définies du tout et les valeurs par défaut de `env.ts` s'appliquent (`7d` et `*`), comme avec docker compose.
- Les `-e` placés après remplacent `MONGODB_URI` (qui vaut `localhost` dans le `.env`) et `NODE_ENV` (qui vaut `development`).
- `--restart unless-stopped` est mis sur les deux conteneurs, comme dans le compose.
- Contrairement à docker compose, rien n'attend que MongoDB soit prêt. En pratique, Mongoose attend jusqu'à 30 secondes que la base réponde avant d'abandonner, et si l'API s'arrête quand même, `--restart` la relance.

Pour tout arrêter et nettoyer (à faire aussi avant de relancer les commandes, sinon `docker run` refuse car les noms `mongo` et `visiplus` sont déjà utilisés) :

```
docker rm -f visiplus mongo
docker network rm visiplus-net
```

Uniquement si on veut supprimer les données
```
docker volume rm visiplus-mongo-data
```

---

### Vérification

Tests faits avec les commandes de l'option 1 (sauf le point 7).

1. Les deux conteneurs sont lancés et en bonne santé :

```
docker compose ps
NAME               IMAGE             COMMAND                  SERVICE   CREATED          STATUS                    PORTS
visiplus-app-1     visiplus:latest   "docker-entrypoint.s…"   app       38 seconds ago   Up 26 seconds (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
visiplus-mongo-1   mongo:7           "docker-entrypoint.s…"   mongo     38 seconds ago   Up 37 seconds (healthy)   27017/tcp
```

2. L'API répond sur la route de santé :

```
curl -i http://localhost:3000/health
HTTP/1.1 200 OK
...
{"status":"ok","timestamp":"2026-10-23T20:06:05.880Z"}
```

3. L'API écrit bien dans MongoDB (création d'un utilisateur) :

```
curl -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"test@exemple.fr\",\"password\":\"Password123!\"}"
```

Dans cmd, le JSON doit être entre guillemets doubles avec des `\"` à l'intérieur. Avec des apostrophes (`'{"email":...}'`, comme on l'écrit souvent sous Linux), cmd supprime les guillemets du JSON : l'API reçoit `'{email:test@...`, qui n'est pas du JSON valide, et répond `{"error":"Internal server error",...}` avec un code 400.

Résultat attendu :

```
{"message":"User registered successfully","data":{"token":"eyJhbGciOi...","user":{"id":"6ada5cdf3b346f213b03e658","email":"test@exemple.fr"}}}
HTTP 201
```

Si on relance le test avec le même email, l'API répond `400` avec `"User already exists"`. C'est normal, il suffit de changer l'email.

4. Le contenu de l'image :

```
docker run --rm visiplus sh -c "id; node -v; ls dist"
uid=1000(node) gid=1000(node) groups=1000(node),1000(node)
v24.22.1
app.d.ts  app.d.ts.map  app.js  app.js.map  config  controllers  main.d.ts  main.d.ts.map  main.js  main.js.map
middlewares  models  routes  server.d.ts  server.d.ts.map  server.js  server.js.map
```

On voit que le serveur tourne avec l'utilisateur `node`. `dist/` contient uniquement le code compilé (les `.d.ts` et `.map` viennent du `tsconfig.json`), aucun fichier de test (les tests sont dans `tests/`, qui n'est pas copié), et `typescript`, `vitest`, `supertest` et `tsx` ne sont pas dans `node_modules`.

5. L'arrêt : `docker compose stop app` arrête l'API en quelques secondes. Cette commande affiche seulement le résultat côté Docker :

```
docker compose stop app
[+] stop 1/1
 ✔ Container visiplus-app-1 Stopped
```

Pour voir ce qui s'est passé dans l'API, il faut regarder ses logs et le code de sortie :

```
docker compose logs app
...
{"level":30,"time":1792772493445,"pid":19,"hostname":"5f4927875c57","signal":"SIGTERM","msg":"Received shutdown signal"}
{"level":30,"time":1792772493445,"pid":19,"hostname":"5f4927875c57","msg":"HTTP server closed"}

docker compose ps -a
NAME             ...   STATUS
visiplus-app-1   ...   Exited (0) 48 seconds ago
```

Les deux dernières lignes des logs montrent que le signal SIGTERM envoyé par Docker est bien arrivé jusqu'à Node (en passant par npm), et `Exited (0)` veut dire que l'API s'est arrêtée sans erreur.

6. Sans variables d'environnement (`docker run --rm visiplus`), le conteneur s'arrête tout de suite avec un message qui dit que `MONGODB_URI` et `JWT_SECRET` manquent. C'est normal, c'est la validation de `src/config/env.ts`.

7. Option 2 : avec les commandes de l'option 2, `/health` répond 200 et l'inscription 201 (mêmes commandes qu'aux points 2 et 3). Pour vérifier que les `-e` remplacent bien les valeurs du `.env` :

```
docker logs visiplus
...
{"level":30,...,"port":3000,"env":"production","msg":"🚀 Server running on port 3000"}
```



### Limites

- MongoDB sans mot de passe : c'est acceptable en local car le port 27017 n'est pas publié, mais en production il faudrait activer l'authentification (`MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`).
- Fermeture de MongoDB à l'arrêt : `src/server.ts` et `src/config/db.ts` gèrent tous les deux le signal SIGTERM, et celui de `server.ts` quitte le programme dès que le serveur HTTP est fermé, avant la fin de la déconnexion de MongoDB. L'arrêt reste propre côté Docker (code 0), mais il faudrait regrouper les deux dans le code.
- Vulnérabilités : `npm audit --omit=dev` trouve 9 vulnérabilités dans les dépendances de production (1 critique, 5 élevées, 3 modérées). Comme ce sont des dépendances de production, elles sont dans l'image Docker. Il faudra relancer la commande et corriger (`npm audit fix`, puis relancer les tests) avant une vraie mise en production.
- Version de Node : le `package.json` n'a pas de champ `engines` pour préciser la version minimale ou exacte de Node du projet et le README indique encore Node 18. L'image utilise Node 24, il faudrait aligner ces deux fichiers.
- Versions non figées : `node:24-alpine` et `mongo:7` suivent les nouvelles versions (mineures et correctives), et la version d'Alpine change aussi avec le tag Node. Une reconstruction plus tard peut donc donner une image un peu différente. Pour un déploiement réel, il faudrait fixer la version exacte, par exemple `node:24.22.1-alpine`.
