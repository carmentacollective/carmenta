#!/bin/bash
# Render.com deployment script for Carmenta
# This script orchestrates the full deployment process
# Database: Supabase Postgres (external, not Render)

set -e  # Exit on error

echo "🚀 Starting Carmenta deployment..."

# Install dependencies with optimizations
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile --prefer-offline

# Run database migrations (Supabase Postgres)
echo "🗄️  Running database migrations..."
pnpm drizzle-kit migrate

# Build the application
echo "🏗️  Building application..."
pnpm build

# Copy static assets for standalone mode
# In standalone mode, Next.js doesn't include public/ and .next/static/ automatically
echo "📁 Copying static assets for standalone build..."
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "✅ Deployment build complete!"
