# Note de sécurité - Visiplus

## Les deux risques

Fuite d'informations par les en-têtes HTTP. Avant, chaque réponse de l'API contenait `X-Powered-By: Express`. Cet en-tête révèle à un attaquant la technologie utilisée, ce qui lui permet de chercher directement les failles connues d'Express. Il manquait aussi `X-Content-Type-Options: nosniff`, qui empêche un navigateur de deviner le type d'une réponse au lieu de lire le `Content-Type`. C'est ce risque que j'ai corrigé.

Accès non autorisé. Les colonnes et les OF doivent être réservés aux utilisateurs connectés. Le code fourni protégeait déjà `/api/columns` et `/api/ofs` avec le middleware `authenticate` (token JWT), et je ne l'ai pas modifié. À l'étape 2, je n'avais testé que le 401 sans token sur `/api/columns`. Dans `security.test.ts`, j'ai étendu ces tests à `/api/ofs` et au cas d'un faux token.

## Ce que j'ai fait

J'ai choisi `helmet` parce qu'il traite le premier risque. La fuite d'informations touchait toutes les réponses de l'API, y compris celles des routes publiques comme `/health` ou `/api/auth/login`, que tout le monde peut appeler sans compte. helmet s'applique à toutes les réponses : il retire `X-Powered-By` et ajoute `nosniff`. `express-rate-limit`, lui, traite un autre risque (trop de tentatives de connexion) que je n'ai pas retenu ici.

Le middleware se trouve dans `src/middlewares/security.middleware.ts` et il est activé dans `src/app.ts` avec `app.use(securityHeaders)`, avant les routes. helmet ajoute aussi d'autres en-têtes (`Content-Security-Policy`, `Strict-Transport-Security`...) qui servent surtout pour des pages web, pas pour du JSON. Je les ai conservés, car ils ne gênent pas le fonctionnement de l'API.

Pour vérifier, `tests/security.test.ts` contrôle les en-têtes sur la route publique `/health`, sur `/api/auth/login` (erreur 400 sans identifiants), et sur `/api/columns` et `/api/ofs` (erreur 401 sans token). helmet fonctionne donc sur les routes publiques comme sur les routes protégées. Les tests vérifient aussi `/api/columns` et `/api/ofs` sans token (401, `No token provided`), avec un faux token (401, `Invalid or expired token`) et avec un vrai token (200). Les 14 tests du projet passent.

Avec l'API lancée par Docker Compose :

```
curl -s -w "\nHTTP %{http_code}\n" http://localhost:3000/api/columns
{"error":"No token provided"}
HTTP 401
```

## Limites

Dans l'analyse de l'existant, j'avais aussi relevé d'autres problèmes qui ne sont pas corrigés ici :

- aucune limite sur `/api/auth/login`, ce qui permet de tester des mots de passe à l'infini (attaque par force brute) ;
- n'importe qui peut créer un compte avec `/api/auth/register` ;
- dans les mises à jour, `req.body` est envoyé tel quel à MongoDB, ce qui peut permettre une injection NoSQL.
