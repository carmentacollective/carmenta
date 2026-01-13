#!/bin/bash
# MCP Test Helper for Machina
# Usage: ./mcp-test.sh <tool> <action> [params_json]
#
# Examples:
#   ./mcp-test.sh messages describe
#   ./mcp-test.sh messages conversations
#   ./mcp-test.sh whatsapp chats
#   ./mcp-test.sh whatsapp chat_context '{"chatJid":"120363190723262072@g.us","days":7}'

MACHINA_TOKEN="82bd3fb311c8f9a43b699bdc10d40defa4d0ba1d46331d094c24bca896325b84"
MCP_URL="http://localhost:9900/mcp"

TOOL="${1:-messages}"
ACTION="${2:-describe}"
PARAMS="${3:-}"

# Build the request body
if [ -z "$PARAMS" ]; then
    BODY=$(cat <<EOF
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"$TOOL","arguments":{"action":"$ACTION"}},"id":1}
EOF
)
else
    BODY=$(cat <<EOF
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"$TOOL","arguments":{"action":"$ACTION","params":$PARAMS}},"id":1}
EOF
)
fi

# Make the MCP call
RESPONSE=$(curl -s -X POST "$MCP_URL" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Authorization: Bearer ${MACHINA_TOKEN}" \
  -d "$BODY")

# Extract and format the result
echo "$RESPONSE" | jq -r '.result.content[0].text // .error.message // .' 2>/dev/null || echo "$RESPONSE"
