# Dev Mode

Code in Carmenta instead of switching to external tools. Full development environment
capabilities through the chat interface - file operations, shell execution, codebase
understanding. Initially a dev-only feature for dogfooding; may evolve into a product
capability.

## Why This Exists

Nick codes with Claude Code many hours daily. Switching between Carmenta and terminal
fragments the experience. If Carmenta had development capabilities, we could:

- Dogfood Carmenta by building Carmenta in Carmenta
- Find and fix issues through daily use
- Build the "coding in conversation" paradigm that rivals purpose-built tools
- Eventually offer this capability to other builders

The thesis: Claude Agent SDK provides the same primitives as Claude Code. Carmenta can
provide the UX layer - voice, visual diffs, persistent memory, workspace context - that
a CLI cannot.

## Core Functions

### Agent Session Management

Wrap Claude Agent SDK to provide development capabilities:

- Spawn agent sessions tied to workspaces
- Resume sessions across conversations (via `session_id`)
- Stream tool execution results to the UI in real-time
- Handle all Claude Code tools: Read, Edit, Write, Bash, Glob, Grep

### Workspace Concept

Each project becomes a "workspace" in Carmenta:

- Workspace = project directory + agent session + persistent context
- Opening a workspace resumes the agent session with full history
- Workspace remembers: files analyzed, patterns learned, decisions made
- Natural language interaction with codebase context

### Visual Development Feedback

Show what the agent is doing:

- Inline diff viewer when files are edited
- Terminal output panel for Bash commands
- File tree with git status indicators (future)
- Activity feed: "Reading src/...", "Editing...", "Running tests..."

### Voice-First Development

Leverage existing voice capabilities for coding:

- Describe changes verbally, see diffs visually
- Approve/reject with voice or simple clicks
- Think out loud while Carmenta explores code
- Perfect for architecture discussions, debugging, exploration

## Integration Points

- **Voice**: Voice input triggers agent prompts; voice for approvals
- **Concierge**: Routes dev-related queries to agent session
- **Memory**: Cross-session memory about codebase patterns, preferences
- **Conversations**: Dev sessions are conversations, searchable and resumable

## Success Criteria

- Nick uses Carmenta as primary development interface for Carmenta work
- Latency feels acceptable compared to Claude Code CLI
- Session context survives across multiple conversations
- Voice + visual feedback feels natural for development tasks
- Issues found through dogfooding get fixed faster

---

## Implementation

### v1: Minimal Viable Dev Mode

**Scope**: Get it working, accept limitations.

**What we build**:

- API route that wraps Claude Agent SDK `query()`
- SSE streaming of agent events to frontend
- Basic chat UI that shows agent tool outputs
- Session ID stored per workspace in database
- Resume capability via `resume: sessionId`

**What we defer**:

- Visual diff viewer (just show text output)
- File tree UI
- Activity feed (just show in chat)
- Reconnection after browser close

**Known limitations (v1)**:

- Browser window must stay open during agent execution
- If browser closes mid-task, session state preserved but in-flight work lost
- No visual diff - just text description of changes
- No proactive notifications

**Architecture**:

```
┌─────────────────────────────────────────────────────┐
│                 CARMENTA FRONTEND                   │
│                                                     │
│  [Chat Input] ──────────────────────────────────    │
│                                                     │
│  [Agent Output Stream]                              │
│  - Tool calls rendered inline                       │
│  - File edits shown as code blocks                  │
│  - Bash output shown in monospace                   │
│                                                     │
└───────────────────────┬─────────────────────────────┘
                        │ SSE
                        ▼
┌─────────────────────────────────────────────────────┐
│                 CARMENTA BACKEND                    │
│                                                     │
│  POST /api/dev/agent                                │
│  - Receives prompt + workspaceId                    │
│  - Gets/creates session from DB                     │
│  - Calls Agent SDK query()                          │
│  - Streams events back via SSE                      │
│                                                     │
│  Database:                                          │
│  - workspaces: { id, path, sessionId, createdAt }   │
│                                                     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              CLAUDE AGENT SDK                       │
│                                                     │
│  - Read, Edit, Write, Bash, Glob, Grep tools        │
│  - Session persistence via session_id               │
│  - Full codebase context                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Backend pseudocode**:

```typescript
// POST /api/dev/agent
export async function POST(req: Request) {
  const { prompt, workspaceId } = await req.json();

  // Get or create workspace session
  let workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    workspace = await db.workspace.create({
      data: { id: workspaceId, path: workspacePath },
    });
  }

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const msg of query({
        prompt,
        options: {
          resume: workspace.sessionId,
          allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
          permissionMode: "acceptEdits",
          cwd: workspace.path,
        },
      })) {
        // Capture session ID on init
        if (msg.type === "system" && msg.subtype === "init") {
          await db.workspace.update({
            where: { id: workspaceId },
            data: { sessionId: msg.session_id },
          });
        }

        // Stream to client
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

### v2: Robustness (Future)

- Event sourcing: persist all agent events to DB
- Reconnection: replay missed events on browser reconnect
- "Completed while away" summary
- Background agent execution survives browser close

### v3: Visual Polish (Future)

- Inline diff viewer component
- File tree with git integration
- Activity feed sidebar
- Quick actions: "Run tests", "Commit", "Create PR"

### v4: Multi-Agent (Future)

- Spawn specialized agents in parallel
- Code agent + test agent + review agent
- Orchestrator coordinates and presents unified view

---

## Open Questions

### Architecture

- **Agent SDK hosting**: Does it need to run where filesystem access exists? Or can it
  connect to remote filesystems via MCP?
- **Session limits**: How long do Agent SDK sessions persist? Storage limits?
- **Concurrent sessions**: Can we have multiple workspaces with active sessions?
- **Working directory**: How to set cwd for agent to operate in correct project?

### Product Decisions

- **Access control**: Dev-only feature flag? Or available to all users eventually?
- **Workspace creation**: Automatic from git repos? Manual setup? Connect to GitHub?
- **Permission model**: Auto-approve edits (like Claude Code)? Or require confirmation?
- **Voice activation**: Special mode for dev? Or just works in any conversation?

### Technical Specifications Needed

- Agent SDK message type definitions for TypeScript
- SSE event format for streaming to frontend
- Database schema for workspaces and sessions
- Frontend components for rendering tool outputs

### Research Needed

- Benchmark Agent SDK latency vs Claude Code CLI
- Test session persistence duration and limits
- Evaluate MCP server options for remote filesystem access
- Study how Cursor/Windsurf handle agent-based development UX
