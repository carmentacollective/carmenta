/**
 * Tool Renderers
 *
 * Organized into three families:
 * - core: AI's native capabilities (webSearch, fetchPage, etc.)
 * - code: Claude Code local dev tools (Read, Write, Bash, etc.)
 * - integrations: External service tools (Gmail, Slack, etc.)
 */

// Registry pattern for tool rendering
export {
    renderCodeTool,
    isCodeTool,
    DefaultToolRenderer,
    type ToolPartData,
} from "./registry";

// Code tool renderers
export * from "./code";
