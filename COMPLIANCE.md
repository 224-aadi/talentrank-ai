# TalentRank Compliance Checklist

TalentRank is intended to support recruiters, not replace human decision-making. Before selling this product, treat AI hiring compliance as a first-class product requirement.

## Product Guardrails

- Do not infer or score protected characteristics.
- TalentRank guardrail reports flag protected-class language but do not infer protected-class membership.
- Do not use name, photo, age, gender, race, ethnicity, disability, religion, marital status, pregnancy, or citizenship as scoring features.
- Keep hard rules explicit and customer-configured.
- Require human review before rejection when the product is used for consequential employment decisions.
- Show evidence for every positive match and every material gap.
- Preserve model version, job input, score components, recruiter decision, and timestamp.

## Candidate Transparency

Customers may need to disclose:

- That an automated or AI-assisted tool is used.
- The job qualifications and characteristics being evaluated.
- How to request accommodation or human review.
- Data retention and deletion practices.

## Audit Requirements To Prepare For

- NYC Local Law 144 style AEDT bias audits and candidate notice.
- EU AI Act high-risk AI obligations for recruitment and employment systems.
- Colorado AI Act high-risk AI deployer/developer documentation and risk-management obligations.
- Illinois employment AI notice and anti-discrimination requirements.
- Customer-specific HR, procurement, security, privacy, and works-council reviews.

## Launch Controls

- Trust Center at `/compliance`.
- Protected-class language scan at `/api/compliance/guardrails`.
- Adverse-impact monitor at `/api/compliance/adverse-impact`.
- Retention report at `/api/compliance/retention`.
- Audit export at `/api/compliance/audit-export`.
- Match explainability export at `/api/compliance/explainability?matchRunId=...`.
- Candidate deletion endpoint at `DELETE /api/candidates/:candidateId`.
- Annual independent bias audit process.
- Internal model card and public-facing system description.
- Data processing agreement and subprocessors list.
- SOC 2 roadmap if selling to mid-market or enterprise.
- DPIA / impact assessment template.
- Security review package.
- Retention and deletion controls.
- Human override and appeal workflow.
- Bias and adverse-impact dashboard.

## Metrics To Monitor

- False rejection rate.
- Knockout override rate.
- Recruiter override rate.
- Score-to-interview correlation.
- Score-to-offer correlation.
- Selection rate by demographic group where lawfully collected for audit.
- Impact ratios.
- Evidence coverage.
- Parse failure rate.
- Candidate complaint / appeal rate.

## OCR And Parsing Controls

- Scanned PDFs are detected when embedded PDF text is sparse.
- OCR is provider-based through `OCR_API_URL` and optional `OCR_API_KEY`.
- Resume parsing now captures bullets, dates, table-like structures, work timeline evidence, parse confidence, and layout warnings.
- Low parse confidence or OCR warnings should trigger recruiter review before consequential decisions.

## Required Legal Review

This checklist is product planning support, not legal advice. Before commercial launch, review with employment counsel and privacy counsel in each target market.
