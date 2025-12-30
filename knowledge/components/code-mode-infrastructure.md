# Code Mode Infrastructure Research

Research into hosting options for running Claude Code SDK for multiple users. This
captures learnings from prototype testing, not decisions.

Related: [God Mode Development](./god-mode-development.md) for the full vision.

## Current State

PR #501 implements code mode for local development - Claude Agent SDK running on the
developer's machine with full filesystem access. Works well for single-user local use.

The question: how do we run this for multiple trusted users?

## Requirements

1. **Claude Code SDK execution** - run the SDK headlessly, stream output
2. **Filesystem access** - SDK needs to read/write files, run bash
3. **Dev servers** - users need to run `pnpm dev` and access it in browser
4. **Session persistence** - come back tomorrow, work is still there
5. **User isolation** - each user's environment is separate

## GitHub Codespaces Exploration (Dec 2024)

Tested with `carmentacollective/carmenta` repo.

### What Works

| Capability               | Status | How                                                              |
| ------------------------ | ------ | ---------------------------------------------------------------- |
| Create/manage codespaces | Works  | `gh codespace create/start/stop`                                 |
| SSH command execution    | Works  | `gh codespace ssh -- "command"`                                  |
| Stream output real-time  | Works  | SSH streams stdout as it arrives, 1-second granularity confirmed |
| Run Claude Code SDK      | Works  | Install globally, runs headless, tools work                      |
| Filesystem persistence   | Works  | Survives stop/start                                              |
| Run dev server           | Works  | Works with nohup/pm2 in background                               |
| Local port tunnel        | Works  | `gh codespace ports forward 3000:3333`                           |

### What Doesn't Work

| Capability                | Status | Blocker                                 |
| ------------------------- | ------ | --------------------------------------- |
| Public dev server URL     | Fails  | Port registration requires VS Code      |
| User browser → dev server | Fails  | No public URL available without VS Code |
| HMR/WebSocket to browser  | Fails  | Same issue                              |

### The Port Forwarding Problem

GitHub Codespaces port forwarding is tightly coupled to VS Code. Ports get "registered"
with GitHub's infrastructure when:

1. VS Code detects a listening port
2. App prints `localhost:PORT` to VS Code's integrated terminal
3. Port defined in `devcontainer.json` with `portsAttributes`

When connecting via SSH (headless), none of these triggers fire. The public URL pattern
`https://{codespace}-{port}.preview.app.github.dev` returns 404 because the port isn't
registered.

This is a known limitation. Feature request for public ports by default has been open
since 2021: https://github.com/orgs/community/discussions/4068

### Workarounds Considered

**Tunnel service inside codespace** - Install cloudflared or ngrok inside the codespace
to create our own tunnel. Would work but adds complexity and the URL changes each time
(unless using paid named tunnels).

**devcontainer.json portsAttributes** - Can pre-configure ports, but still requires VS
Code to activate the forwarding.

**GITHUB_TOKEN header** - Can access private ports with auth header, but port must be
registered first.

### Codespaces Verdict

If dev servers weren't required, Codespaces would work today. The streaming architecture
from PR #501 could work almost unchanged - just swap "local SDK" for "SSH to codespace,
run SDK there."

Dev server requirement kills it unless we add tunnel complexity.

## Other Options Evaluated

### Fly.io / Railway / Render (Container Platforms)

Persistent volumes + containers. Could work but similar port exposure challenges:

- User runs dev server inside container
- How does their browser reach it?
- Need dynamic subdomains or tunnel service
- Per-user isolation adds complexity

### Gitpod / Ona

Gitpod rebranded to Ona, pivoting to "mission control for software engineering agents" -
philosophically aligned. But in transition period (classic sunsets Oct 2025) and likely
has similar port forwarding constraints.

### Shared VPS

Single server, user directories, direct port access. Simplest for small group of trusted
users:

- No per-request infrastructure management
- Direct port exposure (nginx proxy per user)
- ~$20/mo flat vs pay-per-hour
- Full control over environment

Tradeoff: Less isolation between users (trust required).

### AWS / Cloud VMs

Similar to shared VPS but could scale to per-user VMs if needed. More operational
overhead but full control.

## Cost Comparison

| Option            | Cost Model                  | Estimate (10 users, moderate use) |
| ----------------- | --------------------------- | --------------------------------- |
| GitHub Codespaces | $0.18+/hr compute + storage | ~$200-400/mo                      |
| Fly.io            | Per-container + volume      | ~$50-150/mo                       |
| Shared VPS        | Flat monthly                | ~$20-40/mo                        |
| Per-user VMs      | Per VM                      | ~$50-200/mo                       |

## Open Questions

- Can tunnel services (cloudflared) provide stable enough URLs for dev server access?
- Is the port forwarding limitation fixable with VS Code Server running headless?
- Would AWS App Runner or similar managed container services handle this better?
- Is per-user VM isolation worth the cost/complexity for trusted users?

## Current Plan

1. **Now**: Continue local dev mode (PR #501) - works for Nick
2. **Next**: Evaluate AWS/VPS for small trusted user group
3. **Later**: Revisit managed solutions as they evolve

This is research, not a decision. Infrastructure choice depends on actual user needs and
scale.
