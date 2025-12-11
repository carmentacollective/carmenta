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
- Context drift: operating on main repo (on any non-main branch) when worktrees exist

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
from pathlib import Path
from typing import NamedTuple, Optional


class Violation(NamedTuple):
    message: str
    suggestion: str


# ============================================================================
# Worktree Detection & Context Drift Prevention
# ============================================================================


def is_in_worktree(cwd: str) -> bool:
    """
    Check if the current directory is inside a git worktree.

    Returns True if .git is a file (not a directory), which points to the main repo.
    Worktrees have a .git file containing "gitdir: /path/to/main/.git/worktrees/name".
    """
    try:
        path = Path(cwd).resolve()

        # Check if .git is a file (worktrees have .git file, main repo has .git directory)
        git_path = path / ".git"
        while not git_path.exists() and path.parent != path:
            path = path.parent
            git_path = path / ".git"

        if git_path.exists() and git_path.is_file():
            return True

        return False
    except (OSError, ValueError):
        return False


def get_main_repo_path(cwd: str) -> Optional[str]:
    """
    Get the main repository path from a worktree.
    Returns None if not in a worktree or can't determine main repo.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-common-dir"],
            capture_output=True,
            text=True,
            cwd=cwd,
        )
        if result.returncode == 0:
            git_common_dir = Path(result.stdout.strip()).resolve()
            # git-common-dir returns the .git directory path
            # Main repo is parent of .git
            return str(git_common_dir.parent)
        return None
    except (subprocess.SubprocessError, FileNotFoundError):
        return None


def get_worktree_info(cwd: str) -> Optional[dict]:
    """
    Get information about the current worktree.
    Returns dict with 'path', 'branch', 'main_repo' or None if not in worktree.
    """
    if not is_in_worktree(cwd):
        return None

    try:
        # Get current branch
        branch_result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            cwd=cwd,
        )
        branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "unknown"

        # Get main repo path
        main_repo = get_main_repo_path(cwd)

        return {
            "path": str(Path(cwd).resolve()),
            "branch": branch,
            "main_repo": main_repo,
        }
    except (subprocess.SubprocessError, FileNotFoundError):
        return None


def check_context_drift(cwd: str) -> Optional[Violation]:
    """
    Detect if Claude has drifted from worktree context to main repo.

    This prevents the scenario where:
    1. Claude starts working in a worktree (sibling directory)
    2. Context gets compacted/summarized
    3. Claude forgets it's in a worktree and defaults to main repo
    4. Operations accidentally affect main repo instead of worktree

    Detection strategy:
    - Check if worktrees exist (via git worktree list)
    - Check if we're in main repo (not a worktree)
    - Check current branch is NOT a protected branch (main, master)
    - If all true: we're likely in the wrong place after context drift
    """
    try:
        current_path = Path(cwd).resolve()

        # Check if any worktrees exist by running git worktree list
        worktree_result = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=cwd,
        )
        if worktree_result.returncode != 0:
            return None

        # Count worktrees (each worktree block is separated by blank line)
        worktree_blocks = [b for b in worktree_result.stdout.strip().split("\n\n") if b]
        has_worktrees = len(worktree_blocks) > 1  # More than just main repo

        # Get current branch
        branch_result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            cwd=cwd,
        )
        current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else ""

        # Check if we're in main repo (not in worktree)
        in_worktree = is_in_worktree(cwd)

        # DRIFT DETECTED: We're in main repo, on a non-main branch, and worktrees exist
        # This strongly suggests Claude drifted from worktree to main repo
        protected_branches = {"main", "master"}
        if not in_worktree and has_worktrees and current_branch and current_branch not in protected_branches:
            # Try to find the worktree for this branch from git worktree list output
            worktree_path = None
            for block in worktree_blocks:
                if f"branch refs/heads/{current_branch}" in block:
                    for line in block.split("\n"):
                        if line.startswith("worktree "):
                            worktree_path = line[9:]  # Remove "worktree " prefix
                            break
                    break

            if worktree_path:
                worktree_hint = f"cd {worktree_path}"
            else:
                worktree_hint = "Run `git worktree list` to find your worktree"

            return Violation(
                f"⚠️  CONTEXT DRIFT DETECTED: Working in main repo on branch '{current_branch}'",
                f"You're likely in the wrong directory after context compaction.\n"
                f"  Current location: {current_path}\n"
                f"  {worktree_hint}"
            )

        return None
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        return None


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


def is_dangerous_git_operation(command: str) -> bool:
    """
    Check if command contains dangerous git operations that modify state.

    Dangerous operations that should be blocked when context drift detected:
    - git add (stages files)
    - git commit (creates commits)
    - git push (pushes commits)
    - git merge (merges branches)
    - git rebase (rewrites history)
    - git reset (moves HEAD)
    - git checkout (switches branches/files)
    - git switch (switches branches)
    - git restore (restores files)
    - git cherry-pick (applies commits)
    - git stash pop/apply (modifies working directory)

    Safe operations that should be allowed even with drift:
    - git status, git log, git diff (read-only)
    - git branch --show-current (read-only)
    - git worktree list (read-only)
    - Navigation commands: cd, pwd
    - Non-git commands: gh, ls, cat, etc.
    """
    subcommand, _, _ = parse_git_command(command)

    # List of dangerous git subcommands that modify repository state
    DANGEROUS_SUBCOMMANDS = {
        "add", "commit", "push", "merge", "rebase", "reset",
        "checkout", "switch", "restore", "cherry-pick"
    }

    # Special case: "git stash pop" and "git stash apply" are dangerous
    # but "git stash list" is safe
    if subcommand == "stash":
        return any(op in command for op in ["pop", "apply", "drop", "clear"])

    return subcommand in DANGEROUS_SUBCOMMANDS


def check_command(command: str, cwd: str) -> list[Violation]:
    """
    Main entry point: check a command for all violations.

    Args:
        command: The bash command to check
        cwd: Current working directory from hook input
    """
    violations = []

    # Check for context drift
    drift_violation = check_context_drift(cwd)
    if drift_violation:
        # Only block if the command is a dangerous git operation
        # Allow navigation commands (cd, pwd) and read-only operations
        if is_dangerous_git_operation(command):
            violations.append(drift_violation)
            return violations
        else:
            # Just warn but don't block - this allows recovery from drift
            print(f"\n⚠️  {drift_violation.message}", file=sys.stderr)
            print(f"  {drift_violation.suggestion}\n", file=sys.stderr)

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
