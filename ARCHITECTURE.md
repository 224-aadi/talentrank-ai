# TalentRank Architecture

## Current Deliverable

This folder contains a launch-path MVP:

- `app/`: Next.js application shell and API routes.
- `lib/`: typed domain model and persistence boundary.
- `lib/parsing.ts`: server-side resume parsing and structured profile extraction for PDF, DOCX, and text formats.
- `lib/matching.ts`: server-side matching, hard-rule outcomes, and evidence scoring.
- `lib/retrieval.ts`: candidate pool retrieval with Boolean query parsing and BM25-style ranking.
- `lib/semantic.ts`: section-level embedding provider, local vector fallback, OpenAI-managed embeddings, JSON vector index, and cosine similarity retrieval.
- `lib/skill-taxonomy.ts`: aliases, adjacent skills, seniority signals, transferable evidence, and role-family weights.
- `lib/auth.ts`: header-based auth context, organization context, and role checks.
- `lib/prisma-store.ts`: Prisma-backed repository adapter enabled by `TALENTRANK_USE_PRISMA=true`.
- `prisma/schema.prisma`: production database model.
- `DATABASE.md`: Postgres setup and Prisma validation guide.
- `index.html`, `styles.css`, `app.js`: recruiter-facing screening UI.
- `server.js`: dependency-free Node.js server for static hosting and JSON APIs.
- `data/talentrank.json`: local JSON persistence created at runtime.
- `LAUNCH_ROADMAP.md`: product and technical roadmap.
- `COMPLIANCE.md`: responsible-AI and hiring compliance checklist.

## Local Run

```bash
cd outputs/ats-tracker
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000/
```

The original scanner remains available at `/scanner/index.html`.

## API Surface

```text
GET  /api/health
GET  /api/auth/session
GET  /api/jobs
POST /api/jobs
GET  /api/audit
POST /api/audit
GET  /api/candidates/search
GET  /api/benchmarks
POST /api/benchmarks
GET  /api/decisions
POST /api/decisions
POST /api/evaluations
POST /api/screen
GET  /api/matches
```

The API is intentionally small. It gives the product the shape needed for persistence, auditability, and evaluation tracking without introducing database or framework dependencies yet.

## Production Architecture Target

```text
Browser UI
  -> API Gateway
  -> Auth / Org / RBAC
  -> Job Service
  -> Candidate Service
  -> Parsing Pipeline
  -> Search Service
       - BM25 / Boolean retrieval
       - Vector retrieval
       - Skill graph expansion
  -> Reranking Service
       - scorecard model
       - explainability
       - calibration
  -> Audit / Compliance Ledger
  -> Analytics Warehouse
```

## Data Model Target

- Organization
- User
- Job
- JobRequirement
- Candidate
- ResumeDocument
- ParsedResume
- MatchRun
- MatchScore
- EvidenceSnippet
- KnockoutResult
- RecruiterDecision
- AuditEvent
- EvaluationSnapshot

## Search Stack Target

1. Parse and normalize resumes.
2. Extract raw text server-side from PDF, DOCX, TXT, MD, and CSV inputs.
3. Index raw text with BM25.
4. Index structured fields such as skills, titles, companies, degrees, and locations.
5. Retrieve broadly with Boolean/BM25 over the saved candidate pool.
6. Generate embeddings for resume sections and JD requirements. Local vectors and OpenAI-managed embeddings are implemented; hosted vector database deployment remains a production upgrade.
7. Expand with skill taxonomy, aliases, adjacent skills, seniority signals, and transferable evidence.
8. Rerank using semantic similarity, hard-rule outcomes, evidence coverage, recency, and role-family weights.
9. Return score, confidence, hard-rule outcomes, evidence, gaps, and risks.

## Security Target

- Current milestone: header-based auth context and role checks on write APIs.
- SSO/SAML/OIDC for enterprise customers.
- Role-based access control.
- Per-tenant encryption keys.
- Virus scanning for uploads.
- Signed URLs for file access.
- Immutable audit trail.
- Configurable retention policy.
- PII minimization and deletion workflow.

## Quality Measurement

- Benchmark labels: good match, bad match, interviewed, offer, hired.
- Metrics: precision@10, nDCG@10, false knockout rate, recruiter override rate, and score-to-interview correlation.
- Dashboard: `/calibration`.
