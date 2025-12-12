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


def check_test_command(command_str: str) -> Optional[Violation]:
    """
    Check if command contains a blocked test invocation.

    Handles compound commands like "cd /path && bun test" by checking
    if the full command string contains the blocked pattern.

    Returns: Violation if command should be blocked, None if allowed
    """
    # Parse all tokens to find bun/npm/pnpm followed by test
    # This handles compound commands and environment variables
    try:
        tokens = shlex.split(command_str)
    except ValueError:
        # Can't parse, allow through to avoid blocking valid commands
        return None

    # Look for "bun test", "npm test", or "pnpm test" anywhere in the command
    for i, token in enumerate(tokens):
        if token in ["bun", "npm", "pnpm"]:
            # Check if next token is "test" (and not "test:" which is a script name)
            if i + 1 < len(tokens) and tokens[i + 1] == "test":
                if token == "bun":
                    return Violation(
                        message="Direct 'bun test' is not allowed in this project",
                        suggestion="Use 'bun run test' instead. This ensures vitest is used with proper environment stubbing support."
                    )
                else:
                    return Violation(
                        message=f"'{token} test' is not allowed in this project",
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
