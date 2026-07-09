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
TALENTRANK_APP_URL=https://app.yourcompany.com
TALENTRANK_AUTH_SECRET=generate_a_long_random_secret
TALENTRANK_BOOTSTRAP_EMAIL=admin@yourcompany.com
TALENTRANK_BOOTSTRAP_PASSWORD=temporary_first_admin_password
TALENTRANK_STORAGE_KEY=generate_a_long_random_file_encryption_secret
TALENTRANK_MALWARE_SCAN_URL=https://your-scanner.example.com/scan
TALENTRANK_EMAIL_PROVIDER=resend
TALENTRANK_EMAIL_FROM="TalentRank AI <noreply@yourcompany.com>"
RESEND_API_KEY=your_resend_key
```

## Optional Environment

```bash
OPENAI_API_KEY=your_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
OCR_PROVIDER=generic
OCR_API_URL=https://your-ocr-provider/extract
OCR_API_KEY=your_ocr_key
# Or:
# OCR_PROVIDER=ocrspace
# OCR_SPACE_API_KEY=your_ocr_space_api_key
TALENTRANK_AUTH_MODE=headers
TALENTRANK_STORAGE_PROVIDER=external
TALENTRANK_STORAGE_UPLOAD_URL=https://your-storage-gateway.example.com/upload
TALENTRANK_STORAGE_DOWNLOAD_URL=https://your-storage-gateway.example.com/signed-download
TALENTRANK_STORAGE_TOKEN=optional_bearer_token
# Or S3/R2/GCS-compatible:
# TALENTRANK_STORAGE_PROVIDER=s3
# S3_ENDPOINT=https://s3.amazonaws.com
# S3_BUCKET=talentrank-resumes
# S3_ACCESS_KEY_ID=...
# S3_SECRET_ACCESS_KEY=...
TALENTRANK_MAX_BATCH_FILES=50
TALENTRANK_BACKUP_URL=https://your-backup-gateway.example.com/upload
TALENTRANK_RETENTION_DAYS=365
TALENTRANK_MALWARE_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=your_virustotal_key
TALENTRANK_LOG_DRAIN_URL=https://logs.example.com/ingest
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
TALENTRANK_EMAIL_TEST_TO=ops@yourcompany.com
# Email alternatives:
# TALENTRANK_EMAIL_PROVIDER=postmark
# POSTMARK_SERVER_TOKEN=...
# TALENTRANK_EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=...
# TALENTRANK_EMAIL_PROVIDER=webhook
# TALENTRANK_EMAIL_WEBHOOK_URL=https://your-email-gateway.example.com/send
# TALENTRANK_EMAIL_WEBHOOK_TOKEN=optional_bearer_token
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

Generic OIDC login is available at `/api/auth/oidc/start`. Configure `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and optional `OIDC_DEFAULT_ORG_ID` / `OIDC_DEFAULT_ROLE`.

## Transactional Email

Production requires transactional email for teammate invites and password resets. Supported providers:

- Resend: `TALENTRANK_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`
- Postmark: `TALENTRANK_EMAIL_PROVIDER=postmark`, `POSTMARK_SERVER_TOKEN`
- SendGrid: `TALENTRANK_EMAIL_PROVIDER=sendgrid`, `SENDGRID_API_KEY`
- Custom gateway: `TALENTRANK_EMAIL_PROVIDER=webhook`, `TALENTRANK_EMAIL_WEBHOOK_URL`

Always set:

```bash
TALENTRANK_APP_URL=https://your-public-app-url
TALENTRANK_EMAIL_FROM="TalentRank AI <noreply@yourdomain.com>"
TALENTRANK_EMAIL_TEST_TO=ops@yourdomain.com
```

In staging, open `/admin`, run the Email Delivery diagnostic, then create a test invite and password reset. Production API responses do not expose invite/reset tokens; delivery must work before onboarding users.

## Secure Storage

Local secure storage writes original resumes under `.data/secure-files`. With `TALENTRANK_STORAGE_KEY`, files are encrypted with AES-256-GCM. For multi-instance deployments, replace local disk with shared object storage before serving customers.

External storage uses HTTP upload and signed-download gateways. The upload gateway should accept multipart form data with `key` and `file`, persist to S3/R2/GCS or equivalent, and return `{ "storageKey": "...", "encrypted": true }`. The download gateway should accept `{ "storageKey": "...", "fileName": "..." }` and return `{ "url": "https://signed-download-url" }`.

For direct S3-compatible uploads, set `TALENTRANK_STORAGE_PROVIDER=s3`. This supports AWS S3 and S3-compatible endpoints such as Cloudflare R2 or GCS interoperability mode.

## Admin Operations

Admins can open:

```text
/admin
```

This page reports integration readiness, links to backup export/health/metrics endpoints, and exposes live provider diagnostics. The diagnostics can test database connectivity, object-storage writes, malware scanner credentials, OCR provider reachability, OpenAI embeddings, OIDC discovery, email delivery, and log-drain ingestion from the same runtime that will serve customers.

The diagnostics API is admin-only:

```text
POST /api/admin/integrations/test
POST /api/admin/integrations/test {"key":"storage"}
```

Use the diagnostics in staging after secrets are configured and before routing real HR users to the workspace.

Operational scripts:

```bash
npm run ops:backup
npm run ops:retention
```

## Upload Safety

Production deploy checks require either `TALENTRANK_MALWARE_SCAN_URL` or `TALENTRANK_MALWARE_PROVIDER=virustotal` with `VIRUSTOTAL_API_KEY`. The app also enforces file extension/MIME allowlists, PDF/DOCX magic-byte checks, batch-size limits, and route-level rate limits for login, screening, and resume downloads.

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
OCR_PROVIDER=generic
TALENTRANK_STORAGE_PROVIDER=external
TALENTRANK_STORAGE_UPLOAD_URL=http://127.0.0.1:3060/upload
TALENTRANK_STORAGE_DOWNLOAD_URL=http://127.0.0.1:3060/signed-download
```

The mock service is for deployment rehearsal only; it does not perform real OCR, malware detection, or encryption.

## Remaining Production Hardening

- Validate hosted SSO/OIDC, S3/R2/GCS, OCR, malware scanning, embeddings, email delivery, and log drain in staging with real provider credentials.
- Validate invite acceptance and password reset from the deployed staging domain.
- Connect alerting rules for provider failures and auth/security events.
- Add backup and retention policies.
