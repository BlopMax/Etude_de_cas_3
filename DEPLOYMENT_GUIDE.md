# Guide de déploiement - Visiplus

Visiplus est une API Kanban (Node.js, Express, TypeScript) qui stocke ses données dans MongoDB. Ce guide explique comment l'installer et la lancer en local ou avec Docker, comment lancer les tests et comment la mettre à jour. La fin du guide détaille la conteneurisation (Dockerfile, docker-compose) et les vérifications faites.

## Prérequis

- Git
- Docker Desktop installé et démarré (testé sous Windows 11 avec Docker 29.6.2)
- Node.js 20 minimum avec npm, pour lancer le projet sans Docker et pour les tests (testé avec Node 20.20.1, l'image Docker utilise Node 24)
- Un fichier `.env` à la racine du projet, copié depuis `.env.example`

Les commandes du guide sont à lancer dans l'invite de commandes Windows (cmd), depuis le dossier du projet.

Variables d'environnement lues par l'application (`src/config/env.ts`) :

| Variable | Rôle (valeur par défaut) |
|---|---|
| `NODE_ENV` | `development`, `production` ou `test` (défaut `development`) |
| `PORT` | port HTTP de l'API (défaut `3000`) |
| `MONGODB_URI` | adresse de la base MongoDB, obligatoire (ex. `mongodb://localhost:27017/visiplus`) |
| `JWT_SECRET` | clé de signature des tokens, obligatoire, 32 caractères minimum |
| `JWT_EXPIRES_IN` | durée de validité des tokens (défaut `7d`) |
| `CORS_ORIGIN` | origine autorisée par CORS (défaut `*`) |

---

## Installation et exécution en local (sans Docker)

Récupérer le code, installer les dépendances et créer le `.env` :
```
git clone https://github.com/BlopMax/Etude_de_cas_3.git
cd Etude_de_cas_3
npm ci
copy .env.example .env
```

Dans le `.env`, `MONGODB_URI` doit pointer vers une base MongoDB. Si MongoDB n'est pas installé sur le PC, je le lance avec Docker :
```
docker run -d --name mongo-dev -p 27017:27017 mongo:7
```

Ensuite on lance l'API, soit en mode développement (elle redémarre à chaque modification du code) :
```
npm run dev
```

soit en mode production, après avoir compilé le TypeScript dans `dist/` :
```
npm run build
npm start
```

L'API répond sur `http://localhost:3000/health`. On l'arrête avec Ctrl+C, et la base avec `docker rm -f mongo-dev`.

---

## Lancer le projet avec Docker

La méthode la plus simple est Docker Compose, qui lance l'API et MongoDB ensemble. L'image de l'API est construite à partir du `Dockerfile` (ligne `build: .` du service `app`).

### Avec Docker Compose

```
docker compose up -d --build
```

`--build` reconstruit l'image de l'API (à faire après chaque modification du code) et `-d` lance les conteneurs en arrière-plan.

Commandes que j'utilise ensuite :
```
docker compose ps
docker compose logs -f app
docker compose down
```

La première affiche l'état des conteneurs, la deuxième les logs de l'API, et la dernière arrête tout. Les données restent dans le volume, sauf avec `docker compose down -v`.

### Sans Docker Compose

On peut aussi faire les mêmes étapes à la main, par exemple pour tester l'image seule :
```
docker build -t visiplus .
docker network create visiplus-net
docker run -d --name mongo --network visiplus-net --restart unless-stopped -v visiplus-mongo-data:/data/db mongo:7
docker run -d --name visiplus --network visiplus-net --restart unless-stopped -p 3000:3000 --env-file .env -e MONGODB_URI=mongodb://mongo:27017/visiplus -e NODE_ENV=production visiplus
```

Le réseau `visiplus-net` permet à l'API de joindre MongoDB par le nom du conteneur, `mongo`. `--env-file .env` donne au conteneur `JWT_SECRET`, `JWT_EXPIRES_IN` et `CORS_ORIGIN`, et les `-e` remplacent `MONGODB_URI` et `NODE_ENV` du `.env`, qui sont prévus pour le local.

Pour tout arrêter :
```
docker rm -f visiplus mongo
docker network rm visiplus-net
```

---

## Commandes de test

Les tests utilisent `mongodb-memory-server`, qui crée une base MongoDB en mémoire : pas besoin de MongoDB ni de Docker. Il faut quand même le `.env`, car `src/config/env.ts` arrête le programme si `MONGODB_URI` ou `JWT_SECRET` manquent (testé : sans `.env`, aucun test ne se lance). Au premier lancement, le binaire MongoDB est téléchargé.

```
npm test -- --run
npm run test:coverage -- --run
npm test -- --run tests/columns.test.ts
npm run build
```

Dans l'ordre : tous les tests une fois (sans `--run`, vitest reste en mode watch), les tests avec le rapport de couverture dans `coverage/`, un seul fichier de test, et la vérification que le TypeScript compile.

---

## Procédure de mise à jour

Ici, la mise à jour est faite à la main sur la machine. En production, c'est la CI/CD (`CI_CD_STRATEGIE.md`) qui construit l'image, et le serveur lance seulement `docker compose -f docker-compose.prod.yml pull` puis `docker compose -f docker-compose.prod.yml up -d`.

1. Récupérer le nouveau code, réinstaller les dépendances du `package-lock.json` et lancer les tests :
```
git pull
npm ci
npm test -- --run
```

2. Reconstruire et relancer l'API. Avec Docker Compose, seul le conteneur de l'API est recréé, MongoDB et ses données ne bougent pas :
```
docker compose up -d --build
```

Sans Docker Compose, je reconstruis l'image, je supprime le conteneur de l'API et je le relance avec la même commande `docker run` que plus haut :
```
docker build -t visiplus .
docker rm -f visiplus
docker run -d --name visiplus --network visiplus-net --restart unless-stopped -p 3000:3000 --env-file .env -e MONGODB_URI=mongodb://mongo:27017/visiplus -e NODE_ENV=production visiplus
```

En local sans Docker : `npm run build` puis `npm start` (ou `npm run dev`).

3. Vérifier que l'API répond, et avec Docker Compose que les conteneurs sont `healthy` :
```
curl http://localhost:3000/health
docker compose ps
```

En cas de problème, je reviens au commit précédent avec `git checkout <hash du commit>`, puis je refais l'étape 2. Pour revenir ensuite à la dernière version : `git checkout main`.

---

## Fichiers ajoutés pour Docker

- `Dockerfile` : construit l'image de production de l'API
- `.dockerignore` : liste les fichiers à ne pas envoyer à Docker pendant le build (`node_modules`, `.env`, les tests...)
- `docker-compose.yml` : lance l'API et une base MongoDB ensemble

## Le Dockerfile

Le projet est en TypeScript, mais Node.js ne lit que du JavaScript. Il faut donc d'abord compiler le code avec `npm run build`, ce qui crée le dossier `dist/`.

J'ai donc fait un Dockerfile en deux étapes :

1. Étape `builder` : on installe toutes les dépendances (avec TypeScript) puis on compile `src/` en `dist/`.
2. Étape `runner` : on repart d'une image Node propre, on installe seulement les dépendances de production (`npm ci --omit=dev`) et on récupère uniquement le dossier `dist/` de l'étape `builder` avec `COPY --from=builder`.

L'image finale ne contient donc ni TypeScript, ni vitest, ni le code source de `src/` (voir Vérification, point 4).

J'ai pris l'image de base `node:24-alpine` : Node 24 est une version LTS, c'est celle de `@types/node` dans le projet, et Alpine donne une image plus légère que Debian.

Le reste des lignes :

- `package*.json` est copié avant le code source, pour que Docker réutilise le cache du `npm ci` quand seul le code change.
- `ENV NODE_ENV=production` : les logs passent au format JSON (`src/config/logger.ts`).
- `npm cache clean --force` : supprime le cache de npm, dans le même `RUN` que `npm ci` pour qu'il ne reste pas dans l'image.
- `USER node` : le serveur ne tourne pas en root.
- `EXPOSE 3000` : indique le port de l'application.
- `CMD ["npm", "start"]` : lance `node dist/main.js`.

Le `.env` n'entre pas dans l'image : le Dockerfile ne le copie pas et le `.dockerignore` l'exclut. Les variables sont données au lancement du conteneur.

## Le docker-compose.yml

### Service `mongo`

- `image: mongo:7` : image officielle.
- `healthcheck` : toutes les 10 secondes, Docker envoie un `ping` à la base avec `mongosh`.
- `volumes: mongo-data:/data/db` : les données sont gardées dans le volume `mongo-data`, même si on supprime le conteneur.
- Pas de `ports:`, la base n'est accessible que par l'API.

### Service `app`

- `build: .` : l'image est construite avec notre `Dockerfile`.
- `depends_on` avec `condition: service_healthy` : l'API attend que MongoDB réponde avant de démarrer.
- `healthcheck` : Docker appelle `/health` toutes les 30 secondes.
- `ports: "3000:3000"` : l'API est accessible sur `localhost:3000`.
- `restart: unless-stopped` (sur les deux services) : le conteneur redémarre s'il plante.

### Les variables d'environnement

Docker Compose lit le `.env` pour remplacer les `${...}`. `JWT_SECRET` est obligatoire (`:?`, docker compose refuse de démarrer sans). `JWT_EXPIRES_IN` et `CORS_ORIGIN` ont une valeur par défaut (`:-7d` et `:-*`), parce qu'une variable absente serait envoyée vide au conteneur et les valeurs par défaut de `src/config/env.ts` ne s'appliqueraient plus.

`NODE_ENV` et `MONGODB_URI` sont écrites directement dans le compose. Pour `MONGODB_URI`, celle du `.env` ne marcherait pas : elle vaut `localhost`, et dans un conteneur `localhost` désigne le conteneur lui-même. Le compose utilise donc `mongodb://mongo:27017/visiplus`, où `mongo` est le nom du service.

Cette adresse n'a pas de mot de passe, ce compose sert au développement. En production, je copie le `docker-compose.yml` en `docker-compose.prod.yml` et je modifie la copie :

- dans le service `mongo`, ajouter `MONGO_INITDB_ROOT_USERNAME` et `MONGO_INITDB_ROOT_PASSWORD`, et mettre l'utilisateur et le mot de passe dans l'adresse de l'API (`mongodb://<utilisateur>:<mot de passe>@mongo:27017/visiplus?authSource=admin`), avec le mot de passe lu dans le `.env` du serveur ;
- dans le service `app`, remplacer `build: .` et `image: visiplus:latest` par `image: ghcr.io/blopmax/visiplus:${VERSION}`, l'image construite par la CI/CD. `VERSION` (par exemple `v1.0.0`) est écrite dans le `.env` du serveur au déploiement.

On lance ensuite cette copie avec `docker compose -f docker-compose.prod.yml up -d`.

---

## Vérification

Tests faits avec Docker Compose (sauf le point 7).

1. Les deux conteneurs sont lancés et en bonne santé :

```
docker compose ps
NAME               IMAGE             COMMAND                  SERVICE   CREATED          STATUS                    PORTS
visiplus-app-1     visiplus:latest   "docker-entrypoint.s…"   app       37 seconds ago   Up 35 seconds (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
visiplus-mongo-1   mongo:7           "docker-entrypoint.s…"   mongo     55 seconds ago   Up 50 seconds (healthy)   27017/tcp
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


Résultat :

```
{"message":"User registered successfully","data":{"token":"eyJhbGciOi...","user":{"id":"6ada5cdf3b346f213b03e658","email":"test@exemple.fr"}}}
HTTP 201
```

4. Le contenu de l'image :

```
docker run --rm visiplus sh -c "id; node -v; ls dist"
uid=1000(node) gid=1000(node) groups=1000(node),1000(node)
v24.22.1
app.d.ts  app.d.ts.map  app.js  app.js.map  config  controllers  main.d.ts  main.d.ts.map  main.js  main.js.map
middlewares  models  routes  server.d.ts  server.d.ts.map  server.js  server.js.map
```

Le serveur tourne avec l'utilisateur `node`, et `dist/` contient seulement le code compilé, sans les tests.

```
docker run --rm visiplus ls node_modules/typescript node_modules/vitest
ls: node_modules/typescript: No such file or directory
ls: node_modules/vitest: No such file or directory
```

TypeScript et vitest ne sont pas installés dans l'image.

5. L'arrêt : après `docker compose stop app`, les logs et le statut montrent que l'API a reçu le signal et s'est arrêtée sans erreur :

```
docker compose logs app
...
{"level":30,"time":1792772493445,"pid":19,"hostname":"5f4927875c57","signal":"SIGTERM","msg":"Received shutdown signal"}
{"level":30,"time":1792772493445,"pid":19,"hostname":"5f4927875c57","msg":"HTTP server closed"}

docker compose ps -a
NAME             ...   STATUS
visiplus-app-1   ...   Exited (0) 48 seconds ago
```

6. Sans variables d'environnement (`docker run --rm visiplus`), le conteneur s'arrête tout de suite avec un message qui dit que `MONGODB_URI` et `JWT_SECRET` manquent (validation de `src/config/env.ts`).

7. Sans Docker Compose : `/health` répond 200 et l'inscription 201, et les logs montrent que `NODE_ENV` vaut bien `production` :

```
docker logs visiplus
...
{"level":30,...,"port":3000,"env":"production","msg":"🚀 Server running on port 3000"}
```

---

## Limites

- MongoDB n'a pas de mot de passe en local. En production, il faut l'ajouter dans la copie du compose (voir « Les variables d'environnement »).
- `src/server.ts` et `src/config/db.ts` gèrent tous les deux l'arrêt (SIGTERM), et `server.ts` quitte le programme avant la fin de la déconnexion de MongoDB. Il faudrait regrouper les deux.
- `npm audit --omit=dev` trouve 10 vulnérabilités dans les dépendances de production (1 critique, 7 élevées, 2 modérées), qui sont donc aussi dans l'image. Il faudrait les corriger avec `npm audit fix` avant une vraie mise en production.
- Le `package.json` n'a pas de champ `engines` pour la version de Node, et le README indique encore Node 18 alors que l'image utilise Node 24.
- `node:24-alpine` et `mongo:7` ne sont pas des versions exactes : une reconstruction plus tard peut donner une image un peu différente. On pourrait fixer par exemple `node:24.22.1-alpine`.
