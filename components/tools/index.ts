/**
 * Tool Renderers
 *
 * Organized by context:
 * - shared: Common components (ToolRenderer, ToolStatus, etc.)
 * - code: Claude Code local dev tools (Read, Write, Bash, etc.)
 * - post-response: Suggestions, references, etc.
 * - research: Web search, deep research, etc.
 * - integrations: External service tools (Gmail, Slack, etc.)
 * - interactive: Plan, options, maps, etc.
 */

// Shared tool components
export * from "./shared";

// Post-response tools (suggestions, references, input, acknowledgment)
export * from "./post-response";

// Research tools (web search, deep research, fetch page, compare)
export * from "./research";

// Integration tools (Gmail, Slack, Notion, etc.)
export * from "./integrations";

// Interactive tools (plan, option lists, maps, calculations)
export * from "./interactive";

// Registry pattern for tool rendering
export {
    renderCodeTool,
    isCodeTool,
    DefaultToolRenderer,
    type ToolPartData,
} from "./registry";

// Code tool renderers
export * from "./code";
