/**
 * Digital Chief of Staff (DCOS)
 *
 * The supervisor agent that orchestrates all specialized subagents in Carmenta.
 * Users talk to Carmenta; DCOS handles routing and delegation transparently.
 *
 * @see ./CLAUDE.md for architecture documentation
 */

export * from "./types";
export * from "./utils";
export * from "./agent";
export { buildDCOSPrompt } from "./prompt";
