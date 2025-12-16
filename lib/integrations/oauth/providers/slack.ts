/**
 * Slack OAuth Provider Configuration
 *
 * Slack uses standard OAuth 2.0 with user tokens (xoxp-).
 * - Uses OAuth 2.0 authorization code flow
 * - Token response includes team_id, team_name, authed_user
 * - Requires specific scopes for different operations
 * - Access tokens don't expire but can be revoked by user
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const slackProvider: OAuthProviderConfig = {
    id: "slack",

    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/oauth/v2/access",

    // Use user_scope parameter for user tokens (not scope, which is for bot tokens)
    scopeParamName: "user_scope",

    /**
     * Extract tokens from Slack's user token response.
     * For user tokens, Slack returns the access token in authed_user.access_token
     * (not at the root level like most providers).
     */
    extractTokens: (response) => {
        const authedUser = response.authed_user as
            | {
                  access_token: string;
                  token_type?: string;
                  scope?: string;
              }
            | undefined;

        if (!authedUser?.access_token) {
            // No user token in response - might be bot-only response or error
            return null; // Fall back to standard extraction
        }

        return {
            accessToken: authedUser.access_token,
            tokenType: authedUser.token_type ?? "user",
            scope: authedUser.scope,
            // Slack user tokens don't expire
            refreshToken: undefined,
            expiresIn: undefined,
        };
    },

    // Scopes for user token (user operations, not bot)
    // Reference: https://api.slack.com/scopes
    scopes: [
        "channels:read", // View basic channel info
        "channels:history", // View messages in public channels
        "groups:read", // View basic private channel info
        "groups:history", // View messages in private channels
        "im:read", // View basic DM info
        "im:history", // View messages in DMs
        "mpim:read", // View basic group DM info
        "mpim:history", // View messages in group DMs
        "chat:write", // Send messages as user
        "users:read", // View users in workspace
        "users:read.email", // View email addresses
        "reactions:write", // Add emoji reactions
        "files:write", // Upload files
    ],

    /**
     * Extract account info from Slack's token response.
     *
     * Slack returns:
     * - team: { id, name }
     * - authed_user: { id, access_token, token_type, scope }
     * - enterprise: { id, name } (for Enterprise Grid)
     */
    extractAccountInfo: (response) => {
        const team = response.team as { id: string; name: string } | undefined;
        const authedUser = response.authed_user as { id: string } | undefined;

        if (!team || !authedUser) {
            throw new Error("Invalid Slack OAuth response: missing team or user");
        }

        return {
            identifier: `${team.id}:${authedUser.id}`,
            displayName: team.name,
        };
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.SLACK_CLIENT_ID;
        if (!id) {
            throw new Error("SLACK_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.SLACK_CLIENT_SECRET;
        if (!secret) {
            throw new Error("SLACK_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * Slack API base URL for direct calls
 */
export const SLACK_API_BASE = "https://slack.com/api";
