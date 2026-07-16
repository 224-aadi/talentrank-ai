# TalentRank AI

<p align="center">
  <strong>Explainable AI resume screening for teams that need evidence, not guesswork.</strong>
</p>

<p align="center">
  Upload a job description, screen resume batches, apply hard requirements, rank candidates, and review every decision with defensible evidence.
</p>

<p align="center">
  <a href="#product">Product</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#quickstart">Quickstart</a>
  ·
  <a href="#deployment">Deployment</a>
  ·
  <a href="#security-and-trust">Security</a>
  ·
  <a href="#roadmap">Roadmap</a>
</p>

---

## Product

TalentRank AI is a launch-focused recruiting intelligence platform. It helps HR teams and recruiters move from resume piles to a ranked, explainable shortlist without depending on brittle keyword matching alone.

The product is built around a simple workflow:

1. Upload or paste a job description.
2. Upload a batch of resumes.
3. Add non-negotiable hard-rule requirements.
4. Rank candidates with hybrid matching.
5. Review evidence, gaps, confidence, and hard-rule outcomes.
6. Export candidate results and resume links.
7. Use recruiter decisions and benchmark labels to calibrate quality over time.

TalentRank is designed to compete as an explainable candidate intelligence layer, not a generic ATS clone.

## Why It Exists

Traditional resume filters often fail in two opposite ways:

- They reject strong candidates because a resume did not use the exact keyword.
- They surface weak candidates because a resume stuffed the right words.

TalentRank is built around evidence-grounded matching:

- Hard rules act as true knockout gates.
- Skill aliases and adjacent skills catch realistic phrasing differences.
- Semantic retrieval finds transferable evidence.
- Every score includes readable reasoning, matched signals, missing signals, and resume snippets.
- Calibration metrics make quality measurable instead of vibes-based.

## Core Capabilities

### Screening Workbench

- Batch resume upload.
- Job description upload or paste.
- Hard-rule keywords.
- Explainable candidate ranking.
- Recommended, review, and rejected buckets.
- Resume download links.
- Recruiter notes and decisions.
- Candidate comparison.
- CSV export.

### Matching Engine

- Hard-rule knockout logic.
- Lexical JD/resume overlap.
- BM25-style retrieval.
- Boolean recruiter search.
- Skill aliases and competency groups.
- Role-family scoring weights.
- Transferable evidence detection.
- Local semantic fallback.
- Optional OpenAI-managed embeddings.
- Confidence scoring and risk flags.

### Parsing And OCR

- PDF, DOCX, TXT, MD, and CSV resume ingestion.
- OCR fallback for scanned PDFs.
- OCR.space and generic OCR provider support.
- Structured resume profile extraction:
  - contact details
  - sections
  - skills
  - education
  - experience
  - projects
  - certifications
  - quantified evidence
  - seniority signals
  - bullets
  - dates
  - tables
  - work timelines
  - layout warnings

### Workspace History

- Uploaded job descriptions.
- Candidate archive.
- Resume downloads.
- Match run history.
- Recruiter decisions.
- Audit events.
- CSV and backup exports.

### Calibration

- Benchmark labels.
- Benchmark case import/export.
- Precision@5 and precision@10.
- Recall@50.
- nDCG@10.
- False knockout rate.
- Override rate.
- Score-to-interview correlation.
- Segment metrics.
- Benchmark run comparison.

### Trust Center

- Protected-class guardrail scanning.
- Explainability exports.
- Audit exports.
- Retention reports.
- Candidate deletion controls.
- Adverse-impact monitoring endpoint for lawfully collected audit groups.

## Architecture

TalentRank is a Next.js application with a production split:

- Vercel serves the frontend experience.
- Render serves backend API routes.
- Supabase Postgres stores application data through Prisma.
- S3-compatible storage stores original resumes.
- Optional providers handle OCR, malware scanning, embeddings, email, and observability.

```mermaid
flowchart LR
  HR["Recruiter / HR user"] --> Vercel["Vercel frontend"]
  Vercel --> API["Render backend API"]
  API --> DB["Supabase Postgres"]
  API --> Storage["S3 / R2 / GCS-compatible storage"]
  API --> OCR["OCR provider"]
  API --> Malware["Malware scanner"]
  API --> Embeddings["Local or OpenAI embeddings"]
  API --> Email["Transactional email"]
  API --> Logs["Log drain / observability"]
```

## Application Routes

Primary product routes:

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/login` | Sign in, reset password, invite acceptance |
| `/signup` | Create a workspace |
| `/dashboard` | Candidate screening workbench |
| `/workspace` | Admin workspace, history, JDs, candidates, exports |
| `/quality` | Calibration and benchmark dashboard |
| `/trust` | Compliance and explainability center |

Legacy route aliases remain available for compatibility:

| Legacy | Current |
| --- | --- |
| `/screen` | `/dashboard` |
| `/admin` | `/workspace` |
| `/calibration` | `/quality` |
| `/compliance` | `/trust` |

## Tech Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 15, React 19 |
| Styling | Tailwind CSS 4 plus custom product CSS |
| Data | Prisma, Supabase Postgres |
| Resume parsing | PDF/DOCX/TXT/MD/CSV parsing, OCR fallback |
| Storage | Local encrypted storage or S3-compatible object storage |
| Auth | Signed HttpOnly session cookies, PBKDF2 password hashing, optional OIDC |
| Ranking | Hybrid lexical, Boolean, skill graph, semantic, evidence scoring |
| Deployment | Vercel frontend, Render backend, Docker support |

## Quickstart

### 1. Install

```bash
npm install
```

### 2. Configure local environment

Create `.env.local` and set the minimum local values:

```bash
TALENTRANK_AUTH_SECRET=replace_with_a_long_random_secret
TALENTRANK_USE_PRISMA=false
```

For Prisma/Postgres local or staging mode:

```bash
TALENTRANK_USE_PRISMA=true
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

### 3. Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Local development bootstraps a demo admin if no production bootstrap is configured:

```text
email: admin@talentrank.local
password: talentrank-admin
```

Never use the demo bootstrap credentials in production.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Build production assets |
| `npm run start` | Start Next.js production server |
| `npm run deploy:check` | Validate production deployment configuration |
| `npm run deploy:release` | Run release workflow helpers |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run local Prisma migrations |
| `npm run prisma:deploy` | Apply production Prisma migrations |
| `npm run ops:backup` | Run backup helper |
| `npm run ops:retention` | Run retention report helper |

## Environment Variables

### Core

```bash
NODE_ENV=production
TALENTRANK_AUTH_SECRET=long_random_session_secret
TALENTRANK_APP_URL=https://your-production-frontend.example.com
NEXT_PUBLIC_APP_URL=https://your-production-frontend.example.com
```

### Database

```bash
TALENTRANK_USE_PRISMA=true
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

### Frontend / Backend Split

On Vercel:

```bash
TALENTRANK_FRONTEND_ONLY=true
NEXT_PUBLIC_BACKEND_URL=https://your-render-backend.onrender.com
TALENTRANK_BACKEND_URL=https://your-render-backend.onrender.com
NEXT_PUBLIC_APP_URL=https://your-vercel-frontend.vercel.app
TALENTRANK_APP_URL=https://your-vercel-frontend.vercel.app
TALENTRANK_AUTH_SECRET=same_exact_secret_as_render
```

On Render:

```bash
TALENTRANK_APP_URL=https://your-vercel-frontend.vercel.app
TALENTRANK_AUTH_SECRET=same_exact_secret_as_vercel
```

Do not set `TALENTRANK_FRONTEND_ONLY=true` on Render.

### Storage

S3-compatible storage:

```bash
TALENTRANK_STORAGE_PROVIDER=s3
S3_ENDPOINT=https://your-s3-compatible-endpoint
S3_BUCKET=your_bucket
S3_REGION=your_region
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

Local encrypted storage:

```bash
TALENTRANK_STORAGE_PROVIDER=local
TALENTRANK_STORAGE_KEY=long_random_file_encryption_secret
```

### OCR

Generic OCR gateway:

```bash
OCR_PROVIDER=generic
OCR_API_URL=https://your-ocr-service.example.com/extract
OCR_API_KEY=optional_bearer_token
```

OCR.space:

```bash
OCR_PROVIDER=ocrspace
OCR_SPACE_API_KEY=your_ocr_space_api_key
OCR_SPACE_LANGUAGE=eng
OCR_SPACE_ENGINE=2
```

### Malware Scanning

Webhook scanner:

```bash
TALENTRANK_MALWARE_SCAN_URL=https://your-scanner.example.com/scan
TALENTRANK_MALWARE_SCAN_KEY=optional_bearer_token
```

VirusTotal:

```bash
TALENTRANK_MALWARE_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=your_virustotal_key
```

### Embeddings

Local fallback works without an external provider.

Managed OpenAI embeddings:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
```

### Email

```bash
TALENTRANK_EMAIL_PROVIDER=resend
TALENTRANK_EMAIL_FROM="TalentRank AI <noreply@yourdomain.com>"
RESEND_API_KEY=your_resend_api_key
```

Postmark, SendGrid, and webhook delivery modes are also supported.

### Enterprise SSO

```bash
OIDC_ISSUER_URL=https://issuer.example.com
OIDC_CLIENT_ID=client_id
OIDC_CLIENT_SECRET=client_secret
```

Users can start OIDC login through:

```text
/api/auth/oidc/start
```

Trusted-header mode is available for proxy-based enterprise deployments:

```bash
TALENTRANK_AUTH_MODE=headers
```

Required forwarded headers:

- `x-talentrank-user-id`
- `x-talentrank-org-id`
- `x-talentrank-email`
- `x-talentrank-name`
- `x-talentrank-role`

## Deployment

### Recommended Production Topology

1. Deploy the frontend to Vercel.
2. Deploy the backend to Render from the same repository.
3. Set `TALENTRANK_FRONTEND_ONLY=true` only on Vercel.
4. Keep provider secrets, database credentials, and storage credentials on Render.
5. Copy the exact same `TALENTRANK_AUTH_SECRET` to both Vercel and Render.
6. Set Render `TALENTRANK_APP_URL` to the Vercel production URL.
7. Let Render handle `/api/*`.
8. Let Vercel own all human-facing page routes.

### Render

The repository includes:

- `Dockerfile`
- `render.yaml`
- health check route at `/api/health`
- Prisma deploy script support

### Vercel

Use:

- Framework preset: `Next.js`
- Root directory: `./`
- Branch: `main`

The app uses rewrites in `next.config.mjs` so Vercel forwards API calls to Render in frontend-only mode.

## API Surface

### Screening

| Endpoint | Purpose |
| --- | --- |
| `POST /api/screen` | Upload JD and resumes, then rank candidates |
| `GET /api/jobs` | List workspace jobs |
| `POST /api/jobs` | Create a job |
| `GET /api/matches` | List match runs |
| `GET /api/candidates/search` | Search saved candidates |
| `POST /api/decisions` | Save recruiter decision |

### Admin

| Endpoint | Purpose |
| --- | --- |
| `GET /api/admin/workspace-history` | Load JDs, candidates, matches, decisions, and audits |
| `GET /api/admin/candidates/export` | Export candidate CSV with resume links |
| `GET /api/admin/backup` | Export backup JSON |
| `GET /api/admin/integrations` | Provider readiness |
| `POST /api/admin/integrations/test` | Run provider diagnostics |
| `GET /api/admin/users/export` | Export users CSV |

### Auth

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/signup` | Create workspace account |
| `POST /api/auth/login` | Session login |
| `POST /api/auth/logout` | Sign out |
| `POST /api/auth/invites` | Create invite |
| `POST /api/auth/invites/accept` | Accept invite |
| `POST /api/auth/password-reset` | Request reset link |
| `POST /api/auth/password-reset/confirm` | Set new password |
| `GET /api/auth/session` | Current session |

### Trust And Quality

| Endpoint | Purpose |
| --- | --- |
| `POST /api/compliance/guardrails` | Protected-class guardrail scan |
| `POST /api/compliance/adverse-impact` | Four-fifths-rule monitoring |
| `GET /api/compliance/retention` | Retention report |
| `GET /api/compliance/audit-export` | Audit export |
| `GET /api/compliance/explainability` | Explainability report |
| `GET /api/benchmarks/cases` | Benchmark cases |
| `POST /api/benchmarks/cases` | Import benchmark cases |
| `GET /api/benchmarks/runs` | Benchmark runs |
| `POST /api/benchmarks/runs` | Create benchmark snapshot |
| `GET /api/benchmarks/compare` | Compare benchmark runs |
| `GET /api/benchmarks/export` | Export benchmark data |

## Security And Trust

TalentRank handles candidate PII, so security and tenancy are product requirements, not nice-to-haves.

Current safeguards:

- Organization-scoped data access.
- Role-based access checks.
- Signed HttpOnly session cookies.
- PBKDF2 password hashing.
- SameSite cookie controls.
- Production default-admin blocking.
- Resume upload type checks.
- PDF and DOCX magic-byte validation.
- Batch upload limits.
- Optional malware scanning.
- Optional encrypted local file storage.
- S3-compatible storage support.
- Audit events for important workflow actions.
- Candidate deletion controls.
- Retention reporting.
- Explainability exports.
- Protected-class guardrail reports.

Production expectations:

- Use a long random `TALENTRANK_AUTH_SECRET`.
- Keep the same auth secret on Vercel and Render.
- Use Postgres through Prisma.
- Use object storage for resumes.
- Configure transactional email.
- Configure OCR and malware providers before handling scanned or untrusted resumes at scale.
- Run provider diagnostics before onboarding customers.
- Monitor logs and health checks.

## Quality Metrics

TalentRank is designed to make matching quality measurable:

- precision@5
- precision@10
- recall@50
- nDCG@10
- false knockout rate
- override rate
- score-to-interview correlation
- explanation coverage
- parse confidence
- shortlist-to-interview rate
- interview-to-offer rate

The benchmark and calibration system is how the product proves it is better than a generic keyword ATS.

## Repository Structure

```text
app/
  api/                  Next.js API routes
  dashboard/            Screening workbench route
  workspace/            Admin workspace route
  quality/              Calibration route
  trust/                Compliance route
components/             Shared UI components
lib/                    Matching, parsing, auth, storage, integrations
prisma/                 Database schema and migrations
scripts/                Deploy, backup, retention, mock providers
public/                 Static assets and legacy scanner
```

## Development Notes

- Stop the dev server before running `npm run build` if you are debugging `.next` runtime corruption.
- Use `/dashboard` and `/workspace` for the production UI.
- Keep `/screen` and `/admin` only as backward-compatible aliases.
- Vercel should not own persistent data.
- Render should not be the customer-facing application URL.

## Roadmap

Near-term launch work:

- Larger labeled benchmark datasets.
- More robust role-family calibration.
- Expanded skill taxonomy import.
- Stronger mobile recruiter workflows.
- Managed observability and alerting.
- Automated backup verification.
- More provider diagnostics.
- ATS export/integration adapters.
- Customer-facing onboarding and billing.

Longer-term product bets:

- Job-family-specific ranking models.
- Recruiter feedback loops.
- Bias and adverse-impact dashboards with customer-provided lawful groups.
- Multi-stage funnel analytics.
- Interview and offer outcome calibration.
- Enterprise SSO and SCIM provisioning.
- SOC 2-oriented audit evidence workflows.

## Status

TalentRank AI is an active launch-grade product build. The core screening, ranking, evidence, admin, compliance, calibration, and deployment foundations are in place. Remaining work is focused on production polish, provider maturity, benchmark proof, enterprise readiness, and customer onboarding.

---

<p align="center">
  Built for recruiters who need speed, trust, and evidence in the same workflow.
</p>
