#!/bin/bash
# Render.com deployment script for Carmenta
# Package management: pnpm
# Runtime: Node.js
# Database: Render PostgreSQL

set -e  # Exit on error

echo "🚀 Starting Carmenta deployment..."
echo "   Node version (runtime): $(node --version)"
echo "   pnpm version (packages): $(pnpm --version)"

# Install dependencies with pnpm
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Run database migrations (Render PostgreSQL)
echo "🗄️  Running database migrations..."
pnpm run db:migrate

# Sync documentation to knowledge base
echo "📚 Syncing system documentation..."
pnpm run docs:sync || { echo "❌ Docs sync failed"; exit 1; }

# Build the application
echo "🏗️  Building application..."
pnpm run build

# Copy static assets for standalone mode
# In standalone mode, Next.js doesn't include public/ and .next/static/ automatically
echo "📁 Copying static assets for standalone build..."
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "✅ Deployment build complete!"
