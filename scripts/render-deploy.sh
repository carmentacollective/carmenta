#!/bin/bash
# Render.com deployment script for Carmenta
# This script orchestrates the full deployment process
# Runtime: Bun (configured via .bun-version and BUN_VERSION env var)
# Database: Supabase Postgres (external, not Render)

set -e  # Exit on error

echo "🚀 Starting Carmenta deployment with Bun..."
echo "   Bun version: $(bun --version)"

# Install dependencies with optimizations
echo "📦 Installing dependencies..."
bun install --frozen-lockfile

# Run database migrations (Supabase Postgres)
echo "🗄️  Running database migrations..."
bun run db:migrate

# Build the application
echo "🏗️  Building application..."
bun run build

# Copy static assets for standalone mode
# In standalone mode, Next.js doesn't include public/ and .next/static/ automatically
echo "📁 Copying static assets for standalone build..."
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "✅ Deployment build complete!"
