#!/usr/bin/env python3
"""
Tests for git-guard.py hook.

Tests the ViolationType separation between hard blocks (exit 2) and
ask-user confirmations (JSON output with permissionDecision: "ask").
"""

import json
import subprocess
import sys
from pathlib import Path


def run_hook(command: str, cwd: str = "/tmp") -> tuple[int, str, str]:
    """Run the git-guard hook with a command and return (exit_code, stdout, stderr)."""
    test_input = {
        "cwd": cwd,
        "tool_input": {"command": command}
    }

    result = subprocess.run(
        ["python3", str(Path(__file__).parent / "git-guard.py")],
        input=json.dumps(test_input),
        capture_output=True,
        text=True,
    )

    return result.returncode, result.stdout, result.stderr


def parse_ask_response(stdout: str) -> dict | None:
    """Parse JSON output from ask-user response."""
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return None


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0

    def check(self, condition: bool, name: str):
        if condition:
            print(f"  ✅ {name}")
            self.passed += 1
        else:
            print(f"  ❌ {name}")
            self.failed += 1


def test_ask_user_violations():
    """Test operations that should trigger UI confirmation (ASK_USER)."""
    print("\n📋 Testing ASK_USER violations (should return JSON with permissionDecision: ask)")
    results = TestResults()

    # git push origin main
    exit_code, stdout, _ = run_hook("git push origin main")
    response = parse_ask_response(stdout)
    results.check(
        exit_code == 0 and response and
        response.get("hookSpecificOutput", {}).get("permissionDecision") == "ask",
        "git push origin main → asks for confirmation"
    )

    # git push origin master
    exit_code, stdout, _ = run_hook("git push origin master")
    response = parse_ask_response(stdout)
    results.check(
        exit_code == 0 and response and
        response.get("hookSpecificOutput", {}).get("permissionDecision") == "ask",
        "git push origin master → asks for confirmation"
    )

    # gh pr merge
    exit_code, stdout, _ = run_hook("gh pr merge 123")
    response = parse_ask_response(stdout)
    results.check(
        exit_code == 0 and response and
        response.get("hookSpecificOutput", {}).get("permissionDecision") == "ask",
        "gh pr merge → asks for confirmation"
    )

    return results


def test_hard_block_violations():
    """Test operations that should be hard blocked (exit 2)."""
    print("\n🚫 Testing HARD_BLOCK violations (should exit 2)")
    results = TestResults()

    # git commit -a
    exit_code, _, stderr = run_hook("git commit -a -m 'test'")
    results.check(
        exit_code == 2 and "git commit -a is forbidden" in stderr,
        "git commit -a → hard blocked"
    )

    # git commit -am (combined flags)
    exit_code, _, stderr = run_hook("git commit -am 'test'")
    results.check(
        exit_code == 2 and "git commit -a is forbidden" in stderr,
        "git commit -am → hard blocked (combined flags)"
    )

    # git push --no-verify
    exit_code, _, stderr = run_hook("git push --no-verify origin feature")
    results.check(
        exit_code == 2 and "git push --no-verify is forbidden" in stderr,
        "git push --no-verify → hard blocked"
    )

    # git commit --no-verify
    exit_code, _, stderr = run_hook("git commit --no-verify -m 'test'")
    results.check(
        exit_code == 2 and "git commit --no-verify is forbidden" in stderr,
        "git commit --no-verify → hard blocked"
    )

    return results


def test_hard_block_priority():
    """Test that hard blocks take priority over ask-user violations."""
    print("\n⚡ Testing hard block priority (hard block wins over ask)")
    results = TestResults()

    # git commit -a --no-verify: both are HARD_BLOCK now
    # Should hard block with -a message (whichever is checked first)
    exit_code, stdout, stderr = run_hook("git commit -a --no-verify -m 'test'")
    results.check(
        exit_code == 2,
        "git commit -a --no-verify → hard blocks"
    )

    # git commit -am --no-verify
    exit_code, stdout, stderr = run_hook("git commit -am --no-verify 'test'")
    results.check(
        exit_code == 2,
        "git commit -am --no-verify → hard blocks"
    )

    # git push --no-verify origin main: both violations are present
    # --no-verify is HARD_BLOCK, push to main is ASK_USER
    # Hard block should win
    exit_code, stdout, stderr = run_hook("git push --no-verify origin main")
    results.check(
        exit_code == 2 and "git push --no-verify is forbidden" in stderr,
        "git push --no-verify origin main → hard blocks (--no-verify wins over main)"
    )

    return results


def test_allowed_operations():
    """Test operations that should be allowed without prompts."""
    print("\n✅ Testing allowed operations (should exit 0, no output)")
    results = TestResults()

    # git push to feature branch
    exit_code, stdout, _ = run_hook("git push origin feature-branch")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git push origin feature-branch → allowed"
    )

    # git commit (normal)
    exit_code, stdout, _ = run_hook("git commit -m 'test'")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git commit -m 'test' → allowed"
    )

    # git commit --amend (should NOT trigger -a check)
    exit_code, stdout, _ = run_hook("git commit --amend -m 'test'")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git commit --amend → allowed (--amend is not -a)"
    )

    # git add specific files
    exit_code, stdout, _ = run_hook("git add src/file.ts")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git add src/file.ts → allowed"
    )

    # git add -A (now allowed)
    exit_code, stdout, _ = run_hook("git add -A")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git add -A → allowed"
    )

    # git add . (now allowed)
    exit_code, stdout, _ = run_hook("git add .")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git add . → allowed"
    )

    # git add --all (now allowed)
    exit_code, stdout, _ = run_hook("git add --all")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git add --all → allowed"
    )

    # git commit -n (dry-run flag, NOT --no-verify)
    exit_code, stdout, _ = run_hook("git commit -n -m 'test'")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git commit -n → allowed (dry-run, not no-verify)"
    )

    # git push -n (dry-run flag, NOT --no-verify)
    exit_code, stdout, _ = run_hook("git push -n origin feature")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git push -n → allowed (dry-run, not no-verify)"
    )

    # git status (read operation)
    exit_code, stdout, _ = run_hook("git status")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git status → allowed"
    )

    # gh pr create (not merge)
    exit_code, stdout, _ = run_hook("gh pr create --title 'test'")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "gh pr create → allowed"
    )

    return results


def test_refspec_detection():
    """Test detection of main branch in refspecs."""
    print("\n🔀 Testing refspec detection")
    results = TestResults()

    # HEAD:main
    exit_code, stdout, _ = run_hook("git push origin HEAD:main")
    response = parse_ask_response(stdout)
    results.check(
        exit_code == 0 and response and
        response.get("hookSpecificOutput", {}).get("permissionDecision") == "ask",
        "git push origin HEAD:main → asks for confirmation"
    )

    # feature:master
    exit_code, stdout, _ = run_hook("git push origin feature:master")
    response = parse_ask_response(stdout)
    results.check(
        exit_code == 0 and response and
        response.get("hookSpecificOutput", {}).get("permissionDecision") == "ask",
        "git push origin feature:master → asks for confirmation"
    )

    # +main (force push)
    exit_code, stdout, _ = run_hook("git push origin +main")
    response = parse_ask_response(stdout)
    results.check(
        exit_code == 0 and response and
        response.get("hookSpecificOutput", {}).get("permissionDecision") == "ask",
        "git push origin +main → asks for confirmation"
    )

    # feature:feature (not main, should be allowed)
    exit_code, stdout, _ = run_hook("git push origin feature:feature")
    results.check(
        exit_code == 0 and not stdout.strip(),
        "git push origin feature:feature → allowed"
    )

    return results


if __name__ == "__main__":
    print("Git Guard Hook Tests")
    print("=" * 60)

    all_results = TestResults()

    for test_fn in [
        test_ask_user_violations,
        test_hard_block_violations,
        test_hard_block_priority,
        test_allowed_operations,
        test_refspec_detection,
    ]:
        results = test_fn()
        all_results.passed += results.passed
        all_results.failed += results.failed

    print("\n" + "=" * 60)
    print(f"Results: {all_results.passed} passed, {all_results.failed} failed")

    if all_results.failed == 0:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed")
        sys.exit(1)
