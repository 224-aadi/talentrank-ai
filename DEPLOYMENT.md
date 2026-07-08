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
TALENTRANK_MALWARE_SCAN_URL=https://your-scanner.example.com/scan
```

## Optional Environment

```bash
OPENAI_API_KEY=your_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
OCR_API_URL=https://your-ocr-provider/extract
OCR_API_KEY=your_ocr_key
TALENTRANK_AUTH_MODE=headers
TALENTRANK_STORAGE_PROVIDER=external
TALENTRANK_STORAGE_UPLOAD_URL=https://your-storage-gateway.example.com/upload
TALENTRANK_STORAGE_TOKEN=optional_bearer_token
TALENTRANK_MAX_BATCH_FILES=50
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

External storage uses an HTTP upload gateway. The gateway should accept multipart form data with `key` and `file`, persist to S3/R2/GCS or equivalent, and return `{ "storageKey": "...", "encrypted": true }`.

## Upload Safety

Production deploy checks require `TALENTRANK_MALWARE_SCAN_URL`. The app also enforces file extension/MIME allowlists, PDF/DOCX magic-byte checks, batch-size limits, and route-level rate limits for login, screening, and resume downloads.

## Observability

The app emits structured JSON logs for auth, screening, upload rejection, rate-limit blocks, storage writes, and resume downloads. Admins can inspect in-process counters at:

```text
GET /api/ops/metrics
```

## Release Commands

```bash
npm ci
npm run deploy:release
npm run build
npm run start
```

`npm run deploy:release` runs deployment readiness checks, Prisma client generation, and `prisma migrate deploy`.

## Docker

```bash
docker compose up --build
```

The compose stack includes Postgres plus a local mock integration service for malware scan and OCR endpoints. The `web` service sets `TALENTRANK_RUN_MIGRATIONS=true`, so the container runs release checks and migrations before starting.

For hosted production containers, prefer running release as a one-off job:

```bash
npm run deploy:release
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
- Add a migration release step: `npm run deploy:release`
- Set all required production secrets from `.env.production.example`

### Render/Fly/Railway

- Use the Dockerfile or Node runtime
- Set `DATABASE_URL`
- Set `TALENTRANK_USE_PRISMA=true`
- Run `npm run deploy:release` before `npm run start`, or set `TALENTRANK_RUN_MIGRATIONS=true` for a single-instance deployment

## Local Provider Rehearsal

Start mock OCR, storage, and malware-scan providers:

```bash
npm run mock:integrations
```

Then point the app at:

```bash
TALENTRANK_MALWARE_SCAN_URL=http://127.0.0.1:3060/scan
OCR_API_URL=http://127.0.0.1:3060/ocr
TALENTRANK_STORAGE_PROVIDER=external
TALENTRANK_STORAGE_UPLOAD_URL=http://127.0.0.1:3060/upload
```

The mock service is for deployment rehearsal only; it does not perform real OCR, malware detection, or encryption.

## Remaining Production Hardening

- Connect hosted SSO/OIDC for enterprise customers.
- Replace the mock external storage gateway with S3/R2/GCS and signed URLs for multi-instance production.
- Connect managed log/error monitoring and alerts.
- Add backup and retention policies.
