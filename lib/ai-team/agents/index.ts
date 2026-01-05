/**
 * Subagent Tools for DCOS
 *
 * Each subagent is wrapped as a tool that DCOS can invoke.
 * Uses progressive disclosure: action='describe' returns full docs.
 */

export { createLibrarianTool } from "./librarian-tool";
export { createMcpConfigTool } from "./mcp-config-tool";
// export { createResearcherTool } from './researcher-tool';
