# TalentRank AI

TalentRank AI is an explainable ATS screening and candidate-ranking platform built toward a launch-grade recruiting intelligence product.

## What It Does

- Upload a job description.
- Upload a batch of resumes.
- Configure hard-rule keywords.
- Rank candidates with hybrid matching.
- Search candidates with Boolean-style recruiter queries.
- Label benchmark outcomes for calibration.
- Tune score weights by role.
- Use role-family templates.
- Run blind review.
- Record recruiter decisions.
- Export ranked results.
- Persist audit, evaluation, and decision events through the Next backend.
- Monitor compliance guardrails, retention, explainability, and adverse-impact reports.

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/
```

Server-side screening workbench:

```text
http://127.0.0.1:3000/screen
```

The original scanner MVP is available at:

```text
http://127.0.0.1:3000/scanner/index.html
```

## Legacy Static Server

The dependency-free prototype server is still available:

```bash
npm run start:legacy
```

Then open:

```text
http://127.0.0.1:4173/
```

The app also opens directly as `index.html`, but persistence only works through an HTTP server.

## Full-Stack Foundation

This repo now includes:

- Next.js app shell
- Typed API routes
- JSON-backed repository layer
- Prisma/Postgres schema
- Server-side screening endpoint and persisted match workbench
- Server-side resume ingestion for PDF, DOCX, TXT, MD, and CSV files
- OCR fallback hook for scanned PDFs through `OCR_API_URL`
- Deeper resume parsing for bullets, date ranges, table-like layouts, work history timelines, and layout warnings
- Structured resume profiles and recruiter-facing evidence explanations
- Saved candidate pool retrieval with Boolean search and BM25-style ranking
- Semantic retrieval over resume sections with local or OpenAI-managed embeddings
- Recruiter decisions with notes, candidate status updates, and audit events
- Skill graph taxonomy with aliases, adjacent skills, seniority signals, and role-family weights
- Calibration dashboard with precision@10, nDCG@10, false knockout rate, override rate, and score-to-interview correlation
- Benchmark dataset import/export, benchmark run snapshots, recall@50, precision@5, segment calibration, and score-change comparison
- Prisma/Postgres schema and database setup guide
- Header-based auth context with organization and role enforcement for write APIs
- Compliance Trust Center with protected-class guardrails, audit export, retention report, candidate deletion controls, and explainability report endpoints
- Session auth with signed HttpOnly cookies, PBKDF2 password hashes, admin user creation API, and optional trusted-header SSO mode
- Secure resume file storage with encrypted local storage when `TALENTRANK_STORAGE_KEY` is configured
- Upload security checks, batch limits, optional malware scanning, rate limiting, structured logs, and admin ops metrics
- Docker, CI, deploy checks, and production health reporting
- Launch architecture docs
- Compliance checklist
- Original browser MVP

## Matching Approach

TalentRank uses a hybrid score:

- Hard-rule knockout gates.
- Lexical JD/resume overlap.
- Skill aliases and role-family templates.
- Skill graph adjacency and transferable evidence.
- Competency signal groups.
- Experience and education parsing.
- Evidence snippets and missing-signal analysis.
- Confidence and risk flags.

## Embeddings

Semantic retrieval works without external services using `talentrank-local-hash-v1`. To switch to managed embeddings, set:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
```

The app stores section vectors in the local JSON vector store today, and the Prisma `VectorRecord` model is ready for Postgres-backed storage.

## Auth And Persistence

TalentRank defaults to session auth. Local development bootstraps an admin account:

```text
email: admin@talentrank.local
password: talentrank-admin
```

Set production secrets before deployment:

```bash
TALENTRANK_AUTH_SECRET=long_random_session_secret
TALENTRANK_BOOTSTRAP_EMAIL=founder@company.com
TALENTRANK_BOOTSTRAP_PASSWORD=temporary_first_admin_password
TALENTRANK_STORAGE_KEY=long_random_file_encryption_secret
TALENTRANK_MALWARE_SCAN_URL=https://your-scanner.example.com/scan
```

Admin-only user management:

- `GET /api/auth/users`
- `POST /api/auth/users` with `email`, `name`, `role`, and `password`
- `POST /api/auth/invites` creates invite links for new users.
- `POST /api/auth/invites/accept` accepts an invite and sets a password.
- `POST /api/auth/password-reset` creates reset tokens.
- `POST /api/auth/password-reset/confirm` sets a new password from a reset token.
- `PATCH /api/auth/users/:userId` updates a user's role.

For enterprise SSO/proxy deployments, set `TALENTRANK_AUTH_MODE=headers` and forward:

- `x-talentrank-user-id`
- `x-talentrank-org-id`
- `x-talentrank-email`
- `x-talentrank-name`
- `x-talentrank-role`

For OIDC login, configure `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`, then send users to `/api/auth/oidc/start`.

Set `TALENTRANK_USE_PRISMA=true` with `DATABASE_URL` to route the repository layer through Prisma instead of JSON.

## OCR And Compliance

Scanned PDFs are detected when embedded PDF text is sparse. Configure a production OCR service:

```bash
OCR_PROVIDER=generic
OCR_API_URL=https://your-ocr-service.example.com/extract
OCR_API_KEY=optional_bearer_token
```

The OCR endpoint should accept multipart form data with a `file` field and return JSON like:

```json
{ "text": "extracted resume text", "provider": "textract", "confidence": 0.94 }
```

Direct OCR.space provider mode is also supported without adding an SDK:

```bash
OCR_PROVIDER=ocrspace
OCR_SPACE_API_KEY=your_ocr_space_api_key
OCR_SPACE_LANGUAGE=eng
OCR_SPACE_ENGINE=2
```

Compliance endpoints:

- `GET /compliance` opens the Trust Center.
- `POST /api/compliance/guardrails` scans job/resume text for protected-class guardrail terms.
- `POST /api/compliance/adverse-impact` computes four-fifths-rule monitoring from lawfully collected audit groups.
- `GET /api/compliance/retention?days=365` lists records past retention threshold.
- `GET /api/compliance/audit-export` exports audit events.
- `GET /api/compliance/explainability?matchRunId=...` exports score, evidence, gaps, hard rules, decision, and guardrail context.
- `DELETE /api/candidates/:candidateId` deletes a candidate and related artifacts; admin role required.
- `GET /api/resumes/:resumeId/download` downloads the original stored resume; recruiter role required.
- `GET /api/ops/metrics` returns runtime mode and in-process operational counters; admin role required.

Benchmark endpoints:

- `GET /api/benchmarks/cases` lists imported benchmark test-set cases.
- `POST /api/benchmarks/cases` imports cases with `jobId`, `candidateId`, `expectedLabel`, and optional segment fields.
- `GET /api/benchmarks/runs` lists benchmark snapshots.
- `POST /api/benchmarks/runs` creates a quality snapshot for the current model/version.
- `GET /api/benchmarks/compare?baselineId=...&challengerId=...` reports metric deltas.
- `GET /api/benchmarks/export` exports labels, cases, and run history.

## Upload Security And Storage

Resume uploads enforce allowed extensions/MIME hints, PDF/DOCX magic-byte checks, max batch size, and optional malware scanning. Configure:

```bash
TALENTRANK_MAX_BATCH_FILES=50
TALENTRANK_MALWARE_SCAN_URL=https://your-scanner.example.com/scan
TALENTRANK_MALWARE_SCAN_KEY=optional_bearer_token
# Or:
TALENTRANK_MALWARE_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=your_virustotal_key
```

For external object storage, set:

```bash
TALENTRANK_STORAGE_PROVIDER=external
TALENTRANK_STORAGE_UPLOAD_URL=https://your-storage-gateway.example.com/upload
TALENTRANK_STORAGE_DOWNLOAD_URL=https://your-storage-gateway.example.com/signed-download
TALENTRANK_STORAGE_TOKEN=optional_bearer_token
```

For S3/R2/GCS-compatible storage, use `TALENTRANK_STORAGE_PROVIDER=s3` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.

The upload gateway should accept multipart form data with `key` and `file`, then return JSON like:

```json
{ "storageKey": "external/resumes/2026-07-08/file.pdf", "encrypted": true }
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker, CI, Postgres migration, health check, and platform setup.

Production helpers:

- `.env.production.example` documents required secrets.
- `npm run deploy:release` runs readiness checks, Prisma generation, and migrations.
- `npm run mock:integrations` starts local mock OCR, storage, and malware-scan providers.
- `npm run ops:backup` writes a local JSON-mode backup snapshot.
- `npm run ops:retention` prints a retention queue report.
- Docker Compose starts Postgres, the web app, and mock integrations for deployment rehearsal.
- Admin Operations Center: `/admin`

## Current Limitations

This is still an MVP:

- OCR requires an external provider configured with `OCR_API_URL` or `OCR_PROVIDER=ocrspace`.
- Native session login, invite/reset flow, trusted-header mode, and generic OIDC login are implemented.
- Prisma adapter is opt-in and requires a live Postgres database.
- Managed vector database storage is not deployed yet.
- No production skill taxonomy yet.
- No independent third-party bias audit yet.
- External object-storage gateway, hosted SSO, and enterprise observability integrations still need provider-specific wiring.
- Benchmark quality still needs a larger real labeled dataset before public claims.

See:

- `ARCHITECTURE.md`
- `COMPLIANCE.md`
- `DATABASE.md`
- `DEPLOYMENT.md`
- `LAUNCH_ROADMAP.md`
