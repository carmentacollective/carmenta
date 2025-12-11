#!/usr/bin/env python3
"""
Claude Code Hook: Save Worktree State (PreCompact)

Saves git state before compaction so it can be restored after.
This prevents context drift where Claude forgets which worktree/branch it's in.

Saves to .claude/settings.local.json (worktreeState key):
- Current working directory
- Git branch name
- Whether we're in a worktree
- Main repo path (if in worktree)
- Uncommitted changes (git status)
- Recent commits

Exit codes:
- 0: Always (this hook only saves state, never blocks)
"""

import json
import os
import subprocess
import sys
from pathlib import Path


def run_git(args: list[str], cwd: str) -> str:
    """Run a git command and return stdout, or empty string on failure."""
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            cwd=cwd,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except (subprocess.SubprocessError, FileNotFoundError):
        return ""


def is_worktree(cwd: str) -> bool:
    """Check if we're in a git worktree (not the main repo)."""
    git_dir = Path(cwd) / ".git"
    # Worktrees have a .git file pointing to the main repo, not a .git directory
    return git_dir.exists() and git_dir.is_file()


def get_main_repo_path(cwd: str) -> str:
    """Get the main repository path if we're in a worktree."""
    git_common_dir = run_git(["rev-parse", "--git-common-dir"], cwd)
    if git_common_dir:
        return str(Path(git_common_dir).resolve().parent)
    return ""


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    cwd = input_data.get("cwd", os.getcwd())

    # Gather git state
    state = {
        "cwd": cwd,
        "branch": run_git(["branch", "--show-current"], cwd),
        "is_worktree": is_worktree(cwd),
        "main_repo": get_main_repo_path(cwd) if is_worktree(cwd) else "",
        "status": run_git(["status", "--short"], cwd),
        "recent_commits": run_git(["log", "-3", "--oneline"], cwd),
    }

    # Save to settings.local.json (already gitignored by Claude Code)
    settings_file = Path(cwd) / ".claude" / "settings.local.json"

    # If we're in a worktree, save to main repo's .claude directory instead
    # so the state persists even if we accidentally cd to main repo
    if state["is_worktree"] and state["main_repo"]:
        settings_file = Path(state["main_repo"]) / ".claude" / "settings.local.json"

    settings_file.parent.mkdir(parents=True, exist_ok=True)

    # Load existing settings, merge in our state
    existing = {}
    if settings_file.exists():
        try:
            existing = json.loads(settings_file.read_text())
        except json.JSONDecodeError:
            pass

    existing["worktreeState"] = state
    settings_file.write_text(json.dumps(existing, indent=2))

    sys.exit(0)


if __name__ == "__main__":
    main()
