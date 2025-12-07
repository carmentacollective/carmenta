# Code Execution

Sandboxed Python execution that transforms the agent from conversationalist to
computational partner. Instead of approximating math or describing data analysis, the
agent writes and runs real code.

## Why This Exists

LLMs are excellent at writing code. They're terrible at being calculators. When asked to
compute `1847 * 0.0725`, an LLM pattern-matches toward plausible numbers rather than
calculating. When analyzing a CSV, it hallucinates statistics instead of computing them.

The fix isn't better prompting - it's giving the LLM what it's good at (code generation)
and letting actual computation happen elsewhere. One code execution tool replaces dozens
of purpose-built tools:

- Calculator? Python does math.
- CSV analysis? Pandas loads the file.
- Data visualization? Matplotlib renders charts.
- Statistical analysis? NumPy/SciPy compute real statistics.
- JSON transformation? Python manipulates data structures.

This is the "code interpreter" pattern that ChatGPT popularized, but implemented as a
first-class tool in Carmenta's architecture.

## Core Functions

### Execute Python Code

The agent writes Python, we execute it, results return to the conversation:

```python
import pandas as pd
df = pd.DataFrame({'revenue': [1200, 1800, 2400], 'month': ['Jan', 'Feb', 'Mar']})
print(f"Total revenue: ${df['revenue'].sum():,}")
print(f"Average: ${df['revenue'].mean():,.2f}")
```

Output appears naturally in conversation. No special syntax, no explicit tool
invocation - the agent decides when computation serves the task.

### Stateful Sessions

State persists across conversation turns within a session:

**Turn 1**: "Load this CSV and show me the columns"

```python
df = pd.read_csv('/data/sales.csv')
print(df.columns.tolist())
```

**Turn 2**: "Filter for sales over 1000"

```python
filtered = df[df['amount'] > 1000]
print(f"Found {len(filtered)} records")
```

The same `df` is available. No re-loading, no context loss. This enables iterative data
exploration workflows.

### File Input/Output

Users can provide data files that become available to code:

- Upload CSV, JSON, Excel files
- Files mount to virtual filesystem accessible from Python
- Generated files (reports, exports) can be returned to user

### Artifact Generation

Code can produce visual artifacts:

- Matplotlib/Seaborn charts render as images in conversation
- Generated files (CSV exports, reports) available for download
- Structured output (JSON, tables) formatted appropriately

## Technical Architecture

### Infrastructure Context

Carmenta currently runs on Render.com. Render services run inside containers but cannot
spawn additional containers (no Docker-in-Docker), which limits our options.

However, **Fly.io** is a compelling alternative that would unlock more powerful
approaches. The infrastructure decision affects which code execution paths are viable:

| Platform   | Docker-in-Docker | Ephemeral VMs | Implications                      |
| ---------- | ---------------- | ------------- | --------------------------------- |
| Render.com | No               | No            | E2B, Pyodide, or Terrarium only   |
| Fly.io     | Yes (Machines)   | Yes           | Full Docker, DIY E2B, llm-sandbox |

Three paths forward: **stay on Render with constraints**, **migrate to Fly.io**, or
**use managed services regardless of platform**.

### Option A: E2B (Managed Service) - Recommended for MVP

[E2B](https://e2b.dev/) provides sandboxed execution as an API. No infrastructure to
manage - just HTTP calls to their service.

**Why E2B:**

- Firecracker microVMs, ~150ms cold start
- Full Python ecosystem (numpy, pandas, matplotlib, etc.)
- Stateful sessions - state persists across calls
- Used by Groq, ~50% of Fortune 500
- Simple SDK integration

**Integration:**

```typescript
import { Sandbox } from "@e2b/code-interpreter";

const sandbox = await Sandbox.create();
await sandbox.runCode("import pandas as pd");
await sandbox.runCode("df = pd.read_csv('/data/sales.csv')");
const result = await sandbox.runCode("print(df.describe())");
console.log(result.text);
```

**Tradeoffs:**

- Pricing: $150/mo base + usage (can escalate with heavy use)
- Data leaves our infrastructure (security/privacy consideration)
- Vendor dependency

### Option B: Pyodide (WebAssembly) - Privacy-First Alternative

[Pyodide](https://pyodide.org/) runs CPython compiled to WebAssembly. Executes in the
browser or in a Node.js service - no container spawning required.

**Why Pyodide:**

- Zero external dependencies - runs in-process
- User data never leaves their machine (browser) or our infrastructure (server)
- WASM sandbox provides memory isolation
- Works on Render as a regular service

**Integration (server-side):**

```typescript
import { loadPyodide } from "pyodide";

const pyodide = await loadPyodide();
await pyodide.loadPackage(["numpy", "pandas"]);

const result = await pyodide.runPythonAsync(`
import pandas as pd
df = pd.DataFrame({'a': [1, 2, 3]})
df.describe().to_dict()
`);
```

**Tradeoffs:**

- ~10MB runtime download (cacheable)
- Limited packages (pre-built WASM versions only)
- No network access from Python
- No real filesystem (virtual FS only)
- 2-3x slower than native Python

### Option C: Cohere Terrarium - Hybrid Approach

[Terrarium](https://github.com/cohere-ai/cohere-terrarium) wraps Pyodide in an HTTP
service. Deploy as a Render private service, call from main app.

- Pyodide execution with HTTP API
- ~900ms for matplotlib charts
- ~$30/mo hosting cost
- No Docker-in-Docker needed

### Option D: Fly.io Machines - DIY E2B

[Fly Machines](https://fly.io/docs/machines/) are Firecracker VMs controllable via REST
API. This is the same underlying technology E2B uses, but self-managed.

**Why Fly.io:**

- Firecracker VMs with ~300ms boot time
- Spawn ephemeral machines per execution via REST API
- Pay only for running time (~$0.0000022/s for shared CPU)
- No $150/mo base cost - pure usage-based
- Full Docker support - llm-sandbox works here
- 35+ global regions
- Data stays in our infrastructure

**Architecture:**

```
┌──────────────────────────────────────────────────────────┐
│  Fly.io Private Network                                  │
│                                                          │
│  ┌─────────────────┐      ┌─────────────────────────┐   │
│  │  Carmenta App   │─────▶│  Sandbox Machine        │   │
│  │  (always-on)    │ API  │  (ephemeral)            │   │
│  │                 │      │                         │   │
│  │  Next.js        │      │  Python + llm-sandbox   │   │
│  └─────────────────┘      │  Spawned per session    │   │
│                           │  Auto-stops when idle   │   │
│                           └─────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Integration:**

```bash
# Spawn a sandbox machine
curl -X POST \
  -H "Authorization: Bearer ${FLY_API_TOKEN}" \
  "https://api.machines.dev/v1/apps/carmenta-sandbox/machines" \
  -d '{
    "config": {
      "image": "carmenta/python-sandbox:latest",
      "auto_destroy": true,
      "restart": { "policy": "no" }
    }
  }'
```

**Tradeoffs:**

- Requires migrating from Render to Fly.io
- More infrastructure to manage (but not much - Fly handles orchestration)
- CLI-first workflow vs Render's git-push deploys
- Learning curve for team

**What this unlocks:**

With Fly.io, these Docker-based solutions become viable:

- **[llm-sandbox](https://github.com/vndee/llm-sandbox)**: Best DX, stateful sessions,
  multi-language, MCP support built-in
- **[DifySandbox](https://dify.ai/blog/difysandbox-goes-open-source-secure-execution-of-code)**:
  Syscall whitelisting, enterprise-focused
- **[Code Sandbox MCP](https://www.philschmid.de/code-sandbox-mcp)**: Purpose-built MCP
  server

The Fly.io path gives us E2B-level capability without the $150/mo base cost or vendor
lock-in.

### Security Model

Code execution is inherently risky. Our approach varies by implementation:

**E2B:** Firecracker microVMs provide hardware-level isolation. Each execution runs in
an ephemeral VM. E2B handles security - we trust their infrastructure.

**Fly.io Machines:** Same Firecracker isolation as E2B, but we manage it. Each sandbox
runs in its own VM, destroyed after use. Fly's docs explicitly state support for running
"the most awful, buggy, and downright hostile user code" safely.

**Pyodide/Terrarium:** WASM sandbox provides memory isolation. No filesystem access, no
network access, no system calls. Resource limits (CPU, memory, time) prevent runaway
code.

**Timeout Enforcement:** All executions have a maximum runtime (default 30s,
configurable). Infinite loops get killed, not the conversation.

**No Persistent State Across Sessions:** While state persists within a conversation,
each new conversation starts fresh. No cross-user contamination, no accumulated risk.

**Package Allowlist:** Pre-installed packages (numpy, pandas, matplotlib, etc.) are
trusted. Dynamic package installation is either disabled or restricted to a curated
list.

**No Network Access:** By default, Python code cannot make HTTP requests or access
external services. This prevents data exfiltration and limits attack surface.

## Integration Points

- **External Tools**: Code execution appears as a tool Carmenta can invoke naturally
- **File Attachments**: Uploaded files become accessible to code
- **Artifacts**: Generated visualizations integrate with artifact system
- **Concierge**: Routes computational requests to code execution appropriately
- **Memory**: Execution patterns and preferences inform future sessions

## User Experience

### Invisible When Working

Users don't see "invoking Python sandbox." They ask a question, Carmenta decides code
execution is the right approach, runs it, and presents results naturally:

> "What's the average of these numbers: 847, 923, 756, 1102, 889?"
>
> The average is 903.4.

Underneath, Python computed `sum([847, 923, 756, 1102, 889]) / 5`. The user doesn't need
to know.

### Visible When Relevant

For data analysis workflows, showing the code adds value:

> "Analyze the sales data I uploaded"
>
> Here's what I found:
>
> ```python
> df = pd.read_csv('/data/sales.csv')
> print(f"Total records: {len(df)}")
> print(f"Revenue range: ${df['amount'].min()} - ${df['amount'].max()}")
> ```
>
> **Results:**
>
> - Total records: 1,247
> - Revenue range: $12 - $8,450
> - [Chart showing monthly trends]

The code is transparent - users can verify, learn, or adapt it.

### Error Handling

When code fails, we communicate clearly:

**Syntax error**: "I made a mistake in the code. Let me fix that..."

**Runtime error**: "The code ran into an issue - it looks like the 'date' column doesn't
exist in this file. Let me check the actual column names..."

**Timeout**: "That computation is taking too long. Let me try a more efficient
approach..."

Errors become conversation, not dead ends.

## Success Criteria

- Agent can perform accurate calculations without hallucination
- Data analysis on user-provided files produces correct results
- Visualizations render cleanly in conversation
- State persists across turns within a session
- Execution completes in under 5 seconds for typical operations
- Security: no container escapes, no data leakage, no resource exhaustion
- Graceful degradation when execution fails

---

## Open Questions

### Architecture

- **Platform decision**: Stay on Render (constrained options) or migrate to Fly.io
  (unlocks Docker-based solutions)? This is the key infrastructure question.
- **If Fly.io**: Build on llm-sandbox + Fly Machines, or use E2B anyway for simplicity?
- **If Render**: E2B ($150/mo) vs Pyodide (free but limited) - which tradeoff fits?
- **Session lifecycle**: How long do sessions persist? Per-conversation? Timed expiry?
  Cost implications vary by platform.
- **Package management**: E2B/Fly have full PyPI. Pyodide has ~200 pre-built packages.
  Is that enough for our use cases?

### Product Decisions

- **Visibility of code**: Always show code? Collapsible? Only on request? Does this vary
  by user preference or context?
- **Execution limits per tier**: Do free users get fewer executions? Shorter timeouts?
  What's the cost model?
- **File size limits**: Max upload size for data files? Max output file size?
- **Collaboration**: Can shared conversations include code execution? Security
  implications of running code in shared contexts?

### Technical Specifications Needed

- Sandbox API contract (input/output schemas)
- Artifact extraction and delivery mechanism (especially for charts/images)
- Timeout and resource limit configuration
- File upload flow (user file → sandbox virtual filesystem)
- MCP tool definition for code_execution
- Error handling and retry patterns

### Research Needed

- **Fly.io migration scope**: What's involved in moving from Render? Database, env vars,
  CI/CD, DNS, etc. Is this a weekend or a month?
- **Fly.io Machines patterns**: Best practices for ephemeral sandbox VMs. Session
  pooling? Pre-warmed machines? Cost optimization?
- **E2B pricing deep-dive**: What does realistic usage actually cost?
- **Pyodide package coverage**: Do we have what we need for data analysis workflows?
- **Performance benchmarking**: Pyodide vs E2B vs Fly Machines for typical operations
- **User research**: How do people want to interact with code execution?

---

## Landscape Context

### Platform Comparison

| Platform                  | Code Execution Options                   | Migration Effort |
| ------------------------- | ---------------------------------------- | ---------------- |
| Render.com (current)      | E2B, Pyodide, Terrarium only             | N/A              |
| [Fly.io](https://fly.io/) | All options including Docker/llm-sandbox | Medium           |
| Dedicated VM              | All options                              | High             |

### Execution Options Comparison

| Option                                                     | Architecture | Cost        | Capability    | Platform Req |
| ---------------------------------------------------------- | ------------ | ----------- | ------------- | ------------ |
| [E2B](https://e2b.dev/)                                    | Firecracker  | $150/mo+    | Full Python   | Any          |
| [Fly Machines](https://fly.io/docs/machines/)              | Firecracker  | Usage-based | Full Python   | Fly.io       |
| [llm-sandbox](https://github.com/vndee/llm-sandbox)        | Docker       | Self-hosted | Full Python   | Fly.io/VM    |
| [Pyodide](https://pyodide.org/)                            | WASM         | Free        | ~200 packages | Any          |
| [Terrarium](https://github.com/cohere-ai/cohere-terrarium) | Pyodide+HTTP | ~$30/mo     | ~200 packages | Any          |

### Decision Context

**The key question is platform, not execution engine.**

If we stay on Render: E2B ($150/mo) or Pyodide (limited). Both work, both have
tradeoffs.

If we migrate to Fly.io: We get E2B-equivalent capability (Firecracker VMs) without the
$150/mo base cost. Fly Machines + llm-sandbox gives us full control, usage-based
pricing, and data stays in our infrastructure.

Fly.io has a steeper learning curve (CLI-first, more config) but unlocks the most
capable and cost-effective path for code execution. The platform decision cascades into
everything else.
