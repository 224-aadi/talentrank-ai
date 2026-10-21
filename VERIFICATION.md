# Product verification

Run `npm test`, `npm run build`, and `npm run test:product` before a release.

`test:product` starts an isolated production server and submits 550 synthetic
resumes through the same multipart endpoint and queue used by the browser. It
checks authentication, protected pages, PDF parsing, retry after a lost response,
pause/resume, exactly-once persistence, candidate search, semantic indexing,
original downloads, review decisions, CSV exports, pagination, invalid-file
isolation, workspace isolation, and logout. Test reports are written to a new
temporary directory. Real candidate data is never required.

The default local test uses local storage and lexical scoring. CI repeats it
against PostgreSQL 16 (`QA_USE_PRISMA=true`). These timings do not measure hosted
OCR or AI latency. To verify the deployed providers, explicitly set `QA_BASE_URL`
to the intended deployment. This creates synthetic accounts and screening records
there and uses that deployment's configured storage, scanning, ranking, and
embedding providers. `QA_RESUME_COUNT` changes the default of 550.
`QA_SCANNED_PDF` can point to a synthetic image-only PDF; when supplied, the test
requires a successful `pdf+ocr` result. Never use a real person's resume as a QA
fixture without authorization.

## Upload behavior

- A user may select 550 resumes at once. The browser persists the queue in
  IndexedDB, scoped to that user's workspace, and sends at most four files and
  3.2 MB per request to stay below the frontend proxy limit.
- Completed batches and retry receipts commit atomically in PostgreSQL. Repeating
  an idempotency key with the same files returns the existing result. Reusing the
  key for different files returns 409.
- Temporary failures and 429 responses retry with bounded backoff and
  `Retry-After`. Exhausted retries leave the queue available to resume. Expired
  sessions require signing in again before resuming.
- Invalid resumes are reported by filename while valid files continue. The
  completion count includes every accepted or rejected file. Oversized files
  require compression or a smaller JD payload; they are reported explicitly.
- Pause waits for the current request to finish saving. A page reload restores
  the queue and completed results. Keep the browser open while actively
  processing; this is a resumable browser queue, not an unattended server job.
- Results and the candidate archive are paginated; CSV exports include the full
  result set.

## Operational checks

`/api/health` verifies database connectivity. It does not prove that OCR, storage,
email, or AI credentials work; exercise each provider in a live workflow.
Render free instances sleep, and paused Supabase projects cannot authenticate
users or persist resumes. Production availability requires active infrastructure;
application retries cannot restore a paused database. No paid-plan changes are
performed by verification.
