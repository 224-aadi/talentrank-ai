import Link from "next/link";
import {
  ScanSearch,
  ListOrdered,
  SearchCode,
  SlidersHorizontal,
  EyeOff,
  ShieldCheck,
  FileDown,
  GitBranch,
  ArrowRight,
  Check,
} from "lucide-react";

const features = [
  { icon: ScanSearch, title: "Server-side ingestion", description: "PDF, DOCX, TXT, MD and CSV parsing with OCR fallback for scanned resumes." },
  { icon: ListOrdered, title: "Hybrid AI ranking", description: "LLM scoring with a lexical fallback, hard-rule knockouts, and skill-graph adjacency." },
  { icon: SearchCode, title: "Boolean search", description: "Query your candidate pool with Boolean syntax and BM25-ranked results." },
  { icon: SlidersHorizontal, title: "Role-tuned weights", description: "Tune score weights per role and calibrate against labeled benchmark outcomes." },
  { icon: EyeOff, title: "Blind review", description: "Strip identifying signals for unbiased evaluation with full audit events." },
  { icon: ShieldCheck, title: "Compliance built in", description: "Protected-class guardrails, adverse-impact reports, and retention controls." },
  { icon: GitBranch, title: "Evidence, not black boxes", description: "Verbatim-grounded evidence snippets and confidence flags for every score." },
  { icon: FileDown, title: "Export & audit", description: "Export ranked results; every evaluation persists as an auditable event." },
];

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-base font-semibold tracking-tight">
            TalentRank<span className="text-primary">AI</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#compliance" className="transition-colors hover:text-foreground">
              Compliance
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-md border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-24 md:pt-32">
          <p className="mb-8 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-px w-8 bg-border" />
            Explainable ATS screening
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] md:text-7xl">
            Rank candidates with evidence,
            <span className="text-muted-foreground"> not guesswork.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-muted-foreground">
            TalentRankAI scores every resume against your job description using hybrid AI matching,
            and surfaces the verbatim evidence behind every decision.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Start screening <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              See how it works
            </a>
          </div>

          <div className="mt-20 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted-foreground">
              <span className="font-mono">jd / senior-backend-eng.md · 47 resumes</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Scored
              </span>
            </div>
            <div className="divide-y divide-border">
              {[
                { name: "A. Okafor", score: 94, tags: ["Go", "Postgres", "Distributed systems"], note: "Led migration of billing service to event-sourced architecture." },
                { name: "M. Tanaka", score: 88, tags: ["Rust", "gRPC", "Kubernetes"], note: "Built ranking pipeline handling 40M events/day." },
                { name: "S. Almeida", score: 81, tags: ["Python", "Airflow", "AWS"], note: "Owned data platform serving 12 product teams." },
              ].map((c) => (
                <div key={c.name} className="grid items-center gap-4 px-5 py-4 md:grid-cols-[auto_1fr_auto]">
                  <div className="flex items-center gap-4">
                    <div className="font-display text-2xl font-semibold tabular-nums">{c.score}</div>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.note}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="hidden text-xs text-muted-foreground md:inline">evidence · 6 snippets</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-16 grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
            <h2 className="text-3xl font-semibold md:text-5xl">Everything a screening team needs.</h2>
            <p className="text-muted-foreground md:text-right">From ingestion to decision — measurable, tunable, auditable.</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="bg-card p-6 transition-colors hover:bg-surface">
                <f.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <h3 className="mt-6 text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="mb-16 max-w-2xl text-3xl font-semibold md:text-5xl">Four steps from JD to shortlist.</h2>
          <div className="grid gap-10 md:grid-cols-4">
            {[
              { step: "01", title: "Upload the JD", text: "Paste the job description and configure hard-rule keywords." },
              { step: "02", title: "Drop in resumes", text: "Batch upload in any format; parsing and OCR happen server-side." },
              { step: "03", title: "Review the ranking", text: "Hybrid scores with evidence snippets, missing signals, and risk flags." },
              { step: "04", title: "Decide & export", text: "Record decisions and export ranked results with a full audit trail." },
            ].map((s) => (
              <div key={s.step} className="border-t border-border pt-6">
                <div className="font-mono text-xs text-muted-foreground">{s.step}</div>
                <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="compliance" className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-3xl font-semibold md:text-5xl">Hiring you can defend.</h2>
            <p className="mt-6 text-muted-foreground">
              AI screening only works if you can explain it. TalentRankAI ships with a Compliance Trust Center: protected-class guardrails,
              adverse-impact monitoring, retention reporting, candidate deletion, and one-click explainability exports.
            </p>
            <ul className="mt-10 space-y-4">
              {[
                "Every evaluation persisted as an auditable event",
                "Precision@10, nDCG@10, and false-knockout metrics",
                "Blind review mode to reduce evaluator bias",
                "Session auth, encrypted storage, rate limiting",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-sm font-semibold">Calibration</h3>
              <span className="font-mono text-xs text-muted-foreground">last 30 days</span>
            </div>
            <div className="mt-6 space-y-6">
              {[
                { label: "Precision@10", pct: 92 },
                { label: "nDCG@10", pct: 88 },
                { label: "Recall@50", pct: 95 },
                { label: "False knockout rate", pct: 4 },
              ].map((m) => (
                <div key={m.label}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-mono tabular-nums">{m.pct}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-28 text-center">
          <h2 className="text-4xl font-semibold md:text-6xl">
            Screen your next batch
            <br />
            in minutes.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
            Upload a job description and a stack of resumes — get an explainable, ranked shortlist.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-6 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row">
          <span className="font-display font-semibold text-foreground">
            TalentRank<span className="text-primary">AI</span>
          </span>
          <span>Explainable ATS screening & candidate ranking</span>
        </div>
      </footer>
    </div>
  );
}
