#!/usr/bin/env python3
"""
Claude Code Hook: Test Command Guard

Prevents direct use of `bun test` and enforces `bun run test` instead.

Context:
- `bun test` has different behavior than `bun run test` in this project
- `bun test` runs tests with read-only process.env.NODE_ENV
- `bun run test` uses vitest which allows vi.stubEnv() for environment mocking
- Tests were previously skipped due to this limitation

Blocks:
- bun test (direct test runner)
- npm test (should use `bun run test`)
- pnpm test (should use `bun run test`)

Allows:
- bun run test (uses package.json script)
- bun run test:*  (test script variants)
- Other bun commands

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
        "bun test --watch" -> ("bun", ["test", "--watch"])
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

    Blocks: bun test, npm test, pnpm test
    Allows: bun run test, bun run test:*, other commands

    Returns: Violation if command should be blocked, None if allowed
    """
    program, args = parse_test_command(command_str)

    if not program or not args:
        return None

    # Check if first argument is "test" (not "run" or "test:something")
    if args[0] == "test":
        if program == "bun":
            return Violation(
                message="Direct 'bun test' is not allowed in this project",
                suggestion="Use 'bun run test' instead. This ensures vitest is used with proper environment stubbing support."
            )
        else:
            return Violation(
                message=f"'{program} test' is not allowed in this project",
                suggestion="Use 'bun run test' instead. This project uses bun as the package manager."
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
