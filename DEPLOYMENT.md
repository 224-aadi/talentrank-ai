# TalentRank Deployment Guide

## Required Services

- Node.js 22 runtime
- Postgres 16+
- Optional OpenAI API key for managed embeddings
- Auth proxy or middleware that forwards TalentRank identity headers

## Required Environment

```bash
DATABASE_URL=postgresql://user:password@host:5432/talentrank
TALENTRANK_USE_PRISMA=true
NODE_ENV=production
```

## Optional Environment

```bash
OPENAI_API_KEY=your_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
```

## Auth Headers

Until a full login provider is connected, put the app behind an auth proxy that forwards:

```text
x-talentrank-user-id
x-talentrank-org-id
x-talentrank-email
x-talentrank-name
x-talentrank-role
```

Allowed roles are `admin`, `recruiter`, and `reviewer`.

## Release Commands

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

## Docker

```bash
docker compose up --build
```

For production containers, run migrations as a release step before starting the web process:

```bash
npx prisma migrate deploy
```

## Health Check

Use:

```text
GET /api/health
```

The endpoint returns `200` when deployment-critical runtime settings are ready and `503` when it detects unsafe production configuration such as JSON persistence in production.

## Deployment Targets

### Vercel

- Build command: `npm run build`
- Install command: `npm ci`
- Add Postgres integration or set `DATABASE_URL`
- Add a migration release step through your deployment workflow

### Render/Fly/Railway

- Use the Dockerfile or Node runtime
- Set `DATABASE_URL`
- Set `TALENTRANK_USE_PRISMA=true`
- Run `npx prisma migrate deploy` before `npm run start`

## Remaining Production Hardening

- Replace header auth with hosted login or SSO.
- Move resume file storage to S3/R2/GCS with signed URLs.
- Add rate limiting and file virus scanning.
- Add structured logs and error monitoring.
- Add backup and retention policies.
