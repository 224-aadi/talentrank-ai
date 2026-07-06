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
- Persist audit and evaluation events when served through the Node backend.

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/
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

## Current Limitations

This is still an MVP:

- File parsing is browser-side.
- No authentication yet.
- No real database yet.
- No vector embeddings yet.
- No production skill taxonomy yet.
- No independent bias audit yet.
- No enterprise security controls yet.

See:

- `ARCHITECTURE.md`
- `COMPLIANCE.md`
- `LAUNCH_ROADMAP.md`
