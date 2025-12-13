#!/usr/bin/env python3
"""
Claude Code Hook: Test Command Guard

Prevents direct use of wrong package managers and enforces `pnpm run test` instead.

Context:
- This project uses pnpm for package management
- `bun test` invokes Bun's native test runner, not Vitest
- `npm test` should use pnpm instead
- `pnpm test` and `pnpm run test` both correctly invoke Vitest

Blocks:
- bun test (Bun's native test runner, not Vitest)
- npm test (should use pnpm)
- npm run test (should use pnpm)

Allows:
- pnpm test (runs package.json script)
- pnpm run test (runs package.json script)
- pnpm run test:* (test script variants)
- Other pnpm/bun commands

Exit codes:
- 0: Command is allowed
- 2: Command is blocked (violations found)
"""

import json
import shlex
import sys
from typing import NamedTuple, Optional


class Violation(NamedTuple):
    message: str
    suggestion: str


def parse_test_command(command: str) -> tuple[str, list[str]]:
    """
    Parse a test command into program and arguments.

    Returns:
        (program, args) where program is bun/npm/pnpm and args are remaining tokens

    Example:
        "pnpm test --watch" -> ("pnpm", ["test", "--watch"])
        "cd /path && bun test" -> ("bun", ["test"])
        "ENV=value npm test" -> ("npm", ["test"])
    """
    try:
        tokens = shlex.split(command)
    except ValueError:
        return ("", [])

    # Find bun/npm/pnpm in tokens (might be after env vars, cd commands, etc.)
    target_programs = {"bun", "npm", "pnpm"}

    for i, token in enumerate(tokens):
        if token in target_programs:
            # Found a target program, return it and remaining args
            return (token, tokens[i + 1:])

    return ("", [])


def check_test_command(command_str: str) -> Optional[Violation]:
    """
    Check if command invokes a blocked test pattern.

    Blocks: bun test, npm test, npm run test
    Allows: pnpm test, pnpm run test, pnpm run test:*, other commands

    Returns: Violation if command should be blocked, None if allowed
    """
    program, args = parse_test_command(command_str)

    if not program or not args:
        return None

    # Check for direct "bun test" (invokes Bun's test runner, not Vitest)
    if program == "bun" and args[0] == "test":
        return Violation(
            message="Direct 'bun test' invokes Bun's test runner, not Vitest",
            suggestion="Use 'pnpm run test' instead. This project uses pnpm for package management."
        )

    # Check for npm usage (should use pnpm)
    if program == "npm" and args[0] in ("test", "run"):
        return Violation(
            message=f"'npm {args[0]}' is not the package manager for this project",
            suggestion="Use 'pnpm run test' instead. This project uses pnpm for package management."
        )

    return None


def main():
    """
    Main hook entry point.
    Reads tool invocation from stdin and validates test commands.
    """
    try:
        # Read the tool invocation from stdin
        input_data = sys.stdin.read()

        # Parse JSON input
        try:
            invocation = json.loads(input_data)
        except json.JSONDecodeError:
            # Invalid JSON, allow through (let Claude handle the error)
            sys.exit(0)

        # Extract the command
        tool_name = invocation.get("tool")
        if tool_name != "Bash":
            # Not a Bash command, allow through
            sys.exit(0)

        tool_input = invocation.get("tool_input", {})
        command = tool_input.get("command", "")

        if not command:
            # Empty command, allow through
            sys.exit(0)

        # Check for test command violations
        violation = check_test_command(command)

        if violation:
            # Block the command
            print(f"❌ {violation.message}", file=sys.stderr)
            print(f"💡 {violation.suggestion}", file=sys.stderr)
            sys.exit(2)

        # Command is allowed
        sys.exit(0)

    except Exception as e:
        # On any error, allow the command through
        # (better to allow questionable commands than block legitimate ones)
        print(f"Warning: Test command guard error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
