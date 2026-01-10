# Database Migrations

**NEVER manually create or edit files in this directory.**

Drizzle tracks migrations through `meta/_journal.json`. Files created manually will
exist but never run—they fail silently.

To create a migration: Edit schema in `lib/db/schema.ts`, then run
`drizzle-kit generate`.

## Branch Merge Gotcha: Timestamp Ordering

When migrations are created on parallel branches and merged, the `when` timestamps in
`_journal.json` can become out of order. **This causes migrations to be silently
skipped**, even though Drizzle reports "migrations applied successfully".

Example of the problem:

```
Main branch: idx 26 = migration_a (when: 1767997309596)
Feature branch: idx 26 = migration_b (when: 1767997198308)

After merge:
  idx 26 = migration_a (when: 1767997309596) ← LATER
  idx 27 = migration_b (when: 1767997198308) ← EARLIER (skipped!)
```

**Fix**: After merging branches with migrations, check that `when` timestamps are in
ascending order. If not, manually update the later migration's timestamp to be after the
previous one.

CI catches this with the "Check journal timestamp order" step.

@.cursor/rules/drizzle-database-migrations.mdc
