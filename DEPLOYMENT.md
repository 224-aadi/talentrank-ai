# TalentRank Deployment Guide

## Required Services

- Node.js 22 runtime
- Postgres 16+
- Optional OpenAI API key for managed embeddings
- Session auth secrets or a trusted SSO proxy

## Required Environment

```bash
DATABASE_URL=postgresql://user:password@host:5432/talentrank
TALENTRANK_USE_PRISMA=true
NODE_ENV=production
TALENTRANK_AUTH_SECRET=generate_a_long_random_secret
TALENTRANK_BOOTSTRAP_EMAIL=admin@yourcompany.com
TALENTRANK_BOOTSTRAP_PASSWORD=temporary_first_admin_password
TALENTRANK_STORAGE_KEY=generate_a_long_random_file_encryption_secret
```

## Optional Environment

```bash
OPENAI_API_KEY=your_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
OCR_API_URL=https://your-ocr-provider/extract
OCR_API_KEY=your_ocr_key
TALENTRANK_AUTH_MODE=headers
TALENTRANK_STORAGE_PROVIDER=s3
```

## Auth

Session auth is the default. Use `TALENTRANK_AUTH_MODE=headers` only behind a trusted SSO/auth gateway that strips inbound spoofed identity headers and injects verified TalentRank headers:

```text
x-talentrank-user-id
x-talentrank-org-id
x-talentrank-email
x-talentrank-name
x-talentrank-role
```

Allowed roles are `admin`, `recruiter`, and `reviewer`.

Remove or rotate `TALENTRANK_BOOTSTRAP_PASSWORD` after the first real admin accounts are created through `POST /api/auth/users`.

## Secure Storage

Local secure storage writes original resumes under `.data/secure-files`. With `TALENTRANK_STORAGE_KEY`, files are encrypted with AES-256-GCM. For multi-instance deployments, replace local disk with shared object storage before serving customers.

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

- Connect hosted SSO/OIDC for enterprise customers.
- Move resume file storage to S3/R2/GCS with signed URLs for multi-instance production.
- Add rate limiting and file virus scanning.
- Add structured logs and error monitoring.
- Add backup and retention policies.
