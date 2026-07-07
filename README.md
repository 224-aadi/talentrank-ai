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
- Prisma/Postgres schema and database setup guide
- Header-based auth context with organization and role enforcement for write APIs
- Compliance Trust Center with protected-class guardrails, audit export, retention report, candidate deletion controls, and explainability report endpoints
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

Local development uses a demo recruiter from request headers. In production, place TalentRank behind real auth middleware and forward:

- `x-talentrank-user-id`
- `x-talentrank-org-id`
- `x-talentrank-email`
- `x-talentrank-name`
- `x-talentrank-role`

Set `TALENTRANK_USE_PRISMA=true` with `DATABASE_URL` to route the repository layer through Prisma instead of JSON.

## OCR And Compliance

Scanned PDFs are detected when embedded PDF text is sparse. Configure a production OCR service:

```bash
OCR_API_URL=https://your-ocr-service.example.com/extract
OCR_API_KEY=optional_bearer_token
```

The OCR endpoint should accept multipart form data with a `file` field and return JSON like:

```json
{ "text": "extracted resume text", "provider": "textract", "confidence": 0.94 }
```

Compliance endpoints:

- `GET /compliance` opens the Trust Center.
- `POST /api/compliance/guardrails` scans job/resume text for protected-class guardrail terms.
- `POST /api/compliance/adverse-impact` computes four-fifths-rule monitoring from lawfully collected audit groups.
- `GET /api/compliance/retention?days=365` lists records past retention threshold.
- `GET /api/compliance/audit-export` exports audit events.
- `GET /api/compliance/explainability?matchRunId=...` exports score, evidence, gaps, hard rules, decision, and guardrail context.
- `DELETE /api/candidates/:candidateId` deletes a candidate and related artifacts; admin role required.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker, CI, Postgres migration, health check, and platform setup.

## Current Limitations

This is still an MVP:

- OCR requires an external provider configured with `OCR_API_URL`.
- Real login/SSO provider is not connected yet.
- Prisma adapter is opt-in and requires a live Postgres database.
- Managed vector database storage is not deployed yet.
- No production skill taxonomy yet.
- No independent third-party bias audit yet.
- No enterprise security controls yet.

See:

- `ARCHITECTURE.md`
- `COMPLIANCE.md`
- `DATABASE.md`
- `DEPLOYMENT.md`
- `LAUNCH_ROADMAP.md`
