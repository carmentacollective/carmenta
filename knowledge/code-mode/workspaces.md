# Code Mode Workspace Architecture

How we handle multi-user workspaces for code mode on Render.

## Directory Structure

```
/data/                              # Render persistent disk (10GB)
  workspaces/
    {userEmail}/                    # User-isolated directory (sanitized email)
      {owner}__{repo}/              # Repository workspace (double underscore separator)
        .git/
        ...project files...
```

Each user gets complete isolation via their sanitized email (`nick@example.com` →
`nick_example_com`). The `owner__repo` format uses sanitized names (alphanumeric, dash,
underscore only) with double underscore separator to prevent path traversal and
directory name collisions.

## No Metadata Files

The workspace IS the git repository. All state comes from git:

- Current branch: `git rev-parse --abbrev-ref HEAD`
- Commit SHA: `git rev-parse HEAD`
- Uncommitted changes: `git status --porcelain`
- Owner/repo: Parsed from directory name

This eliminates sync issues between metadata files and actual git state.

## Two Operating Modes

### Workspace Mode (Production)

When `DATA_DIR` is set (on Render), the system uses user-isolated workspaces:

- `discoverUserProjects(userEmail)` - Returns workspaces for that user only
- `validateUserProjectPath(userEmail, path)` - Ensures path is within user's directory
- Repos are cloned via GitHub integration to user's workspace

### Local Mode (Development)

When `DATA_DIR` is not set, falls back to local filesystem scanning:

- `discoverProjects()` - Scans `$HOME/src` or `CODE_SOURCE_DIR`
- `validateProject(path)` - Validates against allowed source directories
- No user isolation (single developer machine)

## Security Model

1. **Email validation**: Must contain `@` before directory creation
2. **Sanitization**: Email converted to safe directory name (`nick@example.com` →
   `nick_example_com`)
3. **Path validation**: Resolved paths must start with
   `/data/workspaces/{sanitizedEmail}/`
4. **Sanitized repo names**: Owner/repo stripped of special chars before path
   construction
5. **Symlink rejection**: `lstat` checks prevent symlink attacks

## Clone Flow (Requires GitHub Integration)

This is implemented separately via GitHub OAuth or GitHub App:

1. User selects repo from connected GitHub account
2. Check if workspace exists for this user/repo
3. If not, clone to `/data/workspaces/{sanitizedEmail}/{owner}__{repo}/`
4. On subsequent access, pull latest (if no uncommitted changes)

## Key Files

- `lib/code/workspaces.ts` - Workspace utilities (paths, git operations)
- `lib/code/projects.ts` - Project discovery (uses workspaces in production)

## Environment Variables

| Variable   | Description          | Example |
| ---------- | -------------------- | ------- |
| `DATA_DIR` | Persistent disk path | `/data` |

## What's Not Implemented Yet

The following require GitHub integration (separate PR):

- [ ] Clone endpoint (`POST /api/workspaces`)
- [ ] Sync endpoint (`POST /api/workspaces/[id]/sync`)
- [ ] GitHub OAuth for repo access
- [ ] Workspace creation flow in UI
