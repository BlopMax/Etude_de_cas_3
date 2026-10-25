# Stratégie CI/CD - Visiplus

La CI/CD (intégration continue / déploiement continu) consiste à tester et construire automatiquement l'application à chaque modification du code, puis à la déployer quand une nouvelle version est prête. J'utilise GitHub Actions, puisque le code est déjà sur GitHub.

## Objectifs

- Automatisation : les tests et le build se lancent tout seuls, on n'a plus besoin d'y penser.
- Fiabilité : tout se passe sur une machine neuve, avec les versions exactes du `package-lock.json` grâce à `npm ci`.
- Qualité : un code qui ne passe pas les tests ne peut pas arriver sur `main`, ni en production.

## La pipeline

Elle se lance à chaque push, sur toutes les branches. Le résultat s'affiche aussi dans les pull requests, puisqu'une pull request contient les commits poussés sur sa branche.

Les étapes :

1. Installation des dépendances avec `npm ci`, sur Node 20, la version minimale indiquée dans le guide de déploiement.
2. Tests avec `npm test -- --run`. La base MongoDB est créée en mémoire, mais `src/config/env.ts` demande quand même `MONGODB_URI` et `JWT_SECRET`, donc je copie le `.env.example` en `.env` (le `.env` contient des fausses valeurs).
3. Build de l'image avec `docker build`. Le `Dockerfile` compile le TypeScript sous Node 24, ce qui vérifie le code et le `Dockerfile` en même temps.
4. Déploiement, seulement quand on publie une release (par exemple `v1.0.0`). C'est un deuxième job, qui n'est pas dans l'extrait ci-dessous.

## Extrait de la pipeline (`.github/workflows/ci.yml`)

```yaml
on:
  push:
    branches: ["**"]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 20 }
      - run: cp .env.example .env
      - run: npm ci
      - run: npm test -- --run
      - run: docker build -t visiplus .
```

## Mise en production

Le job de déploiement envoie l'image sur le registre de GitHub (`ghcr.io/blopmax/visiplus:v1.0.0`), puis se connecte au serveur en SSH. Sur le serveur, on utilise la copie `docker-compose.prod.yml` décrite dans le guide, avec `image: ghcr.io/blopmax/visiplus:${VERSION}` à la place de `build: .`. Le job écrit le numéro de version dans le `.env` du serveur (`VERSION=v1.0.0`), puis lance :

```
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Avant d'arriver là, il y a plusieurs validations :

- Une pull request ne peut être fusionnée que si la pipeline est réussie et qu'une autre personne l'a relue. On ne peut pas pousser directement sur `main`. Ces règles se configurent dans les paramètres du dépôt, dans les règles de protection de la branche `main`.
- Le déploiement part seulement d'une release, et GitHub demande une validation manuelle sur l'environnement de `production`.
- Après le déploiement, la route `/health` doit répondre. Si ce n'est pas le cas, on remet l'ancienne version dans le `.env` du serveur (`VERSION=v0.9.0`) et on relance `docker compose -f docker-compose.prod.yml up -d`.

## Gestion des secrets

- Le `.env` n'est jamais sur Git (il est dans le `.gitignore`). Seul `.env.example` y est, avec des fausses valeurs, ce qui suffit pour les tests.
- Les vraies valeurs de production sont dans les secrets du dépôt GitHub : `JWT_SECRET`, le mot de passe MongoDB de la copie du docker compose et la clé SSH du serveur. GitHub les masques dans les logs. Pour le registre, le job utilise le jeton fourni automatiquement par GitHub (`GITHUB_TOKEN`), donc il n'y a pas de mot de passe en plus.
- Les secrets ne sont jamais dans l'image (le `.dockerignore` exclut `.env`). Le job de déploiement les écrit dans le `.env` du serveur, et docker compose les lit au lancement.
