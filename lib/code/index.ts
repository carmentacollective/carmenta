/**
 * Code Mode - Claude Code integration for Carmenta
 *
 * Server-only exports (uses Node.js fs module).
 * For client components, import directly from:
 *   - @/lib/code/transform (types and utilities)
 *   - @/lib/code/tool-state-context (React context)
 */

// Server-only exports (Node.js fs)
export * from "./projects";

// These are also re-exported for server convenience
// but should be imported directly in client components
export * from "./transform";
export * from "./tool-state-context";
