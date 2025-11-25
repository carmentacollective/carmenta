#!/usr/bin/env bash
#
# Claude Code Hook: Protect Main Branch
#
# Prevents dangerous git operations on the main branch:
# - Blocks direct pushes to main
# - Blocks merges into main
# - Blocks git push with --no-verify flag
#

set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract the command from the JSON input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# If no command, allow the operation
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Track if we should block
SHOULD_BLOCK=false
ERRORS=()

# Get current branch if we're in a git repo
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Pattern 1: Direct push to main (with or without origin)
if echo "$COMMAND" | grep -qE 'git\s+push.*(origin\s+)?main\b'; then
  ERRORS+=("Direct push to main branch is forbidden")
  SHOULD_BLOCK=true
fi

# Pattern 1b: Push while on main branch (implicit push to origin/main)
if echo "$COMMAND" | grep -qE '^git\s+push\s*$' && [[ "$CURRENT_BRANCH" == "main" ]]; then
  ERRORS+=("Cannot push while on main branch")
  SHOULD_BLOCK=true
fi

# Pattern 2: Push with --no-verify flag
if echo "$COMMAND" | grep -qE 'git\s+push.*--no-verify'; then
  ERRORS+=("Using --no-verify with git push is forbidden")
  SHOULD_BLOCK=true
fi

# Pattern 3: GitHub CLI merge (block ALL merges via CLI)
if echo "$COMMAND" | grep -qE 'gh\s+pr\s+merge'; then
  ERRORS+=("Merging pull requests via CLI is forbidden - use GitHub web interface")
  SHOULD_BLOCK=true
fi

# If we should block, print errors and exit with code 2
if [ "$SHOULD_BLOCK" = true ]; then
  echo "🚫 BLOCKED: Operation not allowed" >&2
  echo "" >&2
  for error in "${ERRORS[@]}"; do
    echo "  • $error" >&2
  done
  echo "" >&2
  echo "📖 Please read @.cursor/rules/git-interaction.mdc for the full git workflow" >&2
  echo "" >&2
  echo "✅ Recommended workflow:" >&2
  echo "  1. Create feature branch from main: git checkout -b feature-name origin/main" >&2
  echo "  2. Make your changes and commit" >&2
  echo "  3. Push your branch: git push origin feature-name" >&2
  echo "  4. Create a pull request for review" >&2
  exit 2
fi

# Command is safe, allow it
exit 0
