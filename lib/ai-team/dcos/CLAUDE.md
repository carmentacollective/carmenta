# Digital Chief of Staff (DCOS)

The supervisor agent that orchestrates all specialized subagents in Carmenta.

## Architecture

DCOS is the single point of entry for user interactions. It receives messages from all
channels (web, SMS, voice) and delegates to specialized subagents:

- **Librarian**: Knowledge extraction and retrieval
- **MCP Config**: Tool and integration setup
- **Researcher**: Deep web research
- **Future**: Analyst, Quo Handler, etc.

Users always talk to "Carmenta" - the DCOS handles routing invisibly.

## Key Types

- `SubagentResult<T>`: Standardized envelope for all subagent responses
- `SubagentContext`: Context passed to subagent invocations
- `SubagentDefinition`: Registration interface for new subagents

## Safety Measures

All subagent invocations go through `safeInvoke()` which provides:

1. **Timeout protection**: Prevents blocking on slow subagents
2. **Error normalization**: Converts exceptions to structured results
3. **Sentry span wrapping**: Cross-agent trace correlation
4. **Step exhaustion detection**: Catches partial results

## Adding New Subagents

See `.claude/commands/build-agent.md` for the process.

## Files

- `types.ts`: Core type definitions
- `utils.ts`: Safety wrappers and utilities
- `prompt.ts`: DCOS system prompt
- `index.ts`: Main DCOS agent creation

**Before editing `prompt.ts`, invoke the `writing-for-llms` skill.**
