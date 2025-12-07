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

### Infrastructure Constraint

Carmenta runs on Render.com as a web service. Render services run inside containers but
cannot spawn additional containers (no Docker-in-Docker). This rules out self-hosted
solutions like llm-sandbox that require a Docker daemon.

Two viable paths: **managed sandbox APIs** or **WebAssembly-based execution**.

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

### Future Exploration: Docker-Based Solutions

When/if we move to infrastructure with Docker daemon access (dedicated VM, Fly.io
Machines, Kubernetes), these become viable:

- **[llm-sandbox](https://github.com/vndee/llm-sandbox)**: Full-featured, stateful
  sessions, multi-language, MCP support
- **[DifySandbox](https://dify.ai/blog/difysandbox-goes-open-source-secure-execution-of-code)**:
  Syscall whitelisting, enterprise-focused
- **[Code Sandbox MCP](https://www.philschmid.de/code-sandbox-mcp)**: Purpose-built MCP
  server

These offer more power and flexibility but require infrastructure we don't currently
have.

### Security Model

Code execution is inherently risky. Our approach varies by implementation:

**E2B:** Firecracker microVMs provide hardware-level isolation. Each execution runs in
an ephemeral VM. E2B handles security - we trust their infrastructure.

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

- **E2B vs Pyodide**: E2B is more capable but costs $150/mo+ and data leaves our infra.
  Pyodide is free and private but limited. Which tradeoff fits our users?
- **Session lifecycle**: How long do sessions persist? Per-conversation? Timed expiry?
  E2B sessions have cost implications.
- **Package management**: E2B has full PyPI. Pyodide has ~200 pre-built packages. Is
  that enough for our use cases?
- **Hybrid approach**: Could we use Pyodide for simple math and E2B only for complex
  data analysis? Worth the complexity?

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

- E2B pricing deep-dive: what does realistic usage actually cost?
- Pyodide package coverage: do we have what we need for data analysis workflows?
- Performance benchmarking: Pyodide vs E2B for typical operations
- User research: how do people want to interact with code execution?
- Terrarium evaluation: worth deploying as private service, or just use E2B?

---

## Landscape Context

### Viable for Render.com

| Option                                                     | Architecture | Cost     | Capability    |
| ---------------------------------------------------------- | ------------ | -------- | ------------- |
| [E2B](https://e2b.dev/)                                    | Firecracker  | $150/mo+ | Full Python   |
| [Pyodide](https://pyodide.org/)                            | WASM         | Free     | ~200 packages |
| [Terrarium](https://github.com/cohere-ai/cohere-terrarium) | Pyodide+HTTP | ~$30/mo  | ~200 packages |
| [Together AI](https://together.ai/)                        | VM snapshots | Bundled  | Full Python   |

### Future Options (Require Docker Daemon)

| Project                                                                                   | Architecture      | Notes                           |
| ----------------------------------------------------------------------------------------- | ----------------- | ------------------------------- |
| [llm-sandbox](https://github.com/vndee/llm-sandbox)                                       | Docker/K8s/Podman | Best DX, stateful sessions, MCP |
| [DifySandbox](https://dify.ai/blog/difysandbox-goes-open-source-secure-execution-of-code) | Syscall whitelist | Enterprise-focused              |
| [Code Sandbox MCP](https://www.philschmid.de/code-sandbox-mcp)                            | Docker/Podman     | Purpose-built for agents        |

These become viable if we move to Fly.io, dedicated VMs, or Kubernetes.

### Decision Context

E2B is the market leader - polished product, used by Fortune 500 companies. The $150/mo
base feels steep for MVP but might be worth it for full capability without
infrastructure complexity.

Pyodide is the scrappy alternative - free, private, works today. Limited packages could
be a problem for power users, but covers core data analysis needs (pandas, numpy,
matplotlib).
