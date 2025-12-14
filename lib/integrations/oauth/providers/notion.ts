/**
 * Notion OAuth Provider Configuration
 *
 * Notion uses standard OAuth 2.0 with a few quirks:
 * - Token exchange requires Basic Auth (client_id:client_secret base64)
 * - Tokens don't expire (permanent until user revokes)
 * - Token response includes workspace_id, workspace_name, bot_id
 * - API requests need Notion-Version header
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const notionProvider: OAuthProviderConfig = {
    id: "notion",

    authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",

    // Notion doesn't use traditional scopes in the OAuth URL
    // Access is determined by what the user selects during authorization
    scopes: [],

    // Notion requires Basic Auth for token exchange
    useBasicAuth: true,

    // Request user token (vs integration/bot token)
    additionalAuthParams: {
        owner: "user",
    },

    /**
     * Extract account info from Notion's token response.
     *
     * Notion returns:
     * - workspace_id: Unique identifier for the workspace
     * - workspace_name: Human-readable workspace name
     * - workspace_icon: Workspace icon URL (if set)
     * - bot_id: Bot user ID for API calls
     * - owner: { type: "user", user: { id, name, ... } }
     */
    extractAccountInfo: (response) => {
        const workspaceId = response.workspace_id as string;
        const workspaceName = response.workspace_name as string;

        return {
            identifier: workspaceId,
            displayName: workspaceName ?? "Notion Workspace",
        };
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.NOTION_CLIENT_ID;
        if (!id) {
            throw new Error("NOTION_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.NOTION_CLIENT_SECRET;
        if (!secret) {
            throw new Error("NOTION_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * Notion API base URL for direct calls
 */
export const NOTION_API_BASE = "https://api.notion.com/v1";

/**
 * Current Notion API version
 * https://developers.notion.com/reference/versioning
 */
export const NOTION_API_VERSION = "2022-06-28";
