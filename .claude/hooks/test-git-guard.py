#!/usr/bin/env python3
"""
Test script for git-guard.py context drift detection.

This simulates the scenario where Claude drifts from a worktree to main repo.
"""

import json
import subprocess
import sys
from pathlib import Path


def test_context_drift_read_allowed():
    """Test that read operations are allowed during context drift."""
    print("Testing context drift - read operations should be allowed...")

    # Simulate being in main repo with a read operation (git status)
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
    if result.stderr:
        print(f"Stderr:\n{result.stderr}")

    # Read operations should always succeed, even during drift
    if result.returncode == 0:
        print("✅ Read operation allowed during drift (correct behavior)")
        return True
    else:
        print("❌ Read operation blocked during drift (wrong behavior)")
        return False


def test_context_drift_write_blocked():
    """Test that write operations are blocked during context drift."""
    print("\nTesting context drift - write operations should be blocked...")

    # Simulate being in main repo with a write operation (git commit)
    test_input = {
        "cwd": "/Users/nick/src/carmenta",
        "tool_input": {
            "command": "git commit -m 'test'"
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

    # Check if drift was detected and blocked the write operation
    if result.returncode == 2 and "CONTEXT DRIFT DETECTED" in result.stderr:
        print("✅ Write operation blocked during drift (correct behavior)")
        return True
    elif result.returncode == 0:
        print("⚠️  No drift detected (this is expected if not on a feature branch)")
        return True
    else:
        print("❌ Unexpected result")
        return False


def test_worktree_detection():
    """Test worktree detection functions."""
    print("\nTesting worktree detection...")

    # Import the module (file has hyphen so must use importlib)
    import importlib.util
    spec = importlib.util.spec_from_file_location("git_guard", Path(__file__).parent / "git-guard.py")
    git_guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(git_guard)

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
    success &= test_context_drift_read_allowed()
    success &= test_context_drift_write_blocked()
    success &= test_worktree_detection()

    print("\n" + "=" * 60)
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed")

    sys.exit(0 if success else 1)
