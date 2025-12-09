/**
 * Service Adapters
 *
 * Each adapter implements the progressive disclosure pattern:
 * - One tool per service
 * - action='describe' for full documentation
 * - Specific actions for operations
 */

export { ServiceAdapter } from "./base";
export { GiphyAdapter } from "./giphy";
export { NotionAdapter } from "./notion";
