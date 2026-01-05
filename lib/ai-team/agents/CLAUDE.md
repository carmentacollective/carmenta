# Subagent Tools

Tools that wrap specialized agents for DCOS orchestration.

## Pattern

Each subagent is exposed as a tool with progressive disclosure:

1. **Short description** in tool definition (< 100 chars)
2. **action='describe'** returns full operation documentation
3. **Other actions** execute the actual operations

## Creating a New Subagent Tool

Use the `/build-agent` slash command which guides through:

1. Define the subagent's purpose and operations
2. Create the tool wrapper in this directory
3. Register with DCOS
4. Add tests

## Files

- `librarian-tool.ts` - Knowledge base operations
- `mcp-config-tool.ts` - MCP server configuration
- `researcher-tool.ts` - Deep web research (wraps deepResearch)

## Safety

All tools use `safeInvoke()` from `../dcos/utils.ts` which provides:

- Timeout protection
- Error normalization to SubagentResult
- Sentry span wrapping
