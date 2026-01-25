#!/bin/bash

# ---------------------------------------------------------------------------- #
#   Pull production database from Render to local development environment      #
# ---------------------------------------------------------------------------- #
#
# Usage:
#   ./ops/pull-db.sh
#
# Requirements:
#   - RENDER_DATABASE_URL env var set (external URL from Render dashboard)
#   - DATABASE_URL env var set (local database connection)
#   - pg_dump and pg_restore installed (matching Postgres 18+)
#
# The external URL is found in Render Dashboard:
#   Database → Info → Connections → External Database URL
#
# ---------------------------------------------------------------------------- #

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------- #
# Safety checks
# ---------------------------------------------------------------------------- #

# Prevent running on production servers
if [[ $(uname) != "Darwin" ]]; then
    echo -e "${RED}This script is designed for Mac only.${NC}"
    echo "Running on a server could overwrite production data."
    read -p "Are you SURE you want to continue? (type 'yes' to confirm): " CONFIRM
    if [[ $CONFIRM != "yes" ]]; then
        echo "Aborting."
        exit 1
    fi
fi

if [[ $NODE_ENV == "production" ]]; then
    echo -e "${RED}NODE_ENV is set to 'production'. Refusing to run.${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------- #
# Configuration
# ---------------------------------------------------------------------------- #

DUMP_FILE="/tmp/carmenta-db-dump.sql"

# Load .env.local if it exists (for DATABASE_URL)
if [[ -f .env.local ]]; then
    # Export only DATABASE_URL to avoid polluting environment
    export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d '=' -f2-)
fi

# Check required environment variables
if [[ -z "$RENDER_DATABASE_URL" ]]; then
    echo -e "${RED}Error: RENDER_DATABASE_URL is not set${NC}"
    echo ""
    echo "Get the external URL from Render Dashboard:"
    echo "  1. Go to https://dashboard.render.com"
    echo "  2. Select carmenta-db"
    echo "  3. Go to Info → Connections"
    echo "  4. Copy 'External Database URL'"
    echo ""
    echo "Then run:"
    echo "  export RENDER_DATABASE_URL='postgres://...'"
    echo "  ./ops/pull-db.sh"
    exit 1
fi

if [[ -z "$DATABASE_URL" ]]; then
    echo -e "${RED}Error: DATABASE_URL is not set${NC}"
    echo ""
    echo "Set your local database connection:"
    echo "  export DATABASE_URL='postgresql://localhost:5432/carmenta'"
    echo ""
    echo "Or add it to .env.local"
    exit 1
fi

# ---------------------------------------------------------------------------- #
# Version check
# ---------------------------------------------------------------------------- #

echo -e "${YELLOW}Checking PostgreSQL version compatibility...${NC}"

# Get local pg_dump version
LOCAL_VERSION=$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
echo "  Local pg_dump version: $LOCAL_VERSION"

# Production is Postgres 18 (from render.yaml)
echo "  Production database: PostgreSQL 18"

# Extract major version for comparison
LOCAL_MAJOR=$(echo $LOCAL_VERSION | cut -d. -f1)
if [[ $LOCAL_MAJOR -lt 18 ]]; then
    echo -e "${YELLOW}Warning: Your pg_dump ($LOCAL_VERSION) is older than production (18).${NC}"
    echo "This may cause compatibility issues. Consider upgrading:"
    echo "  brew upgrade postgresql@18"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ $CONTINUE != "y" && $CONTINUE != "Y" ]]; then
        exit 1
    fi
fi

# ---------------------------------------------------------------------------- #
# Dump production database
# ---------------------------------------------------------------------------- #

echo ""
echo -e "${GREEN}Dumping production database...${NC}"
echo "This may take a while depending on database size."

# Use custom format (-Fc) for efficient compression and selective restore
# Exclude Temporal schemas - they're managed by Temporal auto-setup
pg_dump "$RENDER_DATABASE_URL" \
    --format=custom \
    --verbose \
    --no-owner \
    --no-privileges \
    --exclude-schema='temporal' \
    --exclude-schema='temporal_visibility' \
    --file="$DUMP_FILE"

DUMP_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
echo -e "${GREEN}Dump complete: $DUMP_FILE ($DUMP_SIZE)${NC}"

# ---------------------------------------------------------------------------- #
# Restore to local database
# ---------------------------------------------------------------------------- #

echo ""
echo -e "${YELLOW}Restoring to local database...${NC}"
echo "Target: $DATABASE_URL"
echo ""

# Confirm before overwriting local data
read -p "This will REPLACE your local database. Continue? (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
    echo "Dump saved at: $DUMP_FILE"
    echo "To restore manually:"
    echo "  pg_restore --dbname=\$DATABASE_URL --verbose --clean --if-exists --no-owner --no-privileges $DUMP_FILE"
    exit 0
fi

# Restore with --clean to drop existing objects first
# --if-exists prevents errors if objects don't exist yet
pg_restore \
    --dbname="$DATABASE_URL" \
    --verbose \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "$DUMP_FILE"

echo ""
echo -e "${GREEN}Database restored successfully!${NC}"

# Cleanup
rm -f "$DUMP_FILE"
echo "Cleaned up temporary dump file."
