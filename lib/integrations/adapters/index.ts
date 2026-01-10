/**
 * Service Adapters
 *
 * Each adapter implements the progressive disclosure pattern:
 * - One tool per service
 * - action='describe' for full documentation
 * - Specific actions for operations
 *
 * IMPORTANT: Adapters are sorted alphabetically by service name to minimize merge conflicts
 * when multiple integrations are added concurrently. When adding a new adapter export,
 * insert it in alphabetical order rather than at the end.
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
export { CoinMarketCapAdapter } from "./coinmarketcap";
export { DropboxAdapter } from "./dropbox";
export { FirefliesAdapter } from "./fireflies";
export { GoogleCalendarContactsAdapter } from "./google-calendar-contacts";
export { GoogleWorkspaceFilesAdapter } from "./google-workspace-files";
export { LimitlessAdapter } from "./limitless";
export { NotionAdapter } from "./notion";
export { QuoAdapter } from "./quo";
export { SlackAdapter } from "./slack";
export { SpotifyAdapter } from "./spotify";
export { TwitterAdapter } from "./twitter";
