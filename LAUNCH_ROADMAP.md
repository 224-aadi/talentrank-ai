# TalentRank Launch Roadmap

## Product Thesis

TalentRank should compete as an explainable candidate intelligence layer, not as a generic resume keyword counter. The strongest product position is hybrid matching:

- Knockout rules for non-negotiable requirements.
- Structured resume and job parsing.
- Boolean and lexical retrieval for recruiter search.
- Skill graph expansion for synonyms and adjacent skills.
- Semantic reranking for transferable evidence.
- Evidence-grounded explanations that recruiters can defend.
- Feedback loops that learn from recruiter decisions.

## Current MVP Capabilities

- Next.js app shell with API route boundaries.
- Prisma schema for the launch-grade database model.
- JSON repository layer that can be replaced with Postgres.
- Server-side screening API that persists jobs, candidates, resumes, match runs, audits, and evaluation snapshots.
- Server-side resume ingestion for PDF, DOCX, TXT, MD, and CSV files.
- OCR fallback hook for scanned PDFs through `OCR_API_URL`.
- Structured resume JSON extraction for contact, sections, skills, education, experience, projects, certifications, quantified evidence, seniority signals, bullets, dates, tables, layout warnings, and work history timelines.
- Next match workbench for persisted ranked results.
- Batch resume upload with PDF, DOCX, TXT, and MD support.
- JD upload or paste.
- Hard-rule keywords with all/any gate behavior.
- Hybrid scoring across JD match, skills, experience, and education.
- Saved candidate pool retrieval with Boolean gates and BM25-style ranking.
- Semantic retrieval over resume sections and JD/query text with local fallback, OpenAI-managed embeddings, and a JSON vector index.
- Skill aliases and competency signal groups.
- Skill graph taxonomy with aliases, adjacent skills, seniority signals, transferable evidence, and role-family weighting.
- Calibration dashboard with benchmark labels, precision@10, nDCG@10, false knockout rate, override rate, and score-to-interview correlation.
- Prisma/Postgres schema, env template, and database setup guide.
- Prisma repository adapter behind `TALENTRANK_USE_PRISMA=true`.
- Header-based auth context with organization and role enforcement on write APIs.
- Dockerfile, Docker Compose, CI workflow, deployment guide, and health readiness endpoint.
- Trust Center with protected-class guardrails, retention reporting, audit export, adverse-impact report endpoint, candidate deletion controls, and match explainability exports.
- Upload security checks, optional malware scanning, rate limiting, structured logs, and admin ops metrics.
- Recruiter Boolean search syntax:
  - `python AND sql`
  - `"sensor data"`
  - `machine learning OR analytics`
  - `python -sales`
- Configurable score weights.
- Parsed profile fields: name, email, phone, degree, GPA, sections, skills, quantified evidence.
- Verdicts: Strong match, Recruiter review, Needs evidence, Low match, Auto-reject.
- Confidence score, parse health, risk flags, evidence snippets, and gap analysis.
- Hard-rule pass/fail outcomes with supporting resume evidence.
- Recruiter-facing evidence panels with exact, alias, and transferable proof labels.
- Next workbench recruiter decisions with notes, candidate status updates, and audit events.
- CSV export with recruiter-facing explanations.
- JD quality warning when the input is not a real job description.
- Role-family templates for data, software, sales, finance, and operations.
- Blind review mode to hide candidate identity during first-pass evaluation.
- Strict evidence mode to flag candidates without grounded evidence snippets.
- Recruiter decisions: shortlist, hold, reject, interview.
- In-browser audit events for candidate decisions, model version, score, verdict, and role family.

## Launch-Grade Backend Requirements

1. Document Processing
   - Server-side parsing with multiple parsers and an OCR provider hook are implemented.
   - Preserve layout sections, tables, dates, bullets, and skill blocks. Baseline extraction is implemented; production OCR quality depends on the configured provider.
   - Store parsed raw text plus structured JSON.

2. Search And Ranking
   - Stage 1 retrieval: BM25/keyword/Boolean search over resumes. Baseline saved-pool retrieval is implemented.
   - Stage 2 semantic retrieval: embeddings over experience bullets, skills, projects, and job requirements. Local fallback and OpenAI-managed embeddings are implemented.
   - Stage 3 reranking: scorecard model combining semantic fit, hard requirements, recency, experience level, education, and recruiter preferences.
   - Stage 4 explanations: cite exact resume evidence and missing requirements.

3. Skill Intelligence
   - Baseline skill taxonomy is implemented.
   - Normalize aliases such as `PostgreSQL -> SQL`, `PyTorch -> Python/ML`, `LLM -> Generative AI`.
   - Track adjacent skills and transferable domain evidence separately from exact matches.

4. Recruiter Workflow
   - Saved jobs and saved candidate pools.
   - Shortlist, reject, hold, and interview states are implemented in the Next workbench.
   - Side-by-side candidate comparison.
   - Reviewer notes and audit trail are implemented for decisions.
   - CSV/ATS export and later ATS integrations.

5. Calibration And Feedback
   - Recruiter labels: good match, bad match, interviewed, offer, hired are implemented.
   - Score calibration by job family and seniority has a baseline dashboard.
   - Measure precision@10, nDCG@10, false knockout rate, recruiter override rate, and score-to-interview correlation.
   - Let customers tune weights per role family.
   - Track decision drift when recruiters repeatedly override the model.

6. Compliance And Trust
   - Avoid protected-class inference. Implemented guardrail reports explicitly refuse demographic inference.
   - Make scoring explainable and auditable. Explainability export endpoint is implemented.
   - Log model version, input files, score components, hard-rule outcomes, and reviewer decisions.
   - Session auth is implemented with optional trusted-header mode for deployment middleware.
   - Bias and adverse-impact monitoring endpoint is implemented for lawfully collected audit groups.
   - Retention report, audit export, and candidate deletion controls are implemented.

## Differentiating Metrics

- Match quality: precision@10, nDCG@10, recruiter acceptance rate.
- Operational impact: review hours saved, time-to-shortlist, candidates reviewed per recruiter hour.
- Trust: explanation coverage, parse confidence, recruiter override rate.
- Funnel quality: shortlist-to-interview, interview-to-offer, offer acceptance, first-year quality.
- Safety: false rejection rate, knockout override rate, missing-required-skill rate.
- Governance: audit coverage, blind-review usage, evidence coverage, model override reasons.
- Calibration: score-to-interview correlation, score-to-offer correlation, role-family calibration error.

## Next Build Milestones

1. Convert this static prototype into a full-stack app with persistent jobs and candidates.
2. Connect a production OCR provider and benchmark scanned-PDF extraction quality.
3. Connect a live Postgres database, run migrations, and enable `TALENTRANK_USE_PRISMA=true` in production.
4. Harden BM25/Boolean retrieval with saved searches, filters, and benchmark coverage.
5. Expand the skill taxonomy into a larger licensed/imported skill graph.
6. Add recall@50, segment calibration, and benchmark dataset import/export.
7. Replace header auth with SSO/login, account management, and secure file storage.
8. Connect managed observability, backups, and retention automation.
9. Run benchmark tests on a larger labeled resume/JD dataset before selling.
