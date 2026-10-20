# Visiplus - Kanban Node.js Server

Serveur Express avec MongoDB pour application Kanban.

## Structure du projet

```
├── src/
│   ├── main.ts                 # Entrée principale (création du serveur)
│   ├── server.ts               # Configuration Express
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
│   │   └── auth.routes.ts
│   ├── controllers/
│   │   ├── ofs.controller.ts   # Appelle les services (move, create, delete)
│   │   └── columns.controller.ts
│   └── middlewares/
│       ├── auth.middleware.ts  # Vérification JWT
│       ├── error.middleware.ts # Gestion globale des erreurs
│       └── validate.middleware.ts # Validation Zod
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

## Prérequis

- Node.js (version 18 ou supérieure)
- MongoDB (local ou Atlas)
- npm ou yarn

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Créer un fichier `.env` à la racine du projet :
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/visiplus
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

3. Démarrer le serveur en mode développement :
```bash
npm run dev
```

## Scripts disponibles

- `npm run dev` - Démarre le serveur en mode développement avec hot reload (tsx watch)
- `npm run build` - Compile TypeScript en JavaScript
- `npm start` - Démarre le serveur en production (nécessite `npm run build` d'abord)
- `npm test` - Lance les tests avec Vitest

## API Endpoints

### Authentication

- `POST /api/auth/register` - Créer un compte utilisateur
- `POST /api/auth/login` - Se connecter

### Columns

- `GET /api/columns` - Lister toutes les colonnes
- `GET /api/columns/:id` - Obtenir une colonne
- `POST /api/columns` - Créer une colonne (authentification requise)
- `PUT /api/columns/:id` - Mettre à jour une colonne (authentification requise)
- `DELETE /api/columns/:id` - Supprimer une colonne (authentification requise)

### OFs (Ordres de Fabrication)

- `GET /api/ofs` - Lister tous les OFs (optionnel: `?columnId=xxx`)
- `GET /api/ofs/:id` - Obtenir un OF (authentification requise)
- `POST /api/ofs` - Créer un OF (authentification requise)
- `PUT /api/ofs/:id` - Mettre à jour un OF (authentification requise)
- `PATCH /api/ofs/:id/move` - Déplacer un OF (authentification requise)
- `DELETE /api/ofs/:id` - Supprimer un OF (authentification requise)

### Health Check

- `GET /health` - Vérifier l'état du serveur

### Exécution des tests

```bash
# Exécuter tous les tests
npm test

# Exécuter en mode watch
npm test -- --watch
```

Les tests utilisent **MongoDB Memory Server** (une instance MongoDB en mémoire). Aucune installation de MongoDB n'est nécessaire pour exécuter les tests. Voir `tests/README.md` pour plus de détails.

Le serveur utilise TypeScript avec ES modules. En développement, utilisez `tsx` pour le hot reload automatique.