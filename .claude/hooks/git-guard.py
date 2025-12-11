#!/usr/bin/env python3
"""
Claude Code Hook: Git Guard

Protects against dangerous git operations by properly parsing git commands
instead of fragile regex matching.

Blocks:
- Direct pushes to main branch
- git push --no-verify
- git commit --no-verify
- gh pr merge (use GitHub web interface)
- git add -A / git add . / git add --all (stage files explicitly)
- git commit -a (stage files explicitly first)

Exit codes:
- 0: Command is allowed
- 2: Command is blocked (violations found)

Allows:
- git commit --amend (amend contains 'a' but is not the -a flag)
- All other safe operations
"""

import json
import os
import shlex
import subprocess
import sys
from typing import NamedTuple


class Violation(NamedTuple):
    message: str
    suggestion: str


def get_working_directory_from_command(command: str) -> str:
    """
    Extract the target directory if command starts with cd.
    Returns None if no cd command is present.
    """
    try:
        tokens = shlex.split(command)
        # Look for pattern: cd <path> && ...
        if len(tokens) >= 3 and tokens[0] == "cd" and tokens[2] == "&&":
            return tokens[1]
    except ValueError:
        pass
    return None


def get_upstream_branch(cwd: str = None) -> str:
    """
    Get the upstream branch that will be pushed to.
    Returns empty string if no upstream is configured.

    Args:
        cwd: Optional working directory to run the command in.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "@{upstream}"],
            capture_output=True,
            text=True,
            cwd=cwd,  # Run in specific directory if provided
        )
        if result.returncode == 0:
            # Returns something like "origin/main" or "origin/feature-branch"
            upstream = result.stdout.strip()
            if "/" in upstream:
                return upstream.split("/", 1)[1]  # Extract branch name
        return ""
    except (subprocess.SubprocessError, FileNotFoundError):
        return ""


def parse_git_command(command: str) -> tuple[str, list[str], list[str]]:
    """
    Parse a git command into its components.

    Returns:
        (subcommand, flags, positional_args)

    Example:
        "git commit --amend -m 'msg'" -> ("commit", ["--amend", "-m"], ["msg"])

    Note: This parser is optimized for the current validation needs. Flag values
    are treated as positional args, which is acceptable since our checks don't
    distinguish between flag values and actual positional arguments.
    """
    try:
        tokens = shlex.split(command)
    except ValueError:
        return ("", [], [])

    # Find 'git' in the tokens (might be prefixed with env vars, etc.)
    git_idx = -1
    for i, token in enumerate(tokens):
        if token == "git":
            git_idx = i
            break

    if git_idx == -1 or git_idx + 1 >= len(tokens):
        return ("", [], [])

    subcommand = tokens[git_idx + 1]
    remaining = tokens[git_idx + 2:]

    flags = []
    positional = []

    # Simple classification: flags start with '-', everything else is positional
    # Flag values (like the "msg" in -m "msg") end up in positional, which is
    # fine for our current validation logic that doesn't need to distinguish them
    for token in remaining:
        if token.startswith("-"):
            flags.append(token)
        else:
            positional.append(token)

    return (subcommand, flags, positional)


def has_flag(flags: list[str], *names: str) -> bool:
    """Check if any of the given flag names are present."""
    for flag in flags:
        # Handle combined short flags like -am
        if flag.startswith("-") and not flag.startswith("--"):
            # Expand -am to ['-a', '-m']
            short_flags = [f"-{c}" for c in flag[1:]]
            for name in names:
                if name in short_flags:
                    return True
        if flag in names:
            return True
    return False


def check_git_push(flags: list[str], positional: list[str], cwd: str = None) -> list[Violation]:
    """
    Check git push for violations.

    Args:
        flags: Git push flags
        positional: Positional arguments
        cwd: Optional working directory (for worktree support)
    """
    violations = []

    # Check for --no-verify
    if has_flag(flags, "--no-verify"):
        violations.append(Violation(
            "git push --no-verify is forbidden",
            "Remove --no-verify and fix any hook failures"
        ))

    # Check for push to main
    # Patterns: "git push origin main", "git push main", or bare "git push" when upstream is main
    # Also check refspecs like "HEAD:main" or "feature:main"
    pushing_to_main = False

    # Check for explicit pushes to main in command arguments
    for arg in positional:
        # Strip force push prefix (+) if present (e.g., +main or +feature:main)
        clean_arg = arg.lstrip("+")

        # Check direct branch names and full ref paths
        if clean_arg in ["main", "master", "refs/heads/main", "refs/heads/master"]:
            pushing_to_main = True
            break

        # Check refspecs (format: source:dest, e.g., "feature:main" or "HEAD:main")
        # Refspecs allow pushing one branch to another: git push origin local:remote
        # We only care about the destination (right side of :)
        if ":" in clean_arg:
            _, dest = clean_arg.split(":", 1)
            if dest in ["main", "master", "refs/heads/main", "refs/heads/master"]:
                pushing_to_main = True
                break

    # For bare "git push" or "git push origin", check upstream tracking
    # This handles worktrees correctly by checking where the branch actually pushes to
    if not pushing_to_main and len(positional) <= 1:
        upstream = get_upstream_branch(cwd)
        if upstream in ["main", "master"]:
            pushing_to_main = True

    if pushing_to_main:
        violations.append(Violation(
            "Direct push to main branch is forbidden",
            "Push to a feature branch and create a pull request"
        ))

    return violations


def check_git_add(flags: list[str], positional: list[str]) -> list[Violation]:
    """Check git add for violations."""
    violations = []

    # Block -A or --all
    if has_flag(flags, "-A", "--all"):
        violations.append(Violation(
            "git add -A/--all is forbidden",
            "Stage only the specific files you modified: git add path/to/file.ts"
        ))

    # Block "git add ." or paths ending with "/."
    for arg in positional:
        if arg == "." or arg.endswith("/."):
            violations.append(Violation(
                "git add . is forbidden",
                "Stage only the specific files you modified: git add path/to/file.ts"
            ))
            break

    return violations


def check_git_commit(flags: list[str], positional: list[str]) -> list[Violation]:
    """Check git commit for violations."""
    violations = []

    # Block --no-verify
    if has_flag(flags, "--no-verify", "-n"):
        violations.append(Violation(
            "git commit --no-verify is forbidden",
            "Remove --no-verify and fix any hook failures"
        ))

    # Block -a (but NOT --amend!)
    # has_flag properly handles this because --amend != -a
    if has_flag(flags, "-a", "--all"):
        violations.append(Violation(
            "git commit -a is forbidden",
            "Stage files explicitly first: git add path/to/file.ts && git commit -m '...'"
        ))

    return violations


def check_gh_command(command: str) -> list[Violation]:
    """Check GitHub CLI commands for violations."""
    violations = []

    try:
        tokens = shlex.split(command)
    except ValueError:
        return violations

    # Find 'gh' in tokens
    if "gh" not in tokens:
        return violations

    gh_idx = tokens.index("gh")
    remaining = tokens[gh_idx + 1:]

    # Block "gh pr merge"
    if len(remaining) >= 2 and remaining[0] == "pr" and remaining[1] == "merge":
        violations.append(Violation(
            "Merging PRs via CLI is forbidden",
            "Use the GitHub web interface to merge pull requests"
        ))

    return violations


def check_command(command: str, cwd: str) -> list[Violation]:
    """
    Main entry point: check a command for all violations.

    Args:
        command: The bash command to check
        cwd: Current working directory from hook input
    """
    violations = []

    # Context drift check removed - too aggressive for normal workflow
    # Users can work in main repo even when worktrees exist

    # Extract working directory if present in command (for cd && git patterns)
    command_cwd = get_working_directory_from_command(command)
    effective_cwd = command_cwd if command_cwd else cwd

    # Check gh commands
    violations.extend(check_gh_command(command))

    # Parse and check git commands
    subcommand, flags, positional = parse_git_command(command)

    if subcommand == "push":
        violations.extend(check_git_push(flags, positional, effective_cwd))
    elif subcommand == "add":
        violations.extend(check_git_add(flags, positional))
    elif subcommand == "commit":
        violations.extend(check_git_commit(flags, positional))

    return violations


def main():
    # Read JSON input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Invalid JSON, allow through

    # Extract command and current working directory
    command = input_data.get("tool_input", {}).get("command", "")
    cwd = input_data.get("cwd", os.getcwd())

    if not command:
        sys.exit(0)

    # Check for violations
    violations = check_command(command, cwd)

    if violations:
        print("\n*** BLOCKED: Operation not allowed ***\n", file=sys.stderr)
        for v in violations:
            print(f"  {v.message}", file=sys.stderr)
            print(f"    -> {v.suggestion}\n", file=sys.stderr)
        print("See .cursor/rules/git-interaction.mdc for git workflow rules", file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
