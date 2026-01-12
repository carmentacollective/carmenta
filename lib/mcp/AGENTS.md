# MCP Gateway

Model Context Protocol client management and request routing.

## ⚠️ CRITICAL: MCP Transport Protocol

**ALWAYS USE HTTP, NEVER SSE**

SSE (Server-Sent Events) transport is **DEPRECATED** for MCP servers. The MCP
specification has moved to HTTP as the standard transport.

When creating or configuring MCP servers:

- ✅ `transport: "http"` - CORRECT
- ❌ `transport: "sse"` - DEPRECATED, DO NOT USE

This applies to:

- `mcp-config-tool.ts` - Server creation via LLM
- `mcp/gateway.ts` - Client configuration
- Any MCP server configuration in the database

If you see SSE being used, switch it to HTTP immediately.
