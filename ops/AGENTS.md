# Operations Scripts

Scripts for managing Carmenta infrastructure and operations.

## pull-db.sh

Pulls the production database from Render to your local development environment.

### Prerequisites

1. **PostgreSQL 18+ client tools** - Production runs Postgres 18

   ```bash
   brew install postgresql@18
   ```

2. **RENDER_DATABASE_URL** - The external connection URL from Render Dashboard
   - Go to https://dashboard.render.com
   - Select `carmenta-db`
   - Navigate to Info → Connections
   - Copy "External Database URL"

3. **DATABASE_URL** - Your local database connection (usually in `.env.local`)

### Usage

```bash
# Set the production URL (one-time per terminal session)
export RENDER_DATABASE_URL='postgres://carmenta_db_user:password@host.oregon-postgres.render.com/carmenta_db'

# Run the script
./ops/pull-db.sh
```

### What It Does

1. Dumps production database using `pg_dump` (custom format, compressed)
2. Excludes Temporal schemas (they're auto-managed by Temporal)
3. Restores to local database, replacing existing data
4. Cleans up temporary files

### Safety Features

- Refuses to run if `NODE_ENV=production`
- Warns if not running on macOS (prevents accidental server execution)
- Confirms before overwriting local data
- Checks PostgreSQL version compatibility

### Troubleshooting

**"pg_dump: server version mismatch"**

Your local pg_dump is older than production (Postgres 18). Upgrade:

```bash
brew upgrade postgresql@18
# Make sure the new version is in your PATH
```

**"connection refused" or timeout**

Render databases require external access to be enabled. Check the database settings in
Render Dashboard.
