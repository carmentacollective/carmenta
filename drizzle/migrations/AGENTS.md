# STOP - Do Not Edit Migration Files Directly

**NEVER manually create or edit files in this directory.**

Drizzle tracks migrations through `meta/_journal.json`. Files created manually will
exist but never run - they fail silently.

## To Create a Migration

1. Edit the schema (usually `lib/db/schema.ts` or `src/db/schema.ts`)
2. Run `drizzle-kit generate` (or `bun drizzle-kit generate`,
   `pnpm drizzle-kit generate`)
3. Review the generated SQL
4. Test with `drizzle-kit migrate`

The tool handles the journal and snapshots automatically.
