#!/usr/bin/env bash
#
# Claude Code Hook: Enforce Selective Staging
#
# Blocks dangerous git staging operations that add all files:
# - Blocks git add -A
# - Blocks git add .
# - Blocks git add --all
# - Requires explicit file paths for git add
#
# This enforces the selective staging policy in .cursor/rules/git-interaction.mdc
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

# Pattern 1: git add -A (stages all changes in entire working tree)
if echo "$COMMAND" | grep -qE 'git\s+add\s+(-A|--all)\b'; then
  ERRORS+=("git add -A is forbidden - stage only files you modified")
  SHOULD_BLOCK=true
fi

# Pattern 2: git add . (stages all changes in current directory and subdirectories)
if echo "$COMMAND" | grep -qE 'git\s+add\s+\.(\s|$|&&|\|)'; then
  ERRORS+=("git add . is forbidden - stage only files you modified")
  SHOULD_BLOCK=true
fi

# Pattern 3: git commit -a (automatically stages all tracked files)
if echo "$COMMAND" | grep -qE 'git\s+commit\s+.*-a'; then
  ERRORS+=("git commit -a is forbidden - stage files explicitly first")
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
  echo "📖 Read @.cursor/rules/git-interaction.mdc for selective staging rules" >&2
  echo "" >&2
  echo "✅ Instead, stage specific files you modified:" >&2
  echo "  git add path/to/file1.ts path/to/file2.tsx" >&2
  echo "" >&2
  echo "Or for partial staging of a file:" >&2
  echo "  git add -p path/to/file.ts" >&2
  echo "" >&2
  echo "💡 Be surgical and precise - only stage files YOU modified" >&2
  exit 2
fi

# Command is safe, allow it
exit 0
