# Incident: Integrations Silent Failure

**Date:** 2025-12-11 **Severity:** High (Production bug, no monitoring) **Status:** In
Progress

## Summary

Integrations page showed "No integrations available" despite having services defined.
Root cause: Database schema refactor (user_id → user_email) was merged but migration was
never generated or run. Errors were silently swallowed client-side with no Sentry
alerts.

## Timeline

1. **PR #124 merged** (`ebddf55`): Refactored integrations to use `userEmail` instead of
   `userId`
   - ✅ Schema updated: `user_id` → `user_email`
   - ✅ Code updated to use `userEmail`
   - ❌ Migration never generated
   - ❌ Migration never run on production database

2. **Code deployed** to production with schema mismatch
   - Database: Still has `user_id` column
   - Code: Queries for `user_email` column
   - PostgreSQL errors: `column "user_email" does not exist`

3. **Silent failure** - Errors caught but not reported
   - Client-side try/catch in `app/integrations/page.tsx`
   - `client-logger` only writes to console (no Sentry)
   - User sees empty state, no visible error
   - No alerts, no Sentry reports, no server logs

## Root Causes

### 1. Missing Migration Step

**What happened:**

- Schema was updated in code
- Migration was never generated with `drizzle-kit generate`
- Even if generated, never run with `drizzle-kit push/migrate`

**Why it wasn't caught:**

- No pre-merge check that schema changes have corresponding migrations
- No post-merge hook to auto-generate migrations (unlike mcp-hubby)
- No CI check that validates schema matches expected database state

### 2. Silent Error Swallowing

**What happened:**

```typescript
try {
  const result = await getServicesWithStatus();
  setConnected(result.connected);
  setAvailable(result.available);
} catch (error) {
  logger.error({ error }, "Failed to load services"); // Client logger - console only!
}
```

**Why it's bad:**

- `client-logger` only writes to console - no Sentry integration
- Error disappears into browser console that users don't see
- No production monitoring or alerts
- Developers have no visibility into production errors

### 3. No Schema Drift Detection

**What happened:**

- Database schema diverged from code expectations
- No automated check to detect this drift
- Build/tests passed because they don't connect to real database

**Why it wasn't caught:**

- Tests use mocks, not real database
- No integration test that validates schema matches code
- No deployment check that runs migrations before deploying

## Impact

- **Users:** Saw empty integrations page, appeared broken
- **Duration:** Unknown (silent failure, no monitoring to detect when it started)
- **Data Loss:** None (read-only query failure)
- **Monitoring:** Zero - no alerts, no Sentry reports

## Immediate Fixes

### 1. Run Missing Migration

```sql
ALTER TABLE integrations RENAME COLUMN user_id TO user_email;
ALTER TABLE integrations DROP CONSTRAINT integrations_user_id_users_id_fk;
ALTER TABLE integrations ADD CONSTRAINT integrations_user_email_users_email_fk
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE;
-- Update indexes
```

### 2. Fix Client Logger

- Add Sentry integration to `client-logger.ts`
- Report client-side errors to Sentry for monitoring
- Ensure production errors are visible

### 3. Update Error Handling

- Fix integrations page to report errors to Sentry
- Follow "NEVER swallow errors" rule from coding standards
- Show user-facing error messages with retry option

## Prevention - Long Term Solutions

### 1. Git Hooks (Like mcp-hubby)

Create `.husky/post-merge`:

```bash
#!/bin/sh
if git diff-tree -r --name-only --no-commit-id HEAD@{1} HEAD | grep -q "lib/db/schema.ts"; then
  echo "🗄️  Schema changed - regenerating migrations..."
  pnpm run db:generate
  echo "⚠️  Remember to run: pnpm run db:push (or db:migrate)"
fi
```

Create `.husky/post-checkout`:

```bash
#!/bin/sh
if [ "$3" = "1" ]; then
  if git diff --name-only "$1" "$2" | grep -q "lib/db/schema.ts"; then
    echo "⚠️  🗄️  Schema differs between branches"
    echo "   Run 'pnpm run db:generate' and check migrations"
  fi
fi
```

### 2. Pre-Merge CI Checks

Add to GitHub Actions:

```yaml
- name: 🗄️ Verify schema and migrations are in sync
  run: |
    # Generate migrations from current schema
    pnpm run db:generate

    # Check if any new migration files were created
    if git status --porcelain | grep -q 'drizzle/migrations/'; then
      echo "❌ Schema changed but migrations not generated"
      echo "Run 'pnpm run db:generate' and commit the migration"
      exit 1
    fi
```

### 3. Schema Drift Detection

Add integration test that validates schema matches code:

```typescript
test("database schema matches Drizzle schema", async () => {
  // Compare actual database columns to schema definition
  const actualColumns = await getTableColumns("integrations");
  const expectedColumns = Object.keys(schema.integrations);

  expect(actualColumns).toEqual(expectedColumns);
});
```

### 4. Deployment Migration Check

Update deployment process:

```bash
# Before deploying new code
echo "Running database migrations..."
pnpm run db:migrate

echo "Verifying migrations..."
if [ $? -ne 0 ]; then
  echo "❌ Migration failed - aborting deployment"
  exit 1
fi
```

### 5. Better Error Reporting

- ✅ Update `client-logger` to send errors to Sentry
- ✅ Add error boundaries that report to Sentry
- ✅ Show user-facing error messages with actionable info
- ✅ Monitor error rates in production

### 6. Coding Standards Enforcement

- ✅ Added "NEVER swallow errors" rule to TypeScript standards
- Add ESLint rule to detect try/catch without Sentry reporting
- Add pre-commit check to validate error handling

## Lessons Learned

1. **Silent failures are the worst** - Always report errors to monitoring system
2. **Schema changes are risky** - Need automated validation and testing
3. **CI checks should match deployment** - If production runs migrations, CI should
   verify them
4. **Client-side errors need monitoring too** - Not just server errors
5. **Hooks catch what CI misses** - Post-merge hooks prevent local drift

## Action Items

- [ ] Run the missing migration on production database
- [ ] Add Sentry integration to client-logger
- [ ] Fix integrations page error handling
- [ ] Implement post-merge/post-checkout hooks
- [ ] Add CI check for schema/migration sync
- [ ] Add schema drift detection test
- [ ] Update deployment process to run migrations
- [ ] Create ESLint rule for error handling

## References

- PR #124: https://github.com/carmentacollective/carmenta/pull/124
- Coding Standards: `.cursor/rules/frontend/typescript-coding-standards.mdc`
- Similar pattern in mcp-hubby: `.husky/post-merge`
