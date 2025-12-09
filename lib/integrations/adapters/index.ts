/**
 * Service Adapters
 *
 * Each adapter implements the progressive disclosure pattern:
 * - One tool per service
 * - action='describe' for full documentation
 * - Specific actions for operations
 */

export { ServiceAdapter } from "./base";
export { ClickUpAdapter } from "./clickup";
export { FirefliesAdapter } from "./fireflies";
export { GiphyAdapter } from "./giphy";
export { LimitlessAdapter } from "./limitless";
export { NotionAdapter } from "./notion";
