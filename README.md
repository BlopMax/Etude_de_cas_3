# Visiplus - Serveur Kanban Node.js

## Présentation

L'entreprise Jaydee fabrique des pièces plastiques par injection. Pour améliorer le suivi de la production et la gestion des priorités, elle a développé une application interne, Jaydee Kanban, qui repose sur cette API Node.js / Express connectée à une base MongoDB. Les ordres de fabrication (OF) sont rangés dans des colonnes et déplacés de l'une à l'autre au fil de la production.

J'interviens comme développeur DevOps chargé de préparer la mise en production de l'application, à partir du code existant. L'objectif est d'assurer sa testabilité, sa sécurité et la reproductibilité de son déploiement. Le travail a été fait en sept étapes : analyse de l'existant, tests d'intégration, conteneurisation, stratégie CI/CD, documentation du déploiement, sécurisation, puis synthèse dans ce README.

## Structure du projet

```
├── src/
│   ├── main.ts                 # Entrée principale (création du serveur)
│   ├── server.ts               # Connexion MongoDB, démarrage et arrêt du serveur
│   ├── app.ts                  # Exporte Express app (pour tests)
│   ├── config/
│   │   ├── env.ts              # Chargement et validation des variables d'environnement
│   │   ├── db.ts               # Connexion base de données (Mongoose)
│   │   └── logger.ts           # Logger (Pino)
│   ├── models/
│   │   ├── OF.ts               # Modèle Ordre de Fabrication
│   │   ├── Column.ts           # Modèle Colonne
│   │   └── User.ts             # Modèle Utilisateur
│   ├── routes/
│   │   ├── index.ts            # Regroupe les routes (OF, Columns, Auth)
│   │   ├── ofs.routes.ts
│   │   ├── columns.routes.ts
│   │   └── auth.routes.ts      # Inscription et connexion (logique dans le fichier, sans contrôleur)
│   ├── controllers/
│   │   ├── ofs.controller.ts   # Logique des OF (move, create, delete)
│   │   └── columns.controller.ts
│   └── middlewares/
│       ├── auth.middleware.ts  # Vérification JWT
│       ├── error.middleware.ts # Gestion globale des erreurs
│       ├── security.middleware.ts # En-têtes de sécurité (helmet)
│       └── validate.middleware.ts # Validation Zod
├── tests/
│   ├── README.md               # Documentation des tests
│   ├── setup.ts                # Base MongoDB en mémoire
│   ├── helpers.ts              # Création des données de test
│   ├── columns.test.ts         # Tests des routes des colonnes
│   ├── security.test.ts        # Tests de helmet et des erreurs 401
│   └── *.d.ts                  # Fichiers fournis avec le code de base
├── .env.example                # Modèle du fichier .env
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml          # API + MongoDB
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
├── ANALYSE_EXISTANT.md         # Étape 1 : analyse du code existant
├── CI_CD_STRATEGIE.md          # Étape 4 : stratégie CI/CD
├── DEPLOYMENT_GUIDE.md         # Étape 5 : guide de déploiement
├── NOTE_SECURITE.md            # Étape 6 : note de sécurité
└── README.md
```

## Prérequis

- Node.js (version 20 ou supérieure ; l'image Docker utilise Node 24)
- npm
- MongoDB (local), seulement pour lancer l'API sans Docker
- Docker Desktop, pour lancer le projet avec Docker

## Installation

Les commandes sont à lancer depuis le dossier du projet, dans un terminal bash (Git Bash sous Windows) ou dans l'invite de commandes Windows (cmd). Elles sont identiques dans les deux cas, sauf la copie du `.env` (étape 2).

1. Installer les dépendances aux versions exactes du `package-lock.json` :
```bash
npm ci
```

2. Créer un fichier `.env` à la racine du projet, à partir de `.env.example` :
```bash
cp .env.example .env
```

```cmd
copy .env.example .env
```

Dans le `.env`, remplacer `JWT_SECRET` par une valeur secrète d'au moins 32 caractères : la valeur d'exemple passe la validation et ne doit jamais partir en production. `MONGODB_URI` doit pointer vers une base MongoDB. Pour en lancer une en local avec Docker, et pour le rôle des autres variables, voir `DEPLOYMENT_GUIDE.md`.

3. Démarrer le serveur en mode développement :
```bash
npm run dev
```

### Avec Docker Compose

Après avoir créé le `.env` (étape 2 de l'installation), cette commande lance l'API et MongoDB ensemble (pas besoin d'installer MongoDB) :
```bash
docker compose up -d --build
```

L'API répond sur `http://localhost:3000/health`, et `docker compose down` arrête tout. Le détail (Docker sans Compose, mise à jour, vérifications) est dans `DEPLOYMENT_GUIDE.md`.

## Scripts disponibles

- `npm run dev` - Démarre le serveur en mode développement avec hot reload (tsx watch)
- `npm run build` - Compile TypeScript en JavaScript
- `npm start` - Démarre le serveur en production (nécessite `npm run build` d'abord)
- `npm test` - Lance les tests avec Vitest (en mode watch dans un terminal)
- `npm run test:coverage` - Lance les tests avec le rapport de couverture

## Routes de l'API

- `GET /health` - Vérifier l'état du serveur
- `POST /api/auth/register` et `POST /api/auth/login` - Créer un compte et se connecter (renvoient un token JWT)
- `/api/columns` - Lister, obtenir, créer, modifier et supprimer les colonnes (authentification requise)
- `/api/ofs` - Lister, obtenir, créer, modifier et supprimer les OF, et les déplacer avec `PATCH /api/ofs/:id/move` (authentification requise)

Pour les routes protégées, le token se transmet dans l'en-tête `Authorization: Bearer <token>`. Sans token valide, elles renvoient 401.

## Tests

```bash
# Exécuter tous les tests une fois
npm test -- --run

# Avec le rapport de couverture
npm run test:coverage -- --run
```

Les tests utilisent **MongoDB Memory Server** (une instance MongoDB en mémoire) : ni MongoDB ni Docker ne sont nécessaires, mais un accès Internet est requis au premier lancement pour télécharger le binaire MongoDB. Le fichier `.env` est en revanche obligatoire, car `src/config/env.ts` arrête le programme si `MONGODB_URI` ou `JWT_SECRET` manquent. Voir `tests/README.md` pour plus de détails.

## Choix techniques

- Tests d'intégration avec Vitest et Supertest sur une base en mémoire : chaque test part d'une base vide, sans serveur MongoDB externe.
- Docker : Dockerfile en deux étapes. La première compile le TypeScript, la seconde ne garde que `dist/` et les dépendances de production. L'image est basée sur `node:24-alpine`, et le serveur tourne avec l'utilisateur `node` plutôt qu'en root.
- Docker Compose : l'API attend que MongoDB soit en bonne santé avant de démarrer, et les données sont conservées dans un volume.
- CI/CD avec GitHub Actions (stratégie décrite, pas encore mise en place dans le dépôt) : tests et build de l'image Docker à chaque push, puis déploiement à chaque release, après validation manuelle. Le détail est dans `CI_CD_STRATEGIE.md`.

## Sécurité

- Authentification : les routes `/api/columns` et `/api/ofs` sont protégées par le middleware `authenticate` (JWT). Les tests vérifient le code 401 sans token ou avec un faux token.
- En-têtes HTTP : le middleware `helmet` (`src/middlewares/security.middleware.ts`), activé dans `src/app.ts`, retire `X-Powered-By` et ajoute notamment `X-Content-Type-Options: nosniff` sur toutes les réponses.
- Secrets : le `.env` n'est ni versionné (`.gitignore`) ni copié dans l'image Docker (`.dockerignore`). L'application refuse de démarrer si `MONGODB_URI` ou `JWT_SECRET` manquent.
- Dépôt : `git ls-files` confirme que ni `node_modules/`, ni `.env`, ni `dist/`, ni `coverage/` ne sont suivis. Testé dans un dossier vide : après `git clone`, `npm ci` et la copie du `.env`, les 14 tests passent avec `npm test -- --run` et `npm run build` compile sans erreur.

Points non corrigés (détaillés dans `NOTE_SECURITE.md` et `ANALYSE_EXISTANT.md`) : pas de limite de tentatives sur `/api/auth/login`, inscription ouverte à tous, risque d'injection NoSQL dans les mises à jour, et vulnérabilités signalées par `npm audit` dans les dépendances.

## Auteur et version

- Auteur : Maxime Naux, étude de cas 3
- Version : 1.0.0 (voir `package.json`)
- Code de base de l'API fourni dans le cadre de l'étude de cas