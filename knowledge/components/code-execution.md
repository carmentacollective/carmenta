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

### Recommended Implementation: llm-sandbox

After evaluating the landscape, [llm-sandbox](https://github.com/vndee/llm-sandbox) is
the recommended foundation:

**Why llm-sandbox:**

- Docker-based isolation (familiar infrastructure)
- Interactive sessions with state persistence
- Automatic artifact extraction (plots become images)
- Multi-language support (Python primary, JS/Go/R available)
- MCP server support built-in
- MIT licensed, actively maintained
- Simple API: `pip install llm-sandbox`

**Basic integration:**

```python
from llm_sandbox import SandboxSession

with SandboxSession(lang="python") as session:
    result = session.run("""
import pandas as pd
df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
df['sum'] = df['a'] + df['b']
print(df.to_markdown())
    """)
    # result.stdout contains the markdown table
    # result.artifacts contains any generated images
```

### Alternative Approaches Considered

**Pyodide (WebAssembly Python):**

- Runs in browser, zero server infrastructure
- User data never leaves their machine
- Limited: no filesystem, no network, ~10MB download
- Better for: pure computation where data stays client-side

**E2B (managed service):**

- Firecracker microVMs, ~150ms cold start
- Used by major players (Groq, Fortune 500)
- Pricing: $150/mo base + usage
- Better for: teams wanting zero infrastructure management

**Cohere Terrarium:**

- Pyodide inside Docker (double isolation)
- Very locked down (no network, no filesystem)
- ~900ms for matplotlib chart
- Better for: maximum security, limited capability

### Security Model

Code execution is inherently risky. Our approach:

**Container Isolation:** Every execution runs in a fresh Docker container. No host
filesystem access. No network by default. Resource limits (CPU, memory, time) prevent
runaway code.

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

- **Where does the sandbox run?** Local Docker for desktop? Cloud-hosted for web users?
  Hybrid approach where web users connect to a managed sandbox service?
- **Session lifecycle**: How long do sessions persist? Per-conversation? Timed expiry?
  User-controlled?
- **Package management**: Pre-installed set only? Allow micropip installs from
  allowlist? Full PyPI access with security scanning?
- **Multi-language priority**: Python is primary. When do we add JavaScript? R for
  statistics-heavy users? Go for performance?

### Product Decisions

- **Visibility of code**: Always show code? Collapsible? Only on request? Does this vary
  by user preference or context?
- **Execution limits per tier**: Do free users get fewer executions? Shorter timeouts?
  What's the cost model?
- **File size limits**: Max upload size for data files? Max output file size?
- **Collaboration**: Can shared conversations include code execution? Security
  implications of running code in shared contexts?

### Technical Specifications Needed

- Docker container image specification (base image, pre-installed packages)
- Sandbox API contract (input/output schemas)
- Artifact extraction and delivery mechanism
- Resource limit configuration (CPU, memory, timeout defaults)
- Monitoring and observability approach for sandbox health
- MCP tool definition for code_execution

### Research Needed

- Performance benchmarking: llm-sandbox vs direct Docker vs E2B for our workload
- Security audit of container configuration
- User research: how do people want to interact with code execution? Show code vs hide
  code? Iterative refinement workflows?
- Cost modeling for cloud-hosted sandboxes at scale
- Evaluate Pyodide as fallback for offline/privacy-sensitive use cases

---

## Landscape Context

### Managed Services

| Service                             | Architecture         | Cold Start | Pricing          |
| ----------------------------------- | -------------------- | ---------- | ---------------- |
| [E2B](https://e2b.dev/)             | Firecracker microVMs | ~150ms     | $150/mo + usage  |
| [Modal](https://modal.com/)         | Containers           | 2-5s       | Usage-based      |
| [Together AI](https://together.ai/) | VM snapshots         | 500ms-2.7s | Bundled with API |

### Self-Hosted Open Source

| Project                                                                                   | Architecture      | Notes                                        |
| ----------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------- |
| [llm-sandbox](https://github.com/vndee/llm-sandbox)                                       | Docker/K8s/Podman | Recommended - stateful sessions, MCP support |
| [Cohere Terrarium](https://github.com/cohere-ai/cohere-terrarium)                         | Pyodide + Docker  | Maximum isolation, limited packages          |
| [DifySandbox](https://dify.ai/blog/difysandbox-goes-open-source-secure-execution-of-code) | Syscall whitelist | Part of Dify, enterprise-focused             |
| [Code Sandbox MCP](https://www.philschmid.de/code-sandbox-mcp)                            | Docker/Podman     | Purpose-built MCP server                     |

### Key Insight

The conference booth was probably E2B - they're the market leader with slick marketing.
But for self-hosted control and cost efficiency, llm-sandbox provides the same
capability without the $150/mo base cost or vendor dependency.
