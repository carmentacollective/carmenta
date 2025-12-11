/**
 * Service Adapters
 *
 * Each adapter implements the progressive disclosure pattern:
 * - One tool per service
 * - action='describe' for full documentation
 * - Specific actions for operations
 */

export {
    ServiceAdapter,
    type HelpResponse,
    type HelpOperation,
    type MCPToolResponse,
    type RawAPIParams,
    type ValidationResult,
    type ToolAnnotations,
} from "./base";
export { ClickUpAdapter } from "./clickup";
export { DropboxAdapter } from "./dropbox";
export { FirefliesAdapter } from "./fireflies";
export { GiphyAdapter } from "./giphy";
export { GoogleAdapter } from "./google";
export { LimitlessAdapter } from "./limitless";
export { NotionAdapter } from "./notion";
export { SlackAdapter } from "./slack";
