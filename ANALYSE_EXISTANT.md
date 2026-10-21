# ANALYSE_EXISTANT — Jaydee Kanban

Analyse du code (37 fichiers), « Constaté » : observé via `npm install`, `dev`, `test`, `build`, `audit` ou `package-lock.json`. Le reste vient de la lecture du code.

## 1. Structure du projet

API REST TypeScript (modules ES), Express 5.1 et Mongoose 8.19 sur MongoDB : routes, contrôleurs, modèles. Pas de couche « services » : `createOF`, `moveOF` et `deleteOF` appellent directement le modèle `OF` (README l.26 inexact).

| Élément | Détail |
|---|---|
| Dépendances | express 5.1.0, mongoose 8.19.2, zod 4.1.12, jsonwebtoken 9.0.2, bcryptjs 3.0.2, cors, dotenv, pino. `helmet` et `express-rate-limit` sont installés mais jamais utilisés (constaté). |
| Variables d'environnement | `MONGODB_URI` (et non `MONGO_URI`) et `JWT_SECRET` (32 caractères minimum), obligatoires ; `PORT` (3000), `NODE_ENV`, `JWT_EXPIRES_IN` (7d), `CORS_ORIGIN` (`*`). |
| Fichiers clés | `config/env.ts`, `config/db.ts`, `auth.middleware.ts`, `ofs.controller.ts`, `tests/setup.ts`. |
| Routes | `/health` ; `/api/auth/register` et `/login` (publiques) ; `/api/columns` et `/api/ofs` (JWT exigé). |
| Tests | 35 tests passent (app 1, auth 11, ofs 23) ; `columns.test.ts` n'a qu'un commentaire (« No test suite found »). `install` et `dev` fonctionnent, `test` et `build` échouent (#9, #10). Tout est constaté. |

## 2. Risques et anomalies

| # | Gravité | Constat |
|---|---|---|
| 1 | Haute | **Inscription publique** (`auth.routes.ts:48`) : toute personne qui atteint l'API obtient un JWT valable partout, sans rôle (constaté : les tests d'inscription passent sans jeton). Application interne : à fermer. |
| 2 | Haute | `helmet` et `express-rate-limit` ne sont pas utilisés (constaté) : le login n'est pas protégé contre le bruteforce. `CORS_ORIGIN` vaut `*` par défaut (`env.ts:28`). |
| 3 | Haute | **La validation Zod n'a pas d'effet sur les données** : le résultat de `parse` est ignoré (`validate.middleware.ts:34`) et `req.body` va tel quel dans `findByIdAndUpdate` (`columns.controller.ts:135`, `ofs.controller.ts:132`) : des opérateurs MongoDB (`$set`, `$inc`) sont potentiellement injectables (à tester). |
| 4 | Haute | L'URI MongoDB, identifiants compris, est écrite dans les logs au démarrage (`db.ts:25`, constaté) ; hors production, `err.message` part au client (`error.middleware.ts:74-77`). |
| 5 | Haute | 21 vulnérabilités npm (constaté) : 3 critiques, 12 hautes, 6 modérées. 9 sont en production, dont 1 critique (`proxy-addr`, sans `trust proxy` ici), `jws` (JWT) et `mongoose` ; 12 sont dans les tests, dont 2 critiques (`vitest`, `@vitest/coverage-v8`). |
| 6 | Moyenne | **Bug dans `moveOF`** : `oldColumnId` est lu après la mise à jour de `columnId` (`ofs.controller.ts:213` puis `:219`), d'où des positions décalées dans la mauvaise colonne. `ofs.test.ts:250` ne le détecte pas. |
| 7 | Moyenne | `CastError` non géré (500), OFs orphelins après `deleteColumn` (`OF.ts:32`), `/health` sans test MongoDB (`app.ts:38`), arrêt géré en double (`db.ts`, `server.ts`). |
| 8 | Moyenne | Mot de passe : 6 caractères minimum et aucun maximum (`auth.routes.ts:22`) ; « User already exists » (`:58`) révèle les comptes existants. |
| 9 | Bloquante | `npm run build` échoue avec 4 erreurs TS6059 (constaté) : `rootDir` vaut `./src` (`tsconfig.json:7`) alors que `include` ajoute `tests/**/*` (`:19`). `tsc` écrit quand même des `.js` dans `tests/`. Correctif simple : retirer `tests/**/*` de `include`. |
| 10 | Moyenne | `npm test` échoue (constaté) : `columns.test.ts` est vide ; sans variables d'environnement, toutes les suites échouent (`env.ts:44`) ; les `tests/*.js` générés sont aussi collectés (8 fichiers au lieu de 4). |
| 11 | Faible | README : Node ≥ 18, mais vitest et vite demandent ≥ 20.19 (constaté) ; pas de `engines`. |
| 12 | Moyenne | Ni `.gitignore`, `.env.example`, Dockerfile ni CI : `.env` (secrets), `node_modules/`, `dist/` et `tests/*.js` générés risquent d'être versionnés. |

## 3. Priorités avant mise en production

1. **Bloquant** : `tsconfig.json` (#9), `columns.test.ts` (#10), `.gitignore` et `.env.example` (#12).
2. **Sécurité** : `/register` (#1), `helmet`, rate-limit et CORS (#2), résultat Zod (#3), URI dans les logs (#4), `npm audit fix` (#5).
3. **Ensuite** : `moveOF` (#6), robustesse (#7), mots de passe (#8), Node ≥ 20.19 et README (#11).