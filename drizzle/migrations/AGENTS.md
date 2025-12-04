# Database Migrations

**NEVER manually create or edit files in this directory.**

Drizzle tracks migrations through `meta/_journal.json`. Files created manually will
exist but never run—they fail silently.

To create a migration: Edit schema in `lib/db/schema.ts`, then run
`drizzle-kit generate`.

@.cursor/rules/drizzle-database-migrations.mdc
