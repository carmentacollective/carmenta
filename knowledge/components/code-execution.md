# Code Execution

Sandboxed code execution that transforms Carmenta from conversationalist to
computational partner. Instead of approximating math or describing data analysis, we
write and run real code - and for web development, see our creations live instantly.

**Infrastructure**: Code execution runs on the
[ephemeral compute](./ephemeral-compute.md) layer - the same infrastructure that powers
scheduled agents and powerhouse mode.

---

## Vision

### Underlying Need

**Immediate verification of ideas.** When we're building something - whether it's a data
analysis, a visualization, or a web component - we need to see it work. The gap between
"here's code" and "here's the running result" is where friction lives, context gets
lost, and flow breaks.

### The Ideal

**Ideas become reality instantly.** We describe what we want. It appears - running,
interactive, explorable. Python computes real numbers and renders real charts. React
components render in a live preview. We iterate by talking: "make the bars blue," "add a
trendline," "handle the edge case where the array is empty." Each change is immediate.
The code is there when we want to learn from it, invisible when we don't.

No copy-pasting. No setting up environments. No "here's the code, go run it somewhere."
Creation happens in flow.

### Core Insight

**Current interfaces separate creation from verification.** Claude writes code, ChatGPT
renders artifacts - but even the best implementations treat "show me the code" and "show
me it working" as separate concerns. The ideal unifies them: execution is embedded in
the creation flow, verification is instantaneous, iteration is conversational.

The deeper insight: code execution isn't about "running Python." It's about closing the
loop between intention and reality. When the loop is tight enough, creation becomes
play.

---

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
- React components? Sandpack renders them live.

This is the "code interpreter" pattern that ChatGPT popularized, plus the "artifacts"
pattern that Claude pioneered - unified into Carmenta's architecture.

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

---

## Landscape Analysis (December 2025)

### What Leaders Do Today

#### ChatGPT Advanced Data Analysis (Code Interpreter)

The pattern that defined this category. Each conversation spins up a private,
internet-blocked container with Python 3.11, pandas, NumPy, SciPy, scikit-learn,
matplotlib. The sandbox lasts for the whole conversation and stores files in a shared
folder users can download from.

**Strengths:**

- Seamless integration - users don't think about "the sandbox," they just ask questions
- Files persist across turns within a conversation
- Full scientific Python stack pre-installed
- Charts and visualizations render inline
- Data never leaves the sandbox (no network egress)

**Limitations:**

- No internet access from code (can't fetch live data)
- Can't install additional packages
- No GPU for heavy ML workloads
- Container expires after conversation ends
- 2-minute timeout on computations

**Architecture:** Private containers with CPython 3.11, curated package list, TLS
encryption in transit, hourly scrubbing of expired containers.

#### Claude Artifacts

Pioneered the "live preview" pattern for web content. When Claude generates HTML, React,
SVG, or Mermaid diagrams, they render in a side panel instantly. Users can interact with
generated UIs, iterate through conversation, and share artifacts independently.

**Key Innovation:** AI-generated interfaces aren't just code - they're living, clickable
things. The artifact becomes a first-class entity that can be versioned, shared, and
remixed.

**Architecture (from Anthropic engineering):**

- iFrame sandboxes with full-site process isolation
- Strict Content Security Policies (CSPs) for network access control
- Built with React, Next.js, Tailwind - prototyped in 3 months by 2 engineers
- No actual Python execution - artifacts are web content only

**Limitation:** No code execution for Python/data analysis. Artifacts are for
visualization, not computation.

#### ChatGPT Canvas + Code Execution

Recent addition that runs Python in-browser via Pyodide. Users can edit code in a
Canvas-style interface and execute it without server round-trips.

**Strengths:**

- Zero latency for execution (runs locally)
- Users can see and edit the code directly
- No data leaves the browser

**Limitations:**

- WASM limits (2-3x slower than native Python)
- Limited package availability
- No network access
- No persistent filesystem

#### Vercel AI Chatbot (Open Source Reference)

Best-in-class open-source implementation. Uses Pyodide v0.23.4 for Python execution
directly in the browser.

**Implementation Pattern:**

```typescript
// From ai-chatbot/artifacts/code/client.tsx
const currentPyodideInstance = await globalThis.loadPyodide({
  indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
});

// Matplotlib output handling - captures base64 PNGs
currentPyodideInstance.setStdout({
  batched: (output: string) => {
    outputContent.push({
      type: output.startsWith("data:image/png;base64") ? "image" : "text",
      value: output,
    });
  },
});

await currentPyodideInstance.loadPackagesFromImports(content);
await currentPyodideInstance.runPythonAsync(content);
```

**Strengths:**

- Zero infrastructure cost for execution
- Privacy-first (code runs in browser)
- Matplotlib charts render as inline images
- Version history with undo/redo
- Open source - we can study every line

**Location:** `/Users/nick/src/reference/ai-chatbot/artifacts/code/client.tsx`

#### LibreChat Artifacts

Uses Sandpack (from Codesandbox) for React/HTML execution in sandboxed iframes. Ships
with pre-bundled shadcn/ui components - AI generates imports like
`import { Button } from '/components/ui/button'` and they work.

**Implementation Pattern:**

```typescript
// From librechat client/src/components/Artifacts/ArtifactPreview.tsx
<SandpackProvider
  files={{ ...artifactFiles, ...sharedFiles }}
  options={sharedOptions}
  template={template}
>
  <SandpackPreview showOpenInCodeSandbox={false} ref={previewRef} />
</SandpackProvider>
```

**Pre-bundled Dependencies:** Three.js, Lucide React, React Router, Radix UI (accordion,
dialog, dropdown, popover, tabs, tooltip, etc.), Recharts, date-fns, Tailwind CSS.

**Key Insight:** AI can only use what's available. Pre-bundling a component library
means the AI generates usable, styled interfaces without setup.

**Location:** `/Users/nick/src/reference/librechat/client/src/utils/artifacts.ts`

#### Replit Agent

Full development environment as a service. Replit Agent 3 (September 2025) is fully
autonomous - plans, writes, tests, and deploys software from natural language.

**Strengths:**

- True multi-file, multi-language development
- Full network access (can install packages, call APIs)
- Persistent workspace across sessions
- One-click deployment to production

**Trade-off:** Heavyweight for simple computations. Overkill for "calculate the average
of these numbers."

#### v0 by Vercel

AI-powered UI generation with instant preview deployments. Generates React/Next.js
components from prompts and deploys them to preview URLs.

**Key Pattern:** Every generated component is immediately deployable. The gap between
"here's code" and "here's a URL you can share" is zero.

#### WebContainers (StackBlitz)

Node.js running entirely in the browser via WASM. Full npm, full filesystem, full dev
server - no backend required.

**Strengths:**

- Sub-10ms boot time for Node.js
- Full npm package installation
- Hot module replacement in-browser
- Network access via Service Workers

**Use Case:** When we need to run JavaScript/TypeScript server-side code without a
server.

### Emerging Platforms (2025)

#### Koyeb Sandboxes

Serverless containers optimized for AI code execution. Sub-200ms wakeup via "Light
Sleep," scale-to-zero billing, GPU available.

**Pricing:** ~$0.0000012/s (cheaper than E2B)

#### Cloudflare Sandbox SDK (Beta)

Edge isolates for code execution. Uses Cloudflare Workers infrastructure. Fast cold
starts, global distribution, limited runtime capabilities.

#### Vercel Sandbox

New offering (November 2025) for AI code execution in Vercel's infrastructure. Details
still emerging.

#### Google Agent Sandbox (GKE)

Enterprise-focused sandbox for AI code execution in Kubernetes. Syscall filtering,
network isolation, audit logging.

---

## Gap Analysis

### Achievable Now (Table Stakes)

These capabilities exist today and we can implement immediately:

| Capability               | Best Pattern                          | Our Path                         |
| ------------------------ | ------------------------------------- | -------------------------------- |
| Python execution (basic) | Pyodide in browser                    | Vercel AI Chatbot pattern        |
| Data analysis packages   | Pyodide has pandas, numpy, matplotlib | Already supported                |
| Chart rendering          | matplotlib → base64 PNG               | Vercel pattern shows how         |
| React/HTML preview       | Sandpack                              | LibreChat pattern                |
| Component library        | Pre-bundled shadcn/ui                 | LibreChat's sharedFiles pattern  |
| Versioning               | Artifact version history              | Vercel's (id, createdAt) pattern |
| Stateful sessions        | Session-scoped sandbox                | All leaders do this              |

### Achievable with Investment (6-12 months)

| Capability             | Gap                                  | Path Forward            |
| ---------------------- | ------------------------------------ | ----------------------- |
| Full Python ecosystem  | Pyodide's ~200 packages vs full PyPI | E2B or Fly Machines     |
| Persistent filesystems | Current sandboxes are ephemeral      | Fly Volumes or E2B      |
| GPU workloads          | No WASM GPU support                  | E2B or Koyeb GPUs       |
| Multi-file projects    | Current: single code blocks          | Workspace abstraction   |
| Network access         | Security vs functionality            | Allowlist specific APIs |

### Aspirational (Requires Breakthroughs)

| Capability               | What's Missing                            | Dependencies                  |
| ------------------------ | ----------------------------------------- | ----------------------------- |
| True speech-to-code      | Voice → running code in one step          | Voice + execution integration |
| Predictive execution     | Run code before user asks                 | Intent prediction models      |
| Cross-conversation state | Variables persist forever                 | Memory + compute integration  |
| Self-healing code        | Auto-fix errors without user intervention | More capable models           |

### Carmenta's Differentiation Opportunity

**None of the current leaders combine:**

1. Python computation (ChatGPT's strength)
2. Live web preview (Claude Artifacts' strength)
3. Pre-bundled components (LibreChat's strength)
4. Heart-centered philosophy (our unique value)

**The gap we can fill:** A unified experience where data analysis, visualization, and
interactive web creation flow together naturally - with the Carmenta personality making
the experience feel like collaboration, not tool operation.

---

## Implementation Tiers

### Tier 1: Table Stakes (MVP)

**What we ship first:**

- Pyodide-based Python execution (browser-side, Vercel pattern)
- Matplotlib/Seaborn chart rendering as inline images
- Sandpack-based React/HTML preview
- Pre-bundled shadcn/ui components
- Basic artifact versioning

**Cost:** $0 infrastructure (all client-side) **Timeline:** 2-4 weeks

### Tier 2: Leader Parity

**What makes us competitive:**

- E2B or Fly Machines for full Python ecosystem
- Stateful sessions across conversation turns
- File upload → sandbox filesystem
- Multiple output types (charts, tables, files, interactive)

**Cost:** E2B $150/mo or Fly usage-based **Timeline:** 4-8 weeks

### Tier 3: Vision

**What makes us best-in-class:**

- Voice-first code iteration ("make the bars blue")
- Unified data + web creation experience
- Memory-aware execution (remember user's data patterns)
- AG-UI integration (generated interfaces as first-class outputs)
- Self-improving code (Carmenta fixes errors automatically)

**Dependencies:** Voice, Memory, AG-UI components **Timeline:** 3-6 months

---

## Sources

**Primary Research:**

- [How Anthropic Built Artifacts](https://newsletter.pragmaticengineer.com/p/how-anthropic-built-artifacts) -
  Pragmatic Engineer, Aug 2024
- [ChatGPT Advanced Data Analysis Architecture](https://www.datastudios.org/post/how-chatgpt-s-advanced-data-analysis-works-architecture-features-limits-and-what-s-next) -
  DataStudios, May 2025
- [Top Sandbox Platforms for AI Code Execution 2025](https://www.koyeb.com/blog/top-sandbox-code-execution-platforms-for-ai-code-execution-2025) -
  Koyeb, Nov 2025
- [Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing) -
  Anthropic Engineering, Oct 2025

**Reference Implementations:**

- `/Users/nick/src/reference/ai-chatbot/` - Vercel AI Chatbot (Pyodide pattern)
- `/Users/nick/src/reference/librechat/` - LibreChat (Sandpack + shadcn pattern)
- `/Users/nick/src/reference/assistant-ui/` - Composable primitives

**Platform Documentation:**

- [E2B](https://e2b.dev/) - Managed sandbox API
- [Fly Machines](https://fly.io/docs/machines/) - Firecracker VMs
- [Pyodide](https://pyodide.org/) - Python in WebAssembly
- [WebContainers](https://webcontainers.io/) - Node.js in browser
- [Sandpack](https://sandpack.codesandbox.io/) - React sandbox
