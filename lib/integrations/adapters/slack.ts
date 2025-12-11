/**
 * Slack Service Adapter
 *
 * Uses user tokens (xoxp-) via Nango proxy to post messages as the authenticated user.
 * Messages appear as coming from the user, not a bot. User must have access to channels
 * to read/write - "not_in_channel" errors mean the user isn't a channel member.
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Constants for Slack API limits
const MAX_MESSAGES_FETCH = 100;
const MAX_CHANNELS_LIST = 200;

/** Get and validate Nango secret key */
function getNangoSecretKey(): string {
    if (!env.NANGO_SECRET_KEY) {
        throw new Error("Missing required environment variable: NANGO_SECRET_KEY");
    }
    return env.NANGO_SECRET_KEY;
}

export class SlackAdapter extends ServiceAdapter {
    serviceName = "slack";
    serviceDisplayName = "Slack";

    private getNangoUrl(): string {
        if (!env.NANGO_API_URL) {
            throw new Error("Missing required environment variable: NANGO_API_URL");
        }
        return env.NANGO_API_URL;
    }

    /**
     * Fetch the Slack workspace and user information
     * Used to populate accountIdentifier and accountDisplayName after OAuth
     *
     * @param connectionId - Nango connection ID (required for OAuth webhook flow)
     * @param userId - User ID (optional, only used for logging)
     */
    async fetchAccountInfo(
        connectionId: string,
        userId?: string
    ): Promise<{
        identifier: string;
        displayName: string;
    }> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            // Get authenticated user info
            const userResponse = await httpClient
                .get(`${nangoUrl}/proxy/auth.test`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "slack",
                    },
                })
                .json<{
                    ok: boolean;
                    user: string;
                    user_id: string;
                    team: string;
                    team_id: string;
                }>();

            if (!userResponse.ok) {
                throw new ValidationError("Failed to authenticate with Slack");
            }

            return {
                identifier: `${userResponse.team} (${userResponse.user})`,
                displayName: `${userResponse.team} workspace`,
            };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "❌ Failed to fetch Slack account info"
            );
            throw new ValidationError("Failed to fetch Slack account information");
        }
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            operations: [
                {
                    name: "list_channels",
                    description: "List channels in your Slack workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "types",
                            type: "string",
                            required: false,
                            description:
                                "Comma-separated channel types: public_channel, private_channel, mpim, im (default: public_channel)",
                            example: "public_channel,private_channel",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of channels to return (default: 100)",
                            example: "50",
                        },
                    ],
                    returns: "List of channels with names, IDs, and member counts",
                    example: `list_channels({ types: "public_channel,private_channel" })`,
                },
                {
                    name: "get_channel_history",
                    description:
                        "Get messages from a channel or DM. NOTE: If this fails with 'not_in_channel', the user must join the channel first (user tokens only access channels the user is a member of).",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "channel",
                            type: "string",
                            required: true,
                            description: "Channel ID (e.g., C1234567890)",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Number of messages to fetch (default: 50, max: 100)",
                            example: "25",
                        },
                    ],
                    returns: "List of messages with sender, timestamp, and content",
                },
                {
                    name: "get_thread_replies",
                    description:
                        "Get replies to a specific message thread. NOTE: User must be a member of the channel to access thread replies.",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "channel",
                            type: "string",
                            required: true,
                            description: "Channel ID",
                        },
                        {
                            name: "thread_ts",
                            type: "string",
                            required: true,
                            description: "Timestamp of the parent message",
                        },
                    ],
                    returns: "Thread messages with replies",
                },
                {
                    name: "send_message",
                    description: "Send a message to a channel or DM",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "channel",
                            type: "string",
                            required: true,
                            description: "Channel ID or user ID for DM",
                        },
                        {
                            name: "text",
                            type: "string",
                            required: true,
                            description: "Message text (supports Slack formatting)",
                        },
                        {
                            name: "thread_ts",
                            type: "string",
                            required: false,
                            description: "Reply to a specific thread (timestamp)",
                        },
                    ],
                    returns: "Sent message details including timestamp",
                },
                {
                    name: "get_user_info",
                    description: "Get information about a Slack user",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "user",
                            type: "string",
                            required: true,
                            description: "User ID (e.g., U1234567890)",
                        },
                    ],
                    returns: "User profile including name, email, and status",
                },
                {
                    name: "list_users",
                    description: "List users in your Slack workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Maximum number of users (default: 100)",
                            example: "50",
                        },
                    ],
                    returns: "List of workspace members",
                },
                {
                    name: "add_reaction",
                    description:
                        "Add an emoji reaction to a message. NOTE: User must be a member of the channel to add reactions.",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "channel",
                            type: "string",
                            required: true,
                            description: "Channel ID",
                        },
                        {
                            name: "timestamp",
                            type: "string",
                            required: true,
                            description: "Message timestamp",
                        },
                        {
                            name: "name",
                            type: "string",
                            required: true,
                            description: "Emoji name (without colons)",
                            example: "thumbsup",
                        },
                    ],
                    returns: "Confirmation of reaction added",
                },
                {
                    name: "upload_file",
                    description: "Upload a file to a channel or DM",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "channels",
                            type: "string",
                            required: true,
                            description: "Comma-separated channel IDs",
                        },
                        {
                            name: "content",
                            type: "string",
                            required: true,
                            description: "File content (text)",
                        },
                        {
                            name: "filename",
                            type: "string",
                            required: true,
                            description: "File name",
                        },
                        {
                            name: "title",
                            type: "string",
                            required: false,
                            description: "File title",
                        },
                    ],
                    returns: "Uploaded file details",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Slack API - you can perform nearly any operation supported by Slack. " +
                        "If you're familiar with the Slack API structure, construct the request directly. " +
                        "If unsure/errors: try context7 (/websites/slack_dev_reference_methods) or https://api.slack.com/methods",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Slack API method name (e.g., 'users.list', 'chat.postMessage', 'conversations.create')",
                            example: "chat.postMessage",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST)",
                            example: "POST",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description:
                                "Request body for POST requests. Structure depends on the method - " +
                                "for example, chat.postMessage requires channel and text fields. " +
                                "Use the Slack API structure you're familiar with, or consult the documentation if needed.",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw Slack API response as JSON",
                    example: `raw_api({ endpoint: "users.profile.get", method: "GET", query: { user: "U123456" } })`,
                },
            ],
            commonOperations: ["list_channels", "get_channel_history", "send_message"],
            docsUrl: "https://api.slack.com/methods",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userEmail: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `❌ [SLACK ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's Slack connection
        const credentials = await getCredentials(
            userEmail,
            this.serviceName,
            accountId
        );

        if (!credentials?.connectionId) {
            this.logInfo(
                `📝 [SLACK ADAPTER] User ${userEmail} attempted to use Slack but no connection found`
            );
            return this.createErrorResponse(this.createNotConnectedError());
        }

        // Route to appropriate handler
        try {
            switch (action) {
                case "list_channels":
                    return await this.handleListChannels(
                        params,
                        credentials.connectionId
                    );
                case "get_channel_history":
                    return await this.handleGetChannelHistory(
                        params,
                        credentials.connectionId
                    );
                case "get_thread_replies":
                    return await this.handleGetThreadReplies(
                        params,
                        credentials.connectionId
                    );
                case "send_message":
                    return await this.handleSendMessage(
                        params,
                        credentials.connectionId
                    );
                case "get_user_info":
                    return await this.handleGetUserInfo(
                        params,
                        credentials.connectionId
                    );
                case "list_users":
                    return await this.handleListUsers(params, credentials.connectionId);
                case "add_reaction":
                    return await this.handleAddReaction(
                        params,
                        credentials.connectionId
                    );
                case "upload_file":
                    return await this.handleUploadFile(
                        params,
                        credentials.connectionId
                    );
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userEmail,
                        accountId
                    );
                default:
                    this.logError(
                        `❌ [SLACK ADAPTER] Unknown action '${action}' requested by user ${userEmail}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            // Comprehensive error logging
            this.logError(
                `❌ [SLACK ADAPTER] Failed to execute ${action} for user ${userEmail}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                    connectionId: credentials.connectionId,
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId: userEmail,
            });

            // User-friendly error message
            return this.createErrorResponse(this.handleCommonAPIError(error, action));
        }
    }

    private async handleListChannels(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { types = "public_channel", limit = 100 } = params as {
            types?: string;
            limit?: number;
        };

        this.logInfo(`📋 [SLACK] Listing channels, types: ${types}, limit: ${limit}`);

        const cappedLimit = Math.min(Math.max(1, limit || 100), MAX_CHANNELS_LIST);

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/conversations.list`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                },
                searchParams: {
                    types,
                    limit: cappedLimit.toString(),
                    exclude_archived: "true",
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                channels?: Array<{
                    id: string;
                    name: string;
                    is_channel: boolean;
                    is_group: boolean;
                    is_im: boolean;
                    is_mpim: boolean;
                    is_private: boolean;
                    num_members?: number;
                    topic?: { value: string };
                    purpose?: { value: string };
                }>;
            }>();

        if (!response.ok || !response.channels) {
            const errorMsg = `Failed to fetch channels from Slack${response.error ? `: ${response.error}` : ""}`;
            return this.createErrorResponse(errorMsg);
        }

        this.logInfo(`✅ [SLACK] Retrieved ${response.channels.length} channels`);

        const channelsList = response.channels.map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.is_im
                ? "DM"
                : ch.is_mpim
                  ? "Group DM"
                  : ch.is_private
                    ? "Private"
                    : "Public",
            members: ch.num_members || 0,
            topic: ch.topic?.value || "",
            purpose: ch.purpose?.value || "",
        }));

        return this.createJSONResponse({
            channels: channelsList,
            count: channelsList.length,
        });
    }

    private async handleGetChannelHistory(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { channel, limit = 50 } = params as {
            channel: string;
            limit?: number;
        };

        if (!channel || typeof channel !== "string") {
            throw new ValidationError("Channel ID is required");
        }

        this.logInfo(`📥 [SLACK] Fetching history for channel ${channel}`);

        const cappedLimit = Math.min(Math.max(1, limit || 50), MAX_MESSAGES_FETCH);

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/conversations.history`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                },
                searchParams: {
                    channel,
                    limit: cappedLimit.toString(),
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                messages?: Array<{
                    type: string;
                    user?: string;
                    text: string;
                    ts: string;
                    thread_ts?: string;
                    reply_count?: number;
                }>;
            }>();

        if (!response.ok) {
            const errorMsg =
                response.error === "not_in_channel"
                    ? `Cannot access channel history. You must join channel ${channel} in Slack to read its messages.`
                    : `Failed to fetch channel history${response.error ? `: ${response.error}` : ""}`;
            return this.createErrorResponse(errorMsg);
        }

        this.logInfo(`✅ [SLACK] Retrieved ${response.messages?.length || 0} messages`);

        return this.createJSONResponse({
            channel,
            messages: response.messages || [],
            count: response.messages?.length || 0,
        });
    }

    private async handleGetThreadReplies(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { channel, thread_ts } = params as {
            channel: string;
            thread_ts: string;
        };

        if (!channel || !thread_ts) {
            throw new ValidationError("Channel ID and thread_ts are required");
        }

        this.logInfo(`🧵 [SLACK] Fetching thread ${thread_ts} in channel ${channel}`);

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/conversations.replies`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                },
                searchParams: {
                    channel,
                    ts: thread_ts,
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                messages?: Array<{
                    type: string;
                    user?: string;
                    text: string;
                    ts: string;
                }>;
            }>();

        if (!response.ok) {
            const errorMsg =
                response.error === "not_in_channel"
                    ? `Cannot access thread replies. You must join channel ${channel} in Slack to read thread replies.`
                    : `Failed to fetch thread replies${response.error ? `: ${response.error}` : ""}`;
            return this.createErrorResponse(errorMsg);
        }

        this.logInfo(
            `✅ [SLACK] Retrieved ${response.messages?.length || 0} thread messages`
        );

        return this.createJSONResponse({
            channel,
            thread_ts,
            messages: response.messages || [],
        });
    }

    private async handleSendMessage(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { channel, text, thread_ts } = params as {
            channel: string;
            text: string;
            thread_ts?: string;
        };

        if (!channel || !text) {
            throw new ValidationError("Channel and text are required");
        }

        this.logInfo(`📤 [SLACK] Sending message to channel ${channel}`);

        const body: Record<string, string> = {
            channel,
            text,
        };

        if (thread_ts) {
            body.thread_ts = thread_ts;
        }

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .post(`${this.getNangoUrl()}/proxy/chat.postMessage`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json: body,
            })
            .json<{
                ok: boolean;
                error?: string;
                ts?: string;
                channel?: string;
                message?: {
                    text: string;
                    user: string;
                };
            }>();

        if (!response.ok) {
            return this.createErrorResponse(
                `Failed to send message${response.error ? `: ${response.error}` : ""}`
            );
        }

        this.logInfo(`✅ [SLACK] Message sent, ts: ${response.ts}`);

        return this.createJSONResponse({
            success: true,
            ts: response.ts,
            channel: response.channel,
        });
    }

    private async handleGetUserInfo(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { user } = params as { user: string };

        if (!user) {
            throw new ValidationError("User ID is required");
        }

        this.logInfo(`👤 [SLACK] Fetching user info for ${user}`);

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/users.info`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                },
                searchParams: {
                    user,
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                user?: {
                    id: string;
                    name: string;
                    real_name: string;
                    profile: {
                        email?: string;
                        title?: string;
                        phone?: string;
                        status_text?: string;
                        status_emoji?: string;
                    };
                };
            }>();

        if (!response.ok || !response.user) {
            return this.createErrorResponse(
                `Failed to fetch user info${response.error ? `: ${response.error}` : ""}`
            );
        }

        this.logInfo(`✅ [SLACK] Retrieved info for user ${response.user.name}`);

        return this.createJSONResponse({
            id: response.user.id,
            name: response.user.name,
            real_name: response.user.real_name,
            email: response.user.profile.email,
            title: response.user.profile.title,
            status: response.user.profile.status_text,
        });
    }

    private async handleListUsers(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { limit = 100 } = params as { limit?: number };

        this.logInfo(`👥 [SLACK] Listing users, limit: ${limit}`);

        const cappedLimit = Math.min(Math.max(1, limit || 100), 1000);

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/users.list`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                },
                searchParams: {
                    limit: cappedLimit.toString(),
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                members?: Array<{
                    id: string;
                    name: string;
                    real_name: string;
                    is_bot: boolean;
                    deleted: boolean;
                    profile: {
                        email?: string;
                        title?: string;
                    };
                }>;
            }>();

        if (!response.ok || !response.members) {
            throw new ValidationError(
                `Failed to list users${response.error ? `: ${response.error}` : ""}`
            );
        }

        // Filter out bots and deleted users
        const activeUsers = response.members.filter(
            (user) => !user.is_bot && !user.deleted
        );

        this.logInfo(
            `✅ [SLACK] Retrieved ${activeUsers.length} active users (${response.members.length} total)`
        );

        return this.createJSONResponse({
            users: activeUsers.map((u) => ({
                id: u.id,
                name: u.name,
                real_name: u.real_name,
                email: u.profile.email,
                title: u.profile.title,
            })),
            count: activeUsers.length,
        });
    }

    private async handleAddReaction(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { channel, timestamp, name } = params as {
            channel: string;
            timestamp: string;
            name: string;
        };

        if (!channel || !timestamp || !name) {
            throw new ValidationError(
                "Channel, timestamp, and emoji name are required"
            );
        }

        this.logInfo(`👍 [SLACK] Adding reaction :${name}: to message ${timestamp}`);

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .post(`${this.getNangoUrl()}/proxy/reactions.add`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json: {
                    channel,
                    timestamp,
                    name,
                },
            })
            .json<{ ok: boolean; error?: string }>();

        if (!response.ok) {
            const errorMsg =
                response.error === "not_in_channel"
                    ? `Cannot add reaction. You must join channel ${channel} in Slack to add reactions.`
                    : `Failed to add reaction${response.error ? `: ${response.error}` : ""}`;
            return this.createErrorResponse(errorMsg);
        }

        this.logInfo(`✅ [SLACK] Reaction :${name}: added successfully`);

        return this.createSuccessResponse(
            `Added reaction :${name}: to message ${timestamp}`
        );
    }

    private async handleUploadFile(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { channels, content, filename, title } = params as {
            channels: string;
            content: string;
            filename: string;
            title?: string;
        };

        if (!channels || !content || !filename) {
            throw new ValidationError("Channels, content, and filename are required");
        }

        this.logInfo(`📎 [SLACK] Uploading file ${filename} to ${channels}`);

        const nangoSecretKey = getNangoSecretKey();

        // Slack's new file upload flow (files.upload is deprecated as of 2023).
        // 3-step process: get upload URL, upload content, complete upload

        // Step 1: Get upload URL
        const uploadUrlResponse = await httpClient
            .post(`${this.getNangoUrl()}/proxy/files.getUploadURLExternal`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json: {
                    filename,
                    length: content.length,
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                upload_url?: string;
                file_id?: string;
            }>();

        if (!uploadUrlResponse.ok) {
            return this.createErrorResponse(
                `Failed to get upload URL${uploadUrlResponse.error ? `: ${uploadUrlResponse.error}` : ""}`
            );
        }

        // Step 2: Upload file content to the URL
        if (!uploadUrlResponse.upload_url) {
            throw new ValidationError("No upload URL returned from Slack");
        }
        await httpClient.post(uploadUrlResponse.upload_url, {
            headers: {
                "Content-Type": "text/plain",
            },
            body: content,
        });

        // Step 3: Complete the upload
        if (!uploadUrlResponse.file_id) {
            throw new ValidationError("No file ID returned from Slack");
        }
        const completeResponse = await httpClient
            .post(`${this.getNangoUrl()}/proxy/files.completeUploadExternal`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "slack",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json: {
                    files: [
                        {
                            id: uploadUrlResponse.file_id,
                            title: title || filename,
                        },
                    ],
                    channel_id: channels,
                },
            })
            .json<{
                ok: boolean;
                error?: string;
                files?: Array<{
                    id: string;
                    title: string;
                }>;
            }>();

        if (!completeResponse.ok) {
            throw new ValidationError(
                `Failed to complete file upload${completeResponse.error ? `: ${completeResponse.error}` : ""}`
            );
        }

        this.logInfo(`✅ [SLACK] File uploaded: ${uploadUrlResponse.file_id}`);

        return this.createJSONResponse({
            success: true,
            file_id: uploadUrlResponse.file_id,
            filename,
            title: title || filename,
        });
    }

    /**
     * Execute a raw Slack API request
     * This provides an escape hatch for operations not covered by standard actions
     */
    async executeRawAPI(
        params: RawAPIParams,
        userEmail: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        // Validate parameters
        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST)"
            );
        }

        // Get user connection
        const credentials = await getCredentials(
            userEmail,
            this.serviceName,
            accountId
        );

        if (!credentials?.connectionId) {
            return this.createErrorResponse(this.createNotConnectedError());
        }

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        this.logInfo(`🔧 [SLACK] Raw API call: ${method} ${endpoint}`);

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": credentials.connectionId,
                "Provider-Config-Key": "slack",
            },
        };

        // Add query parameters if provided
        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        // Add body for POST
        if (method.toUpperCase() === "POST") {
            requestOptions.headers["Content-Type"] = "application/json; charset=utf-8";
            if (body) {
                requestOptions.json = body;
            }
        }

        try {
            const httpMethod = method.toLowerCase() as "get" | "post";
            const fullUrl = `${nangoUrl}/proxy/${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            this.logInfo(`✅ [SLACK] Raw API call successful`);

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `❌ [SLACK ADAPTER] Raw API request failed for user ${userEmail}:`,
                {
                    endpoint,
                    method,
                    error: error instanceof Error ? error.message : String(error),
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId: userEmail,
            });

            return this.createErrorResponse(
                this.handleCommonAPIError(error, "raw_api")
            );
        }
    }
}
