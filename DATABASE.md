# TalentRank Database Setup

TalentRank currently runs with a JSON persistence adapter for local development and keeps a Prisma/Postgres schema ready for production deployment.

## Local Prisma Validation

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/talentrank npx prisma validate
```

## Production Setup

1. Create a Postgres database.
2. Set `DATABASE_URL`.
3. Run:

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Production Tables

The schema includes organizations, users, jobs, candidates, resumes, vector records, match runs, recruiter decisions, benchmark labels, audit events, and evaluation snapshots.

## Next Adapter Step

The remaining implementation step is swapping the JSON repository functions in `lib/store.ts` to a Prisma-backed adapter when `DATABASE_URL` is present. The schema and env contract are ready for that cutover.
