# TalentRank Database Setup

TalentRank currently runs with a JSON persistence adapter for local development and keeps a Prisma/Postgres schema ready for production deployment.

## Local Prisma Validation

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/talentrank npx prisma validate
```

## Production Setup

1. Create a Postgres database.
2. Set `DATABASE_URL`.
3. Set `TALENTRANK_USE_PRISMA=true`.
4. Run:

```bash
npm run prisma:generate
npm run prisma:migrate
```

After pulling the auth milestone, create a migration for the new user auth fields:

```bash
npx prisma migrate dev --name add_user_auth_fields
```

After pulling the benchmark-quality milestone, create a migration for benchmark cases and benchmark run history:

```bash
npx prisma migrate dev --name add_benchmark_quality_tables
```

## Production Tables

The schema includes organizations, users, jobs, candidates, resumes, vector records, match runs, recruiter decisions, benchmark labels, benchmark cases, benchmark runs, audit events, and evaluation snapshots. Users include `passwordHash` and `lastLoginAt` for native session auth.

Enterprise account workflows also use:

- `inviteTokenHash`
- `inviteExpiresAt`
- `resetTokenHash`
- `resetExpiresAt`

## Next Adapter Step

The runtime store uses JSON by default for local development. When `DATABASE_URL` and `TALENTRANK_USE_PRISMA=true` are set, `lib/store.ts` routes repository calls to the Prisma adapter in `lib/prisma-store.ts`.
