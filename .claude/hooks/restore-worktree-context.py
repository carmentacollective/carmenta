#!/usr/bin/env python3
"""
Claude Code Hook: Restore Worktree Context (SessionStart)

After compaction, injects git state context so Claude knows where it is.
This prevents context drift where Claude forgets which worktree/branch it's in.

Only fires when source is "compact" (not on startup, resume, or clear).
Reads state from .claude/settings.local.json (worktreeState key).

Output (on success):
- JSON with additionalContext containing git state summary
- Includes drift warning if cwd differs from saved state

Exit codes:
- 0: Always (outputs JSON for Claude to consume)
"""

from pathlib import Path
import json
import os
import subprocess
import sys


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    # Only fire after compaction
    if input_data.get("source") != "compact":
        sys.exit(0)

    cwd = input_data.get("cwd", str(Path.cwd()))

    # Try to find settings.local.json
    # Check cwd first, then check if we can find main repo's .claude
    settings_file = Path(cwd) / ".claude" / "settings.local.json"

    if not settings_file.exists():
        # If we're in a worktree, the settings file is in main repo
        # Try to find it via git rev-parse --git-common-dir
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--git-common-dir"],  # noqa: S607
                check=False,
                capture_output=True,
                text=True,
                cwd=cwd,
            )
            if result.returncode == 0:
                git_common_dir = Path(result.stdout.strip()).resolve()
                main_repo = git_common_dir.parent
                settings_file = main_repo / ".claude" / "settings.local.json"
        except (subprocess.SubprocessError, FileNotFoundError):
            pass

    if not settings_file.exists():
        sys.exit(0)

    try:
        settings = json.loads(settings_file.read_text())
        state = settings.get("worktreeState")
        if not state:
            sys.exit(0)
    except (OSError, json.JSONDecodeError):
        sys.exit(0)

    # Build context message
    lines = ["## Git State (restored after compaction)"]

    if state.get("is_worktree"):
        lines.append("**You are in a WORKTREE** - not the main repo!")
        lines.append(f"- Worktree path: `{state.get('cwd')}`")
        lines.append(f"- Main repo: `{state.get('main_repo')}`")

    if state.get("branch"):
        lines.append(f"- Branch: `{state.get('branch')}`")

    if state.get("status"):
        lines.append(f"\n**Uncommitted changes:**\n```\n{state.get('status')}\n```")

    if state.get("recent_commits"):
        lines.append(f"\n**Recent commits:**\n```\n{state.get('recent_commits')}\n```")

    # Check if current cwd differs from saved state (drift detection)
    if state.get("cwd") and os.path.realpath(cwd) != os.path.realpath(state.get("cwd")):
        lines.insert(1, "\n**WARNING: You may have drifted!**")
        lines.insert(2, f"- Saved location: `{state.get('cwd')}`")
        lines.insert(3, f"- Current location: `{cwd}`")
        lines.insert(4, f"- Consider: `cd {state.get('cwd')}`\n")

    context = "\n".join(lines)

    # Output JSON with additionalContext
    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }
    print(json.dumps(output))  # noqa: T201 - hooks communicate via stdout

    sys.exit(0)


if __name__ == "__main__":
    main()
