/**
 * Account Info Fetcher
 *
 * Centralized utility for fetching account information from OAuth services.
 * Used by both webhook handler and connection save endpoint.
 *
 * Pattern adapted from mcp-hubby's battle-tested implementation.
 */

import { logger } from "@/lib/logger";

interface AccountInfo {
    identifier: string;
    displayName: string;
}

/**
 * Fetch account information for a connected service
 *
 * @param service - The service ID (e.g., "clickup", "notion", "dropbox")
 * @param connectionId - Nango connection ID
 * @param userId - Optional user ID for logging
 * @returns Account identifier and display name
 * @throws ValidationError if account info cannot be fetched
 */
export async function fetchAccountInfo(
    service: string,
    connectionId: string,
    userId?: string
): Promise<AccountInfo> {
    switch (service) {
        case "clickup": {
            const { ClickUpAdapter } =
                await import("@/lib/integrations/adapters/clickup");
            const adapter = new ClickUpAdapter();
            return await adapter.fetchAccountInfo(connectionId, userId);
        }

        case "notion": {
            const { NotionAdapter } =
                await import("@/lib/integrations/adapters/notion");
            const adapter = new NotionAdapter();
            return await adapter.fetchAccountInfo(connectionId, userId);
        }

        case "dropbox": {
            const { DropboxAdapter } =
                await import("@/lib/integrations/adapters/dropbox");
            const adapter = new DropboxAdapter();
            return await adapter.fetchAccountInfo(connectionId, userId);
        }

        default:
            // For services without account info support, use connectionId as fallback
            logger.warn(
                { service, connectionId, userId },
                "Service does not support account info fetching, using connectionId as fallback"
            );
            return {
                identifier: connectionId,
                displayName: service,
            };
    }
}
