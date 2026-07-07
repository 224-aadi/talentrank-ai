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
- Structured resume JSON extraction for contact, sections, skills, education, experience, projects, certifications, quantified evidence, and seniority signals.
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
   - Server-side parsing with multiple parsers and OCR fallback.
   - Preserve layout sections, tables, dates, bullets, and skill blocks.
   - Store parsed raw text plus structured JSON. Baseline structured JSON is implemented; deeper layout fidelity and OCR remain.

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
   - Avoid protected-class inference.
   - Make scoring explainable and auditable.
   - Log model version, input files, score components, hard-rule outcomes, and reviewer decisions.
   - Add bias and adverse-impact monitoring before enterprise launch.

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
2. Add a backend parser pipeline with OCR and structured JSON extraction.
3. Swap JSON repository functions to Prisma when `DATABASE_URL` is configured.
4. Harden BM25/Boolean retrieval with saved searches, filters, and benchmark coverage.
5. Expand the skill taxonomy into a larger licensed/imported skill graph.
6. Add recall@50, segment calibration, and benchmark dataset import/export.
7. Add organization accounts, roles, audit logs, and secure file storage.
8. Run benchmark tests on a labeled resume/JD dataset before selling.
