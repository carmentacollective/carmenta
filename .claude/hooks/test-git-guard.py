#!/usr/bin/env python3
"""
Tests for git-guard.py hook.

Tests the ViolationType separation between:
- HARD_BLOCK: Always exit 2, never bypassable
- NEEDS_CONFIRMATION: Exit 2 unless I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes prefix is present
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


def test_needs_confirmation_blocked():
    """Test operations that need confirmation are BLOCKED without flag."""
    print("\n🚫 Testing NEEDS_CONFIRMATION violations (should exit 2 without flag)")
    results = TestResults()

    # git push origin main - blocked
    exit_code, stdout, stderr = run_hook("git push origin main")
    results.check(
        exit_code == 2 and "BLOCKED" in stderr,
        "git push origin main → blocked without confirmation"
    )

    # git push origin master - blocked
    exit_code, stdout, stderr = run_hook("git push origin master")
    results.check(
        exit_code == 2 and "BLOCKED" in stderr,
        "git push origin master → blocked without confirmation"
    )

    # gh pr merge - blocked
    exit_code, stdout, stderr = run_hook("gh pr merge 123")
    results.check(
        exit_code == 2 and "BLOCKED" in stderr,
        "gh pr merge → blocked without confirmation"
    )

    return results


def test_confirmed_operations():
    """Test that I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes bypasses NEEDS_CONFIRMATION blocks."""
    print("\n✅ Testing I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes bypass (should exit 0)")
    results = TestResults()

    # git push origin main with confirmation
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin main")
    results.check(
        exit_code == 0 and not stderr.strip(),
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin main → allowed"
    )

    # git push origin master with confirmation
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin master")
    results.check(
        exit_code == 0 and not stderr.strip(),
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin master → allowed"
    )

    # gh pr merge with confirmation
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes gh pr merge 123")
    results.check(
        exit_code == 0 and not stderr.strip(),
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes gh pr merge → allowed"
    )

    # Refspec with confirmation
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin HEAD:main")
    results.check(
        exit_code == 0 and not stderr.strip(),
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin HEAD:main → allowed"
    )

    return results


def test_confirmation_does_not_bypass_hard_blocks():
    """Test that I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes does NOT bypass HARD_BLOCK violations."""
    print("\n🔒 Testing that confirmation doesn't bypass hard blocks")
    results = TestResults()

    # git commit -a with confirmation - still blocked
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git commit -a -m 'test'")
    results.check(
        exit_code == 2 and "git commit -a is forbidden" in stderr,
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git commit -a → still hard blocked"
    )

    # git push --no-verify with confirmation - still blocked
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push --no-verify origin main")
    results.check(
        exit_code == 2 and "git push --no-verify is forbidden" in stderr,
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push --no-verify → still hard blocked"
    )

    # git commit --no-verify with confirmation - still blocked
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git commit --no-verify -m 'test'")
    results.check(
        exit_code == 2 and "git commit --no-verify is forbidden" in stderr,
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git commit --no-verify → still hard blocked"
    )

    return results


def test_hard_block_violations():
    """Test operations that should be hard blocked (exit 2)."""
    print("\n🚫 Testing HARD_BLOCK violations (should exit 2, never bypassable)")
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
    """Test that hard blocks take priority over needs-confirmation violations."""
    print("\n⚡ Testing hard block priority (hard block wins over needs-confirmation)")
    results = TestResults()

    # git commit -a --no-verify: both are HARD_BLOCK
    exit_code, stdout, stderr = run_hook("git commit -a --no-verify -m 'test'")
    results.check(
        exit_code == 2 and "forbidden" in stderr,
        "git commit -a --no-verify → hard blocks"
    )

    # git push --no-verify origin main: HARD_BLOCK + NEEDS_CONFIRMATION
    # Hard block should win
    exit_code, stdout, stderr = run_hook("git push --no-verify origin main")
    results.check(
        exit_code == 2 and "git push --no-verify is forbidden" in stderr,
        "git push --no-verify origin main → hard blocks (--no-verify wins)"
    )

    # Even with confirmation, hard block still wins
    exit_code, stdout, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push --no-verify origin main")
    results.check(
        exit_code == 2 and "git push --no-verify is forbidden" in stderr,
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push --no-verify → still hard blocked"
    )

    return results


def test_allowed_operations():
    """Test operations that should be allowed without prompts."""
    print("\n✅ Testing allowed operations (should exit 0, no output)")
    results = TestResults()

    # git push to feature branch
    exit_code, stdout, stderr = run_hook("git push origin feature-branch")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git push origin feature-branch → allowed"
    )

    # git commit (normal)
    exit_code, stdout, stderr = run_hook("git commit -m 'test'")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git commit -m 'test' → allowed"
    )

    # git commit --amend (should NOT trigger -a check)
    exit_code, stdout, stderr = run_hook("git commit --amend -m 'test'")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git commit --amend → allowed (--amend is not -a)"
    )

    # git add specific files
    exit_code, stdout, stderr = run_hook("git add src/file.ts")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git add src/file.ts → allowed"
    )

    # git add -A (allowed)
    exit_code, stdout, stderr = run_hook("git add -A")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git add -A → allowed"
    )

    # git add . (allowed)
    exit_code, stdout, stderr = run_hook("git add .")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git add . → allowed"
    )

    # git add --all (allowed)
    exit_code, stdout, stderr = run_hook("git add --all")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git add --all → allowed"
    )

    # git commit -n (dry-run flag, NOT --no-verify)
    exit_code, stdout, stderr = run_hook("git commit -n -m 'test'")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git commit -n → allowed (dry-run, not no-verify)"
    )

    # git push -n (dry-run flag, NOT --no-verify)
    exit_code, stdout, stderr = run_hook("git push -n origin feature")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git push -n → allowed (dry-run, not no-verify)"
    )

    # git status (read operation)
    exit_code, stdout, stderr = run_hook("git status")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git status → allowed"
    )

    # gh pr create (not merge)
    exit_code, stdout, stderr = run_hook("gh pr create --title 'test'")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "gh pr create → allowed"
    )

    return results


def test_refspec_detection():
    """Test detection of main branch in refspecs (blocked without confirmation)."""
    print("\n🔀 Testing refspec detection (blocked without confirmation)")
    results = TestResults()

    # HEAD:main - blocked
    exit_code, stdout, stderr = run_hook("git push origin HEAD:main")
    results.check(
        exit_code == 2 and "BLOCKED" in stderr,
        "git push origin HEAD:main → blocked without confirmation"
    )

    # feature:master - blocked
    exit_code, stdout, stderr = run_hook("git push origin feature:master")
    results.check(
        exit_code == 2 and "BLOCKED" in stderr,
        "git push origin feature:master → blocked without confirmation"
    )

    # +main (force push) - blocked
    exit_code, stdout, stderr = run_hook("git push origin +main")
    results.check(
        exit_code == 2 and "BLOCKED" in stderr,
        "git push origin +main → blocked without confirmation"
    )

    # feature:feature (not main, should be allowed)
    exit_code, stdout, stderr = run_hook("git push origin feature:feature")
    results.check(
        exit_code == 0 and not stdout.strip() and not stderr.strip(),
        "git push origin feature:feature → allowed"
    )

    return results


def test_confirmation_flag_parsing():
    """Test various formats of the confirmation flag."""
    print("\n🔧 Testing confirmation flag parsing")
    results = TestResults()

    # Standard format
    exit_code, _, _ = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin main")
    results.check(exit_code == 0, "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin main → allowed")

    # Wrong value (should not work)
    exit_code, _, stderr = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=no git push origin main")
    results.check(
        exit_code == 2,
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=no git push origin main → blocked (wrong value)"
    )

    # Other env var (should not work)
    exit_code, _, stderr = run_hook("OTHER_VAR=1 git push origin main")
    results.check(
        exit_code == 2,
        "OTHER_VAR=1 git push origin main → blocked (wrong var)"
    )

    # Flag in wrong position - git parses this as subcommand "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes"
    # which is invalid and will fail anyway. Hook allows it through (not a push to main).
    exit_code, _, stderr = run_hook("git I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes push origin main")
    results.check(
        exit_code == 0,
        "git I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes push ... → allowed (malformed, git will reject)"
    )

    # Multiple env vars with confirmation first
    exit_code, _, _ = run_hook("I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes FOO=bar git push origin main")
    results.check(
        exit_code == 0,
        "I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes FOO=bar git push origin main → allowed"
    )

    # cd && ... prefix (common for worktrees)
    exit_code, _, _ = run_hook("cd /repo && I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin main")
    results.check(
        exit_code == 0,
        "cd /repo && I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin main → allowed"
    )

    # Confirmation after command separator
    exit_code, _, _ = run_hook("cd /tmp ; I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push origin master")
    results.check(
        exit_code == 0,
        "cd /tmp ; I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes git push → allowed (semicolon separator)"
    )

    # Security test: flag AFTER command (suffix bypass attempt) should be blocked
    exit_code, _, stderr = run_hook("gh pr merge 123 I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes")
    results.check(
        exit_code == 2,
        "gh pr merge 123 I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes → blocked (suffix bypass attempt)"
    )

    # Same for git
    exit_code, _, stderr = run_hook("git push origin main I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes")
    results.check(
        exit_code == 2,
        "git push origin main I_FOLLOWED_THE_INSTRUCTIONS_ABOUT_PUSHING_TO_MAIN_AND_I_HAVE_PERMISSION=yes → blocked (suffix bypass attempt)"
    )

    return results


if __name__ == "__main__":
    print("Git Guard Hook Tests")
    print("=" * 60)

    all_results = TestResults()

    for test_fn in [
        test_needs_confirmation_blocked,
        test_confirmed_operations,
        test_confirmation_does_not_bypass_hard_blocks,
        test_hard_block_violations,
        test_hard_block_priority,
        test_allowed_operations,
        test_refspec_detection,
        test_confirmation_flag_parsing,
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
