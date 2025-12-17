---
description: Clean up a git worktree after its PR has been merged
model: haiku
---

# Cleanup Git Worktree

Clean up a git worktree directory after its PR has been merged to main.

Verify the branch was merged before deleting anything. Pull main in the primary repo to
get the latest state, then confirm the worktree's branch appears in the merged history.

If merged: remove the worktree directory, navigate back to the primary repo. Do NOT
delete branches - keep both local and remote branches intact.

If not merged: stop and explain. Never delete unmerged work.

The current working directory may be inside the worktree being cleaned up. Handle this
by changing to the primary repo first.

Primary repo location: the parent directory that contains this worktree as a sibling, or
use git worktree list to find it.

Success looks like: worktree directory gone, branches preserved (both local and remote),
back in the primary repo on main with latest changes.

Celebrate with some congratulatory language and a compliment for the work that was done
