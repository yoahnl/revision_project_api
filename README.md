# Revision API

Backend NestJS du MVP Revision. Ce repo est autonome et peut etre deploye par
Dokploy avec le `Dockerfile` present a la racine.

## Stack

- NestJS
- Prisma + PostgreSQL
- BullMQ + Redis
- Firebase Admin
- Genkit + Google GenAI

## Local

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run start:dev
```

Services locaux attendus :

- PostgreSQL sur `localhost:5432`
- Redis sur `localhost:6379`
- Les PDF importes sont stockes par defaut dans `storage/revision-documents`

## Verification

```bash
npm run lint:check
npm run test
npm run test:e2e
npm run build
```

## Docker

```bash
docker build -t revision-api:local .
docker run --rm -p 8080:8080 --env-file .env revision-api:local
```

L'API expose `/health`.

## Dokploy

Configurer une application Docker depuis ce repo GitHub :

```text
yoahnl/revision_project_api
```

Variables requises en production :

- `DATABASE_URL`
- `REDIS_URL` ou `REDIS_HOST` + `REDIS_PORT`
- `FIREBASE_PROJECT_ID=revision-app-1b799`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `DOCUMENT_STORAGE_ROOT=/data/revision-documents`
- `GOOGLE_GENAI_API_KEY`
- `GENKIT_MODEL` optionnel, defaut `googleai/gemini-2.5-flash`
- `RUN_PRISMA_MIGRATIONS=true` pour appliquer `prisma migrate deploy` au demarrage Dokploy

Le conteneur ecoute sur `PORT=8080` par defaut. Sur Dokploy, monter un volume
persistant sur `/data/revision-documents`. Si l'API et le worker sont deployes
comme deux applications separees, les deux doivent lire/ecrire le meme volume.
