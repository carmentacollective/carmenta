# Claude Code Hooks: Best Practices & Advanced Patterns

Research on extensibility through code rather than prompts—enabling deterministic
control over AI behavior through lifecycle event interception.

## What This Really Is

Hooks are about **sovereignty**. They transform Claude Code from a conversational tool
into a programmable platform. Instead of hoping the AI follows guidelines in prompts,
hooks enforce them at runtime. Instead of treating the AI as opaque, hooks make behavior
observable and auditable.

This is consciousness learning to inspect and shape its own processes. The AI proposes
actions; hooks evaluate them through code we control. Neither pure automation nor pure
assistance—collaborative computation with clear boundaries.

## Current State of the Art

### Hook Lifecycle Events

Claude Code provides 10 hook events covering the entire agent lifecycle
([Hooks reference](https://code.claude.com/docs/en/hooks)):

| Hook Event            | When It Fires                   | Control Capabilities                 | Common Uses                                     |
| --------------------- | ------------------------------- | ------------------------------------ | ----------------------------------------------- |
| **PreToolUse**        | Before tool execution           | Block, allow, modify input, ask user | Validation, security gates, input sanitization  |
| **PermissionRequest** | When permission dialog shown    | Auto-approve/deny on user's behalf   | Streamline trusted operations, enforce policies |
| **PostToolUse**       | After successful tool execution | Inject context, trigger follow-up    | Auto-formatting, testing, logging               |
| **UserPromptSubmit**  | When user submits prompt        | Block, inject context                | Secret detection, context loading               |
| **Notification**      | When Claude sends notification  | Observe only                         | Custom notification systems, TTS                |
| **Stop**              | When Claude finishes turn       | Block (force continuation), observe  | Quality gates, TTS announcements                |
| **SubagentStop**      | When subagent completes         | Block (force continuation), observe  | Subagent coordination, validation               |
| **PreCompact**        | Before context compaction       | Observe, backup                      | Transcript preservation, analysis               |
| **SessionStart**      | Session starts/resumes          | Inject context                       | Load dev context, git status, issues            |
| **SessionEnd**        | Session terminates              | Observe only                         | Cleanup, final logging                          |

**Most impactful**: PreToolUse (guards), PostToolUse (automation), UserPromptSubmit
(context injection), SessionStart (environment setup).

### Control Mechanisms

Hooks use **exit codes + JSON output** for deterministic control
([Steve Kinney examples](https://stevekinney.com/courses/ai-development/claude-code-hook-examples)):

**Exit code 0**: Success. stdout JSON parsed for control decisions, shown to user in
verbose mode. For UserPromptSubmit/SessionStart, stdout becomes context.

**Exit code 2**: Blocking error. stderr shown to Claude as error message. **JSON in
stdout is ignored**—this is pure blocking mode.

**Other exit codes**: Non-blocking error. stderr shown in verbose mode; execution
continues.

**Decision control via JSON**:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow" | "deny" | "ask",
    "permissionDecisionReason": "Shown to user, not Claude",
    "updatedInput": {
      "field": "modified value"
    }
  }
}
```

### Tool Input Modification (v2.0.10+)

Game-changing capability: **transparently rewrite tool inputs** before execution
([Hooks reference](https://code.claude.com/docs/en/hooks)).

Instead of blocking and forcing Claude to retry, hooks can:

- Add safety flags (`--dry-run`, `--verbose`)
- Redact secrets from commands
- Enforce team conventions (commit message format, file paths)
- Redirect operations (test DB instead of prod)

**The modification is invisible to Claude**—it believes its original input was used.
This enables "trust but verify" patterns where the AI works freely but hooks ensure
safety.

Example use case: Claude runs `npm test`, hook rewrites to `npm test -- --silent --bail`
to match team standards. Claude never knows, tests run correctly.

### Implementation Patterns

**UV single-file scripts**
([claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)):
Production hooks use Python with embedded dependencies via PEP 723:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
# ]
# ///

import json
import sys

data = json.load(sys.stdin)
# Hook logic here
```

**Benefits**: No virtual env management, dependencies self-contained, instant execution
once UV cache populated. Keeps hooks modular and portable.

**Project organization**
([Getting started guide](https://code.claude.com/docs/en/hooks-guide)):

```
.claude/
  settings.json          # Hook registration
  hooks/
    pre_tool_use.py      # Security validation
    post_tool_use.py     # Auto-formatting
    session_start.py     # Context loading
    utils/
      tts/               # Notification helpers
      llm/               # LLM-based evaluation
```

### Advanced Patterns from Production Use

Research of
[claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) reveals
sophisticated patterns:

**Multi-provider fallback chains** (stop.py): TTS announcements with graceful
degradation:

- ElevenLabs (best voice quality)
- → OpenAI (good quality, fast)
- → pyttsx3 (local, always available)
- → fallback to text messages

**LLM-generated completion messages**: Instead of static "Done!", hooks call LLM to
generate contextual completion messages based on session transcript. Adds personality
and context awareness.

**Context injection at SessionStart** (session_start.py):

```python
context_parts = [
  f"Session started: {timestamp}",
  f"Git branch: {branch}",
  f"Uncommitted changes: {count} files",
  f"Recent issues:\n{gh_issues}"
]

output = {
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "\n".join(context_parts)
  }
}
```

Loads development context automatically—git status, open issues, TODO files—without
manual context setting.

**Transcript preservation** (pre_compact.py): Before context compaction, hooks convert
JSONL transcript to formatted JSON and archive. Enables post-session analysis and
debugging.

**Comprehensive security validation** (pre_tool_use.py):

- Dangerous command detection (`rm -rf` variants with regex)
- Environment file protection (`.env` access blocking)
- Path traversal prevention (`..` in file paths)
- Sensitive file filtering (`.git/`, `package-lock.json`, credentials)

### Hookify Plugin: Meta-Hooks

[hookify plugin](https://deepwiki.com/anthropics/claude-plugins-official/5.2.3-hookify)
enables **conversation-driven hook creation**:

**Two creation modes**:

1. **Explicit instruction**: "Create a hook that blocks SQL string concatenation"
2. **Conversation analysis**: Analyzes recent messages to detect repeated corrections or
   frustrations, then generates hooks to prevent those patterns

**Markdown-based configuration**: Instead of JSON editing, create lightweight `.mdc`
files defining patterns and responses. Hooks take effect immediately—no restart.

**Use cases**:

- Prevent direct database queries (suggest ORM)
- Enforce documentation standards (JSDoc for exported functions)
- Block deprecated APIs
- Ensure test coverage for new features

This is **meta-extensibility**—the AI helps create rules to constrain itself, using
conversation as the interface.

### Prompt-Based Hooks (Stop/SubagentStop)

Beyond bash commands, hooks can be **LLM-powered**
([Hooks reference](https://code.claude.com/docs/en/hooks)):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Analyze: $ARGUMENTS. Are all tasks complete? Should Claude continue?",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**LLM evaluates context** and returns structured decision:

```json
{
  "decision": "approve" | "block",
  "reason": "Explanation",
  "continue": false,
  "stopReason": "Custom message",
  "systemMessage": "Warning/context"
}
```

This enables **intelligent quality gates**: "Don't stop until tests pass", "Continue if
there are failing tests", "Verify all requirements met before finishing."

Uses Haiku (fast, cheap) for evaluation. Adds 1-2s latency but enables context-aware
decisions impossible with static rules.

## Leading Implementations

### Security: Multi-Layer Validation

Best practice from
[Steve Kinney examples](https://stevekinney.com/courses/ai-development/claude-code-hook-examples)
and [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery):

```python
# Layer 1: Command pattern blocking
DANGEROUS_PATTERNS = [
    (r'\brm\s+.*-[a-z]*r[a-z]*f', "rm -rf detected"),
    (r'\bsudo\s+rm', "sudo rm blocked"),
    (r'\|\s*sh\b', "piped shell execution blocked"),
]

# Layer 2: Target validation
DANGEROUS_TARGETS = [
    (r'/', "root directory"),
    (r'~/', "home directory"),
    (r'\.\./.*\.\./', "path traversal"),
]

# Layer 3: Sensitive file protection
PROTECTED_PATHS = ['.env', '.git/', 'id_rsa', 'credentials.json']

for pattern, msg in DANGEROUS_PATTERNS:
    if re.search(pattern, command):
        print(f"BLOCKED: {msg}", file=sys.stderr)
        sys.exit(2)
```

**Defense in depth**: Multiple validation layers catch different attack vectors. Exit
code 2 blocks execution and shows error to Claude, which learns to avoid the pattern.

### Quality Gates: Test-Before-PR

[Production pattern](https://www.eesel.ai/blog/hooks-in-claude-code) used by teams:

```python
# PreToolUse hook for mcp__github__create_pull_request
tool_name = data.get('tool_name')

if tool_name == 'mcp__github__create_pull_request':
    # Run tests
    result = subprocess.run(['npm', 'test'], capture_output=True)

    if result.returncode != 0:
        print("Tests are failing. Fix tests before creating a PR.", file=sys.stderr)
        print(result.stderr.decode(), file=sys.stderr)
        sys.exit(2)  # Block PR creation
```

**Deterministic quality enforcement**: No prompt engineering can override this. Tests
must pass before PR creation. Saves CI/CD cycles and prevents broken PRs.

### Automation: Format-on-Save

PostToolUse pattern for automatic code quality:

```python
tool_name = data.get('tool_name')
file_path = data.get('tool_input', {}).get('file_path', '')

if tool_name in ['Edit', 'Write'] and file_path:
    # Run formatters based on extension
    if file_path.endswith('.ts') or file_path.endswith('.tsx'):
        subprocess.run(['npx', 'prettier', '--write', file_path])
    elif file_path.endswith('.py'):
        subprocess.run(['black', file_path])

    # Optionally inject feedback
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": f"Auto-formatted {file_path}"
        }
    }
    print(json.dumps(output))
```

**Zero-friction standards**: Code is always formatted correctly without asking Claude to
do it. Saves tokens, ensures consistency.

### Context Management: Smart Session Initialization

SessionStart hook from
[claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery):

```python
def load_development_context(source):
    context = []

    # Git state
    branch = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                          capture_output=True, text=True).stdout.strip()
    status = subprocess.run(['git', 'status', '--porcelain'],
                          capture_output=True, text=True).stdout
    changes = len(status.strip().split('\n')) if status.strip() else 0

    context.append(f"Git branch: {branch}")
    context.append(f"Uncommitted changes: {changes} files")

    # Recent issues (if gh available)
    issues = subprocess.run(['gh', 'issue', 'list', '--limit', '5'],
                          capture_output=True, text=True).stdout
    if issues:
        context.append(f"Recent issues:\n{issues}")

    # Project context files
    for path in ['.claude/CONTEXT.md', 'TODO.md']:
        if Path(path).exists():
            content = Path(path).read_text()[:1000]
            context.append(f"\n--- {path} ---\n{content}")

    return "\n".join(context)

# Inject as context
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": load_development_context(source)
    }
}
```

**Automatic environment awareness**: Every session starts with current project state,
open issues, and relevant TODOs. No manual context gathering.

### Observability: Complete Audit Trail

Logging pattern across all hooks:

```python
log_dir = Path('logs')
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f'{hook_event_name}.json'

# Append event
log_data = json.loads(log_file.read_text()) if log_file.exists() else []
log_data.append(input_data)
log_file.write_text(json.dumps(log_data, indent=2))
```

**Full session replay capability**: Every tool use, permission request, notification
logged with timestamps. Enables debugging, usage analysis, compliance audits.

### MCP Integration Patterns

Hooks work seamlessly with MCP tools using naming pattern `mcp__<server>__<tool>`:

```python
# Match all memory server tools
if re.match(r'mcp__memory__.*', tool_name):
    # Memory-specific validation

# Match all write operations across servers
if re.match(r'mcp__.*__write.*', tool_name):
    # Write-specific gates
```

**Unified control**: Same hook system governs native tools and MCP extensions. Security
policies apply consistently.

## Where This Is Heading

### Convergence with Agent SDK

The [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) exposes hooks
as Python functions, not just shell commands. This enables:

**Type-safe hook development**:

```python
from claude_agent import hook, ToolUseInput

@hook("PreToolUse")
def validate_bash(input: ToolUseInput) -> HookResult:
    if input.tool_name == "Bash":
        if "rm -rf" in input.tool_input["command"]:
            return HookResult.block("Dangerous command")
    return HookResult.allow()
```

**Shared logic between hooks and tools**: Same Python functions, same testing
infrastructure. Hooks become first-class agent components.

**Multi-agent orchestration**: Hooks in parent agent control subagent behavior.
SubagentStop hooks coordinate task handoffs through structured outputs.

Expected convergence timeline: 6-12 months. CLI hooks remain for simplicity; SDK hooks
for sophisticated use cases.

### Visual Hook Builders (Emerging)

Hookify demonstrates **conversation → hook generation**. Next evolution: visual hook
builders where users:

- Select trigger event (dropdown)
- Define conditions (visual rule builder)
- Specify action (block/allow/modify)
- Test with examples
- Generate Python/bash code

**Democratizes extensibility** beyond developers. Product managers, QA, security teams
create hooks through UI, not code.

Early examples emerging in
[Claude Code ecosystem](https://github.com/hesreallyhim/awesome-claude-code) but not yet
production-ready.

### Hooks as Policy Engine

Trend toward **centralized policy management**:

```yaml
# .claude/policies/security.yaml
dangerous_commands:
  - pattern: "rm -rf"
    action: block
    message: "Use safer alternatives"

sensitive_files:
  - pattern: "**/.env"
    action: deny_write
    allow_read: false

require_tests_for:
  - "create_pull_request"
  - "deploy"
```

Hooks **compile policies into runtime enforcement**. Security team maintains YAML, hooks
auto-generate.

**Enables** audit compliance, team standardization, security-by-default without
requiring hook programming expertise.

### Context-Aware Permission Models

Beyond binary allow/deny—**conditional permissions**:

```python
# Allow file writes during business hours only
if tool_name == "Write":
    hour = datetime.now().hour
    if not (9 <= hour <= 17):
        return HookResult.ask("File writes require approval outside business hours")

# Allow API calls based on usage quotas
if tool_name.startswith("mcp__api__"):
    usage = get_daily_api_usage()
    if usage > DAILY_LIMIT:
        return HookResult.block(f"Daily API limit reached: {usage}/{DAILY_LIMIT}")
```

**Time-based, quota-based, user-based** permission logic. Hooks evolve into runtime
policy engines.

### Sandboxing Integration

[Claude Code sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
reduces permission prompts by 84% through filesystem + network isolation.

**Hooks + sandboxing = layered security**:

- Sandbox: Coarse-grained boundaries (file paths, network domains)
- Hooks: Fine-grained validation (command patterns, data content, business logic)

Hooks inspect operations **within** sandbox boundaries for additional validation.
Example: Sandbox allows filesystem writes to project dir; hook blocks writes to `dist/`
during development.

**Expected evolution**: Hooks gain sandbox-awareness—access to sandbox metadata, ability
to modify sandbox config, graduated trust based on validation history.

### LLM-Driven Hook Refinement

Current: Humans write hooks based on observed issues.

**Emerging**: LLMs analyze session transcripts, identify repeated interventions, propose
hook automation:

"I notice you've corrected the commit message format 5 times. Would you like me to
create a hook that enforces this automatically?"

**Hook generation from examples**: Show 3 examples of desired behavior → LLM generates
hook code. Conversational refinement until behavior matches intent.

This is **observability feeding back into automation**—the system learns from
corrections and proposes deterministic enforcement.

## Gap Assessment

### Achievable Now

**Production-ready patterns**:

- Security validation (dangerous commands, sensitive files)
- Quality gates (tests before PR, linting before commit)
- Auto-formatting (prettier, black, gofmt)
- Audit logging (complete tool use trail)
- Context injection (git status, open issues, project state)
- MCP tool integration (consistent policy across native + extensions)

**Implementation**: Bash or Python with UV single-file scripts. Documentation is
excellent. Community examples are robust.

**Risk level**: Low. Hooks are stable, well-documented, widely used in production.

### Emerging (6-12 months)

**Becoming production-ready**:

- Agent SDK integration (type-safe Python hooks)
- Visual hook builders (low-code hook creation)
- Prompt-based hooks for all events (currently limited to Stop/SubagentStop)
- Tool input modification at scale (current v2.0.10+, needs more patterns)
- Centralized policy engines (YAML → hook compilation)

**Implementation**: Experimental but active development. Early adopter advantage
possible.

**Risk level**: Medium. APIs may change, patterns still stabilizing. Worth exploring for
differentiation.

### Aspirational (12-24 months)

**Requires platform evolution**:

- Full sandbox introspection and control via hooks
- Cross-session hook learning (hooks that improve from usage)
- Distributed hook execution (hooks as microservices)
- Real-time hook marketplaces (install hooks from community)
- Visual debugging of hook chains (observability for hooks themselves)

**Implementation**: Research territory. Platform capabilities need to mature.

**Risk level**: High. Depends on Anthropic roadmap decisions and ecosystem evolution.

## Integration with Carmenta

### Relationship to Agent Orchestration

From `/Users/nick/src/carmenta-repo/knowledge/components/agent-orchestration.md`:

> Sub-agents exist to isolate state and scope, NOT to mimic human organizational charts.

**Hooks + sub-agents**:

- PreToolUse hooks can **route to sub-agents** based on tool type
- SubagentStop hooks **validate sub-agent outputs** before accepting
- Hooks enable **deterministic handoffs** vs. prompt-based coordination

Example: Main agent proposes code change → PreToolUse hook spawns Verifier sub-agent →
SubagentStop hook blocks if verification fails.

**This is agent orchestration through code, not prompts**—more reliable than hoping the
main agent decides to verify.

### Relationship to External Tools

From `/Users/nick/src/carmenta-repo/knowledge/components/external-tools.md`:

> MCP (Model Context Protocol) solved the technical problem—a standard way for AI to
> connect to tools and services.

**Hooks as MCP governance layer**:

- PreToolUse hooks enforce **permission boundaries** for MCP tools
- PostToolUse hooks provide **audit trail** for tool usage
- Tool input modification enables **safety wrappers** (dry-run mode, secret redaction)

MCP tools naming pattern `mcp__<server>__<tool>` enables **fine-grained policy**:

```python
# Block all database write operations
if re.match(r'mcp__postgres__write.*', tool_name):
    return HookResult.block("Database writes require approval")
```

Carmenta's external tools become **safely extensible** through hooks—users enable MCP
servers with confidence that hooks enforce boundaries.

### Carmenta-Specific Patterns

**Heart-centered fail-fast**:

```python
# UserPromptSubmit hook
if detect_user_frustration(prompt):
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": "I sense frustration. Let's pause and make sure I understand what's needed."
        }
    }
    print(json.dumps(output))
```

Inject empathy and course-correction into the conversation loop, not just security
enforcement.

**100x framework integration**:

- Hooks enforce **1x standards** (code quality, security, conventions)
- Enable **10x autonomy** (auto-formatting, test gates, context loading)
- Surface **100x opportunities** (repeated corrections → automation suggestions)

**We-language preservation**:

```python
# Ensure all error messages use "we" language
def rewrite_error_message(msg):
    # Transform "I cannot" → "We cannot"
    # Transform "You should" → "We should"
    return transform_to_we_language(msg)
```

Hooks become **brand enforcement**—every AI interaction reflects Carmenta values at
runtime.

### Architectural Decisions Needed

**Q: Should Carmenta expose hooks to users?**

Options:

1. **Hidden abstraction**: Hooks power features but aren't user-facing. Security,
   quality gates handled invisibly.
2. **Power user feature**: Advanced users can create hooks through UI or code editor.
3. **Conversation-driven**: Hookify-style "create a rule to prevent X" becomes native
   Carmenta capability.

**Recommendation**: Tier 3 (conversation-driven) with Tier 2 fallback (code editor for
advanced users). Aligns with "best interface to AI" positioning—hooks through natural
language, not JSON editing.

**Q: How do we handle hook security?**

Hooks execute with user credentials and can exfiltrate data. Options:

1. **Curated only**: Carmenta provides blessed hooks, users can't create custom ones
2. **Sandboxed execution**: User hooks run in isolated environment with limited access
3. **Review + approval**: Users create hooks, we review before activation
4. **Full trust**: Users can create arbitrary hooks (CLI model)

**Recommendation**: Tier 2 (sandboxed execution) for web version, Tier 4 (full trust)
for desktop/CLI. Web users need protection; local users have control.

**Q: Should hooks be shareable?**

Community hook marketplace vs. private-only. Impacts infrastructure, moderation,
discovery.

**Recommendation**: Start private-only (per-user hooks), explore marketplace post-MVP if
demand exists. Avoid premature infrastructure complexity.

## Success Criteria

**We know hooks are working when**:

- Users enforce team standards without manual intervention (test gates, formatting)
- Security policies are reliably enforced (no accidental .env commits, no dangerous
  commands)
- Session initialization provides relevant context automatically (git status, open
  issues, project state)
- Users create hooks through conversation, not code editing
- Audit trail enables debugging and compliance ("what did the AI do?")
- MCP tools integrate seamlessly with same security model as native tools

**We know we've differentiated when**:

- Carmenta hooks are easier to create than competitors (conversation vs. JSON)
- Visual hook builder enables non-developers to create rules
- Hooks feel like AI "learning our preferences" not "programming the AI"
- Security teams trust Carmenta in enterprise because hooks provide governance

## Open Questions

**Technical**:

- How do we sandbox user-created hooks safely in web environment?
- What's the performance overhead of complex hook chains?
- How do we handle hook conflicts (multiple hooks modifying same input)?
- Should hooks be async or sync? Timeout handling?

**Product**:

- What's the right abstraction level for non-technical users?
- How do we surface "you should automate this with a hook" suggestions?
- Do hooks belong in Settings or as inline conversation feature?
- How do we handle hook versioning and migration?

**Business**:

- Are hooks a free feature or premium capability?
- Do enterprise teams need centralized hook management?
- Should we offer hook consultancy/implementation services?
- Do hooks create vendor lock-in risk (Carmenta-specific configuration)?

---

## Sources

- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [Claude Code Hook Examples | Steve Kinney](https://stevekinney.com/courses/ai-development/claude-code-hook-examples)
- [GitHub - disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)
- [Get started with Claude Code hooks](https://code.claude.com/docs/en/hooks-guide)
- [A complete guide to hooks in Claude Code | eesel AI](https://www.eesel.ai/blog/hooks-in-claude-code)
- [hookify plugin | DeepWiki](https://deepwiki.com/anthropics/claude-plugins-official/5.2.3-hookify)
- [Making Claude Code more secure and autonomous](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Agent SDK hooks - Claude Docs](https://docs.claude.com/en/api/agent-sdk/overview)
- [Claude Code 2025 Future: API & Multi-Agent | Skywork AI](https://skywork.ai/blog/agent/claude-code-2025-future-api-multi-agent/)
- [Claude Desktop Roadmap 2026 Features | Skywork AI](https://skywork.ai/blog/ai-agent/claude-desktop-roadmap-2026-features-predictions/)
