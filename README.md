# TalentRank AI

TalentRank AI is an explainable ATS screening and candidate-ranking platform built toward a launch-grade recruiting intelligence product.

## What It Does

- Upload a job description.
- Upload a batch of resumes.
- Configure hard-rule keywords.
- Rank candidates with hybrid matching.
- Search candidates with Boolean-style recruiter queries.
- Tune score weights by role.
- Use role-family templates.
- Run blind review.
- Record recruiter decisions.
- Export ranked results.
- Persist audit, evaluation, and decision events through the Next backend.

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
- Structured resume profiles and recruiter-facing evidence explanations
- Saved candidate pool retrieval with Boolean search and BM25-style ranking
- Semantic retrieval over resume sections with local or OpenAI-managed embeddings
- Recruiter decisions with notes, candidate status updates, and audit events
- Launch architecture docs
- Compliance checklist
- Original browser MVP

## Matching Approach

TalentRank uses a hybrid score:

- Hard-rule knockout gates.
- Lexical JD/resume overlap.
- Skill aliases and role-family templates.
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

## Current Limitations

This is still an MVP:

- OCR fallback for scanned PDFs is not implemented yet.
- No authentication yet.
- No real database yet.
- Managed vector database storage is not deployed yet.
- No production skill taxonomy yet.
- No independent bias audit yet.
- No enterprise security controls yet.

See:

- `ARCHITECTURE.md`
- `COMPLIANCE.md`
- `LAUNCH_ROADMAP.md`
