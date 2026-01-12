# Digital Chief of Staff (DCOS)

The Carmenta orchestrator that coordinates specialized subagents.

## Architecture

Users talk to "Carmenta" via CarmentaSheet. The orchestrator delegates to subagents:

- **DCOS** (`dcos-tool.ts`): AI team member management (automations users create)
- **Librarian**: Knowledge extraction and retrieval
- **MCP Config**: Tool and integration setup
- **Researcher**: Deep web research (when available)
- **Integration Tools**: Connected services (Gmail, Slack, etc.)

Note: "DCOS" is both the orchestrator identity (this directory) and a subagent for team
management. The naming reflects that Carmenta's "Chief of Staff" manages the AI team.

## Subagent Pattern

All subagents use progressive disclosure:

1. Short description in tool definition
2. `action='describe'` returns full operation documentation
3. Other actions execute operations

Tools are in `/lib/ai-team/agents/`:

- `dcos-tool.ts` - AI team management
- `librarian-tool.ts` - Knowledge base
- `mcp-config-tool.ts` - Integration config

## Key Types

- `SubagentResult<T>`: Standardized envelope for all subagent responses
- `SubagentContext`: Context passed to subagent invocations (userId, userEmail, writer)

## Safety Measures

All subagent invocations go through `safeInvoke()` which provides:

1. **Timeout protection**: Prevents blocking on slow subagents
2. **Error normalization**: Converts exceptions to structured results
3. **Sentry span wrapping**: Cross-agent trace correlation
4. **Step exhaustion detection**: Catches partial results

## Files

- `agent.ts`: Main orchestrator execution
- `prompt.ts`: System prompt with delegation rules
- `types.ts`: Core type definitions
- `utils.ts`: Safety wrappers and utilities

**Before editing `prompt.ts`, invoke the `writing-for-llms` skill.**
