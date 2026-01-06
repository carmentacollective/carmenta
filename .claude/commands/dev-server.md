---
# prettier-ignore
description: Start a fresh Next.js dev server with intelligent state management - handles port detection, cleanup, and optional browser opening
argument-hint: [open]
version: 0.2.0
model: haiku
---

# Dev Server

Start or restart the Next.js development server with a clean state. Handles port
detection, pre-warming, and optional browser opening.

<usage>
`/dev-server` - Clean restart, pre-warm homepage, report URL
`/dev-server open` - Clean restart, open Playwright browser to homepage
</usage>

<execution>

## Step 1: Clean State

Check if `.next` is locked by a running process. If locked, Step 2 will handle killing
our dev server first. Then remove stale build artifacts:

```bash
rm -rf .next
```

This ensures no cached compilation issues. Every dev server start is clean.

## Step 2: Kill Only OUR Dev Server

Find dev servers on common ports and check their working directory:

```bash
lsof -i :3000-3010 -P 2>/dev/null | grep -E "LISTEN" | awk '{print $2}' | sort -u | while read pid; do
  cwd=$(lsof -p "$pid" 2>/dev/null | grep cwd | awk '{print $NF}')
  echo "PID $pid: $cwd"
done
```

For each process found, compare its working directory to the current repo. Only kill
processes whose `cwd` matches `$(pwd)`. If a process is for a different directory (e.g.,
carmenta-mobile vs carmenta), leave it alone and let Next.js auto-pick the next
available port.

Never kill processes for other directories. If unsure, skip killing and start fresh.

## Step 3: Start Fresh

Run the dev server in background:

```bash
pnpm dev &
```

Next.js will automatically use port 3000, or 3001, 3002... if 3000 is taken.

## Step 4: Wait for Ready

Watch the output for the "Ready" message. Don't report until actually ready:

```
▲ Next.js 14.x.x
- Local: http://localhost:3001
✓ Ready in Xms
```

Extract the actual port from the "Local:" line. This is the URL to report.

## Step 5: Pre-warm or Open

**If no "open" argument:** Fetch the homepage to trigger compilation. This makes the
first real browser load faster:

```bash
curl -s http://localhost:${PORT}/ > /dev/null
```

**If "open" argument provided:** Use Playwright to open the browser:

```javascript
// Use mcp__playwright__browser_navigate to open the URL
```

Take a snapshot to confirm it loaded.

## Step 6: Report

Output the result clearly:

```
Dev server ready on http://localhost:3001
Homepage pre-warmed (compiled)
```

Or if browser opened:

```
Dev server ready on http://localhost:3001
Opened in browser
```

</execution>

<smart-behaviors>

**Dependency Check** If `node_modules` doesn't exist or `package.json` is newer than
`node_modules`, run `pnpm install` first.

**TypeScript Errors** If the build shows TS errors, report them clearly with file and
line numbers. Don't just say "failed."

**Port Exhaustion** If ports 3000-3010 are all taken by OTHER projects (not ours),
report this clearly rather than killing random processes.

</smart-behaviors>

<never>
- Kill dev servers for other directories/projects
- Assume port 3000 is available
- Report "started" before seeing "Ready"
- Leave the user guessing what port
- Block the terminal indefinitely
</never>

<output-format>
Always include:
1. The actual URL with port: `http://localhost:3001`
2. What was cleaned: `.next removed`
3. Ready status: `compiled and ready` or `homepage pre-warmed`
4. If browser opened: confirmation with snapshot
</output-format>
