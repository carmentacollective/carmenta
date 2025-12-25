#!/bin/bash
# Vercel deployment script for Carmenta
# Package management: pnpm
# Runtime: Node.js
# Database: Supabase Postgres (external)

set -e  # Exit on error

echo "🚀 Starting Carmenta deployment..."
echo "   Node version (runtime): $(node --version)"
echo "   pnpm version (packages): $(pnpm --version)"

# Sync documentation to knowledge base
echo "📚 Syncing system documentation..."
pnpm run docs:sync || { echo "❌ Docs sync failed"; exit 1; }

# Build the application
echo "🏗️  Building application..."
pnpm run build

echo "✅ Deployment build complete!"
