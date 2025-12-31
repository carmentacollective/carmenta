# Code Mode Workspace Architecture

How we handle multi-user workspaces for code mode on Render.

## Directory Structure

```
/data/                              # Render persistent disk (10GB)
  workspaces/
    {userId}/                       # User-isolated directory (database UUID)
      {owner}__{repo}/             # Repository workspace (double underscore separator)
        .git/
        .workspace.json            # Metadata
        ...project files...
```

Each user gets complete isolation via their database UUID. The `owner__repo` format uses
sanitized names (alphanumeric, dash, underscore only) with double underscore separator
to prevent path traversal and directory name collisions.

## Two Operating Modes

### Workspace Mode (Production)

When `DATA_DIR` is set (on Render), the system uses user-isolated workspaces:

- `discoverUserProjects(userId)` - Returns workspaces for that user only
- `validateUserProjectPath(userId, path)` - Ensures path is within user's directory
- Repos are cloned via GitHub integration to user's workspace

### Local Mode (Development)

When `DATA_DIR` is not set, falls back to local filesystem scanning:

- `discoverProjects()` - Scans `$HOME/src` or `CODE_SOURCE_DIR`
- `validateProject(path)` - Validates against allowed source directories
- No user isolation (single developer machine)

## Workspace Metadata

Each workspace has a `.workspace.json` file:

```json
{
  "owner": "carmentacollective",
  "repo": "carmenta",
  "fullName": "carmentacollective/carmenta",
  "defaultBranch": "main",
  "currentBranch": "feature/auth",
  "lastAccessedAt": "2024-12-31T...",
  "lastSyncedAt": "2024-12-31T...",
  "createdAt": "2024-12-31T..."
}
```

This enables cleanup decisions without database queries - filesystem is source of truth.

## Security Model

1. **Path construction**: Always built from database-controlled values, never user input
2. **Ownership validation**: Every operation checks
   `workspace.userId === currentUser.id`
3. **Path validation**: Resolved paths must start with `/data/workspaces/{userId}/`
4. **Sanitized names**: Owner/repo stripped of special chars before path construction
5. **Symlink rejection**: `lstat` checks prevent symlink attacks

## Cleanup Strategy

Cron job runs every 6 hours (or triggered manually):

1. Delete workspaces inactive for 7+ days
2. Skip workspaces with uncommitted changes (warn instead)
3. Log freed space

With 10GB disk and 2-5 users, ~2GB soft quota per user. Re-cloning is cheap, so
aggressive cleanup is acceptable.

## Clone Flow (Requires GitHub Integration)

This is implemented separately via GitHub OAuth or GitHub App:

1. User selects repo from connected GitHub account
2. Check if workspace exists for this user/repo
3. If not, clone to `/data/workspaces/{userId}/{owner}_{repo}/`
4. Create `.workspace.json` with metadata
5. On subsequent access, pull latest (if no uncommitted changes)

## Key Files

- `lib/code/workspaces.ts` - Workspace utilities (paths, metadata, cleanup)
- `lib/code/projects.ts` - Project discovery (uses workspaces in production)
- `app/api/cron/cleanup/route.ts` - Cleanup cron endpoint

## Environment Variables

| Variable      | Description               | Example     |
| ------------- | ------------------------- | ----------- |
| `DATA_DIR`    | Persistent disk path      | `/data`     |
| `CRON_SECRET` | Secret for cron endpoints | `secret123` |

## What's Not Implemented Yet

The following require GitHub integration (separate PR):

- [ ] Clone endpoint (`POST /api/workspaces`)
- [ ] Sync endpoint (`POST /api/workspaces/[id]/sync`)
- [ ] GitHub OAuth for repo access
- [ ] Workspace creation flow in UI
