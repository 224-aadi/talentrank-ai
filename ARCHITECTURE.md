# TalentRank Architecture

## Current Deliverable

This folder contains a launch-path MVP:

- `app/`: Next.js application shell and API routes.
- `lib/`: typed domain model and persistence boundary.
- `prisma/schema.prisma`: production database model.
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
GET  /api/jobs
POST /api/jobs
GET  /api/audit
POST /api/audit
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
2. Index raw text with BM25.
3. Index structured fields such as skills, titles, companies, degrees, and locations.
4. Generate embeddings for resume sections and JD requirements.
5. Retrieve broadly with Boolean/BM25.
6. Expand with skill taxonomy and aliases.
7. Rerank using semantic similarity, hard-rule outcomes, evidence coverage, recency, and role-family weights.
8. Return score, confidence, evidence, gaps, and risks.

## Security Target

- SSO/SAML/OIDC for enterprise customers.
- Role-based access control.
- Per-tenant encryption keys.
- Virus scanning for uploads.
- Signed URLs for file access.
- Immutable audit trail.
- Configurable retention policy.
- PII minimization and deletion workflow.
