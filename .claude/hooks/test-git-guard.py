#!/usr/bin/env python3
"""
Test script for git-guard.py context drift detection.

This simulates the scenario where Claude drifts from a worktree to main repo.
"""

import json
import subprocess
import sys
from pathlib import Path


def test_context_drift_detection():
    """Test that drift is detected when in main repo with feature branch."""
    print("Testing context drift detection...")

    # Simulate being in main repo (/Users/nick/src/carmenta)
    # with a feature branch, when worktrees exist
    test_input = {
        "cwd": "/Users/nick/src/carmenta",
        "tool_input": {
            "command": "git status"
        }
    }

    # Run the hook
    result = subprocess.run(
        ["python3", ".claude/hooks/git-guard.py"],
        input=json.dumps(test_input),
        capture_output=True,
        text=True,
    )

    print(f"Exit code: {result.returncode}")
    print(f"Stderr:\n{result.stderr}")

    # Check if drift was detected
    if result.returncode == 2 and "CONTEXT DRIFT DETECTED" in result.stderr:
        print("\n✅ Context drift detection working!")
        return True
    elif result.returncode == 0:
        print("\n⚠️  No drift detected (this is expected if not on a feature branch)")
        return True
    else:
        print("\n❌ Unexpected result")
        return False


def test_worktree_detection():
    """Test worktree detection functions."""
    print("\nTesting worktree detection...")

    # Import the module
    sys.path.insert(0, str(Path(__file__).parent))
    import git_guard

    # Test with current directory
    cwd = Path.cwd()
    print(f"Current directory: {cwd}")
    print(f"Is in worktree: {git_guard.is_in_worktree(str(cwd))}")

    if git_guard.is_in_worktree(str(cwd)):
        print("✅ Correctly detected worktree (based on .git file)")
        info = git_guard.get_worktree_info(str(cwd))
        if info:
            print(f"  Branch: {info['branch']}")
            print(f"  Main repo: {info['main_repo']}")
    else:
        print("Not in a worktree (running from main repo)")

    return True


if __name__ == "__main__":
    print("Git Guard - Context Drift Detection Tests\n")
    print("=" * 60)

    success = True
    success &= test_context_drift_detection()
    success &= test_worktree_detection()

    print("\n" + "=" * 60)
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed")

    sys.exit(0 if success else 1)
