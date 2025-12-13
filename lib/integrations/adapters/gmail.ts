/**
 * Gmail Service Adapter
 *
 * Email management via Gmail API through Nango proxy.
 * Uses Google's "restricted" scope tier - requires verified OAuth app.
 *
 * ## Message Encoding
 * Gmail API requires RFC 2822 formatted messages, base64url encoded.
 * The raw field in send/draft requests must be URL-safe base64.
 *
 * ## Rate Limits
 * - Per-user: 250 quota units per user per second (varies by endpoint)
 * - send: 100 quota units per call
 * - list/get: 5 quota units per call
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Get and validate Nango secret key */
function getNangoSecretKey(): string {
    if (!env.NANGO_SECRET_KEY) {
        throw new Error("Missing required environment variable: NANGO_SECRET_KEY");
    }
    return env.NANGO_SECRET_KEY;
}

/** Encode email to base64url format required by Gmail API */
function encodeEmail(email: string): string {
    return Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/** Build RFC 2822 email from parameters */
function buildRfc2822Email(params: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    inReplyTo?: string;
    references?: string;
    isHtml?: boolean;
}): string {
    const lines: string[] = [];

    lines.push(`To: ${params.to}`);
    if (params.cc) lines.push(`Cc: ${params.cc}`);
    if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
    lines.push(`Subject: ${params.subject}`);
    if (params.replyTo) lines.push(`Reply-To: ${params.replyTo}`);
    if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
    if (params.references) lines.push(`References: ${params.references}`);

    if (params.isHtml) {
        lines.push("Content-Type: text/html; charset=utf-8");
    } else {
        lines.push("Content-Type: text/plain; charset=utf-8");
    }

    lines.push(""); // Empty line between headers and body
    lines.push(params.body);

    return lines.join("\r\n");
}

/** Gmail message format from API */
interface GmailMessage {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    payload?: {
        headers?: Array<{ name: string; value: string }>;
        body?: { data?: string; size?: number };
        parts?: Array<{
            mimeType: string;
            body?: { data?: string; size?: number };
        }>;
    };
    internalDate?: string;
}

/** Gmail thread format from API */
interface GmailThread {
    id: string;
    snippet?: string;
    messages?: GmailMessage[];
}

export class GmailAdapter extends ServiceAdapter {
    serviceName = "gmail";
    serviceDisplayName = "Gmail";

    private getNangoUrl(): string {
        if (!env.NANGO_API_URL) {
            throw new Error("Missing required environment variable: NANGO_API_URL");
        }
        return env.NANGO_API_URL;
    }

    /**
     * Fetch the Gmail account information
     * Used to populate accountIdentifier and accountDisplayName after OAuth
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
            const response = await httpClient
                .get(`${nangoUrl}/proxy/gmail/v1/users/me/profile`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                    },
                })
                .json<{
                    emailAddress: string;
                    messagesTotal?: number;
                    threadsTotal?: number;
                }>();

            return {
                identifier: response.emailAddress,
                displayName: response.emailAddress,
            };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "Failed to fetch Gmail account info"
            );
            throw new ValidationError("Failed to fetch Gmail account information");
        }
    }

    /**
     * Test the OAuth connection by making a live API request
     */
    async testConnection(
        connectionId: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            await httpClient
                .get(`${nangoUrl}/proxy/gmail/v1/users/me/profile`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                    },
                })
                .json<Record<string, unknown>>();

            return { success: true };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "Failed to verify Gmail connection"
            );
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Connection verification failed",
            };
        }
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            commonOperations: ["send_message", "search_messages", "get_message"],
            operations: [
                {
                    name: "send_message",
                    description: "Send an email message",
                    parameters: [
                        {
                            name: "to",
                            type: "string",
                            required: true,
                            description:
                                "Recipient email address(es), comma-separated for multiple",
                            example: "user@example.com",
                        },
                        {
                            name: "subject",
                            type: "string",
                            required: true,
                            description: "Email subject line",
                        },
                        {
                            name: "body",
                            type: "string",
                            required: true,
                            description: "Email body content",
                        },
                        {
                            name: "cc",
                            type: "string",
                            required: false,
                            description: "CC recipient(s), comma-separated",
                        },
                        {
                            name: "bcc",
                            type: "string",
                            required: false,
                            description: "BCC recipient(s), comma-separated",
                        },
                        {
                            name: "is_html",
                            type: "boolean",
                            required: false,
                            description: "Whether body is HTML (default: false)",
                        },
                        {
                            name: "reply_to",
                            type: "string",
                            required: false,
                            description: "Reply-To address",
                        },
                        {
                            name: "thread_id",
                            type: "string",
                            required: false,
                            description: "Thread ID to reply to (for threading)",
                        },
                        {
                            name: "in_reply_to",
                            type: "string",
                            required: false,
                            description: "Message-ID being replied to (for threading)",
                        },
                    ],
                    returns: "Sent message object with message ID and thread ID",
                    example: `send_message({ to: "user@example.com", subject: "Hello", body: "Hi there" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "search_messages",
                    description:
                        "Search Gmail using Gmail search syntax (from:, to:, subject:, is:unread, etc.)",
                    parameters: [
                        {
                            name: "q",
                            type: "string",
                            required: true,
                            description:
                                "Gmail search query (e.g., 'from:user@example.com is:unread')",
                            example: "is:unread from:boss",
                        },
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Max results to return (default: 10, max: 100)",
                        },
                        {
                            name: "include_spam_trash",
                            type: "boolean",
                            required: false,
                            description:
                                "Include spam and trash in results (default: false)",
                        },
                    ],
                    returns: "List of message summaries matching the search",
                    example: `search_messages({ q: "from:boss is:unread", max_results: 5 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_message",
                    description: "Get full content of a specific message by ID",
                    parameters: [
                        {
                            name: "message_id",
                            type: "string",
                            required: true,
                            description: "Message ID to retrieve",
                        },
                        {
                            name: "format",
                            type: "string",
                            required: false,
                            description:
                                "Response format: 'full', 'metadata', 'minimal' (default: 'full')",
                        },
                    ],
                    returns: "Full message content including headers and body",
                    example: `get_message({ message_id: "18abc123def" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_threads",
                    description: "List email threads (conversations)",
                    parameters: [
                        {
                            name: "q",
                            type: "string",
                            required: false,
                            description: "Search query to filter threads",
                        },
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Max threads to return (default: 10, max: 100)",
                        },
                        {
                            name: "label_ids",
                            type: "array",
                            required: false,
                            description:
                                "Filter by label IDs (e.g., ['INBOX', 'UNREAD'])",
                        },
                    ],
                    returns: "List of threads with snippet preview",
                    example: `list_threads({ q: "is:unread", max_results: 10 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_thread",
                    description: "Get all messages in a thread",
                    parameters: [
                        {
                            name: "thread_id",
                            type: "string",
                            required: true,
                            description: "Thread ID to retrieve",
                        },
                        {
                            name: "format",
                            type: "string",
                            required: false,
                            description:
                                "Message format: 'full', 'metadata', 'minimal' (default: 'full')",
                        },
                    ],
                    returns: "Thread with all messages",
                    example: `get_thread({ thread_id: "18abc123def" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "create_draft",
                    description: "Create an email draft without sending",
                    parameters: [
                        {
                            name: "to",
                            type: "string",
                            required: true,
                            description: "Recipient email address(es)",
                        },
                        {
                            name: "subject",
                            type: "string",
                            required: true,
                            description: "Email subject line",
                        },
                        {
                            name: "body",
                            type: "string",
                            required: true,
                            description: "Email body content",
                        },
                        {
                            name: "cc",
                            type: "string",
                            required: false,
                            description: "CC recipient(s)",
                        },
                        {
                            name: "is_html",
                            type: "boolean",
                            required: false,
                            description: "Whether body is HTML",
                        },
                    ],
                    returns: "Created draft object with draft ID",
                    example: `create_draft({ to: "user@example.com", subject: "Draft", body: "Content" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "list_labels",
                    description: "List all Gmail labels (inbox, sent, custom labels)",
                    parameters: [],
                    returns: "List of labels with IDs and names",
                    example: `list_labels()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "modify_labels",
                    description: "Add or remove labels from a message",
                    parameters: [
                        {
                            name: "message_id",
                            type: "string",
                            required: true,
                            description: "Message ID to modify",
                        },
                        {
                            name: "add_labels",
                            type: "array",
                            required: false,
                            description: "Label IDs to add",
                            example: '["STARRED", "IMPORTANT"]',
                        },
                        {
                            name: "remove_labels",
                            type: "array",
                            required: false,
                            description: "Label IDs to remove",
                            example: '["UNREAD"]',
                        },
                    ],
                    returns: "Updated message with new labels",
                    example: `modify_labels({ message_id: "18abc", add_labels: ["STARRED"], remove_labels: ["UNREAD"] })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "raw_api",
                    description:
                        "Direct access to Gmail API for operations not covered above. " +
                        "Consult https://developers.google.com/gmail/api/reference/rest for endpoints.",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Gmail API endpoint (e.g., '/gmail/v1/users/me/messages')",
                            example: "/gmail/v1/users/me/messages",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, DELETE, PATCH)",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description: "Request body for POST/PUT/PATCH",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters",
                        },
                    ],
                    returns: "Raw Gmail API response",
                    example: `raw_api({ endpoint: "/gmail/v1/users/me/labels", method: "GET" })`,
                },
            ],
            docsUrl: "https://developers.google.com/gmail/api/reference/rest",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(`Gmail adapter validation failed for action '${action}':`, {
                errors: validation.errors,
            });
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No Gmail connection found. Please connect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/gmail`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        try {
            switch (action) {
                case "send_message":
                    return await this.handleSendMessage(params, connectionId);
                case "search_messages":
                    return await this.handleSearchMessages(params, connectionId);
                case "get_message":
                    return await this.handleGetMessage(params, connectionId);
                case "list_threads":
                    return await this.handleListThreads(params, connectionId);
                case "get_thread":
                    return await this.handleGetThread(params, connectionId);
                case "create_draft":
                    return await this.handleCreateDraft(params, connectionId);
                case "list_labels":
                    return await this.handleListLabels(connectionId);
                case "modify_labels":
                    return await this.handleModifyLabels(params, connectionId);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(`Gmail adapter failed: ${action}`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });

            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            let errorMessage = `Failed to ${action}: `;
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage += "Message or thread not found.";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage +=
                        "Authentication failed. Your Gmail connection may have expired. " +
                        `Please reconnect at: ${env.NEXT_PUBLIC_APP_URL}/integrations/gmail`;
                } else if (error.message.includes("429")) {
                    errorMessage += "Rate limit exceeded. Please try again shortly.";
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    private async handleSendMessage(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            to,
            subject,
            body,
            cc,
            bcc,
            is_html,
            reply_to,
            thread_id,
            in_reply_to,
        } = params as {
            to: string;
            subject: string;
            body: string;
            cc?: string;
            bcc?: string;
            is_html?: boolean;
            reply_to?: string;
            thread_id?: string;
            in_reply_to?: string;
        };

        const email = buildRfc2822Email({
            to,
            subject,
            body,
            cc,
            bcc,
            replyTo: reply_to,
            inReplyTo: in_reply_to,
            isHtml: is_html,
        });

        const encodedEmail = encodeEmail(email);
        const nangoSecretKey = getNangoSecretKey();

        const requestBody: { raw: string; threadId?: string } = { raw: encodedEmail };
        if (thread_id) {
            requestBody.threadId = thread_id;
        }

        const response = await httpClient
            .post(`${this.getNangoUrl()}/proxy/gmail/v1/users/me/messages/send`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "gmail",
                    "Content-Type": "application/json",
                },
                json: requestBody,
            })
            .json<{ id: string; threadId: string; labelIds?: string[] }>();

        return this.createJSONResponse({
            success: true,
            message_id: response.id,
            thread_id: response.threadId,
            labels: response.labelIds,
        });
    }

    private async handleSearchMessages(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            q,
            max_results = 10,
            include_spam_trash = false,
        } = params as {
            q: string;
            max_results?: number;
            include_spam_trash?: boolean;
        };

        const nangoSecretKey = getNangoSecretKey();
        const searchParams = new URLSearchParams({
            q,
            maxResults: String(Math.min(max_results, 100)),
            includeSpamTrash: String(include_spam_trash),
        });

        const listResponse = await httpClient
            .get(
                `${this.getNangoUrl()}/proxy/gmail/v1/users/me/messages?${searchParams}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                    },
                }
            )
            .json<{
                messages?: Array<{ id: string; threadId: string }>;
                resultSizeEstimate?: number;
            }>();

        if (!listResponse.messages || listResponse.messages.length === 0) {
            return this.createJSONResponse({
                messages: [],
                total_estimate: 0,
            });
        }

        // Fetch metadata for each message
        const messages = await Promise.all(
            listResponse.messages.slice(0, max_results).map(async (msg) => {
                const detail = await httpClient
                    .get(
                        `${this.getNangoUrl()}/proxy/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
                        {
                            headers: {
                                Authorization: `Bearer ${nangoSecretKey}`,
                                "Connection-Id": connectionId,
                                "Provider-Config-Key": "gmail",
                            },
                        }
                    )
                    .json<GmailMessage>();

                const headers = detail.payload?.headers ?? [];
                const getHeader = (name: string) =>
                    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
                        ?.value;

                return {
                    id: detail.id,
                    thread_id: detail.threadId,
                    subject: getHeader("subject"),
                    from: getHeader("from"),
                    to: getHeader("to"),
                    date: getHeader("date"),
                    snippet: detail.snippet,
                    labels: detail.labelIds,
                };
            })
        );

        return this.createJSONResponse({
            messages,
            total_estimate: listResponse.resultSizeEstimate,
        });
    }

    private async handleGetMessage(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { message_id, format = "full" } = params as {
            message_id: string;
            format?: string;
        };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(
                `${this.getNangoUrl()}/proxy/gmail/v1/users/me/messages/${message_id}?format=${format}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                    },
                }
            )
            .json<GmailMessage>();

        const headers = response.payload?.headers ?? [];
        const getHeader = (name: string) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

        // Extract body content
        let bodyContent = "";
        if (response.payload?.body?.data) {
            bodyContent = Buffer.from(response.payload.body.data, "base64").toString(
                "utf-8"
            );
        } else if (response.payload?.parts) {
            // Multi-part message - prefer text/plain, fallback to text/html
            const textPart = response.payload.parts.find(
                (p) => p.mimeType === "text/plain"
            );
            const htmlPart = response.payload.parts.find(
                (p) => p.mimeType === "text/html"
            );
            const part = textPart ?? htmlPart;
            if (part?.body?.data) {
                bodyContent = Buffer.from(part.body.data, "base64").toString("utf-8");
            }
        }

        return this.createJSONResponse({
            id: response.id,
            thread_id: response.threadId,
            subject: getHeader("subject"),
            from: getHeader("from"),
            to: getHeader("to"),
            cc: getHeader("cc"),
            date: getHeader("date"),
            snippet: response.snippet,
            body: bodyContent,
            labels: response.labelIds,
        });
    }

    private async handleListThreads(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            q,
            max_results = 10,
            label_ids,
        } = params as {
            q?: string;
            max_results?: number;
            label_ids?: string[];
        };

        const nangoSecretKey = getNangoSecretKey();
        const searchParams = new URLSearchParams({
            maxResults: String(Math.min(max_results, 100)),
        });
        if (q) searchParams.set("q", q);
        if (label_ids) {
            label_ids.forEach((id) => searchParams.append("labelIds", id));
        }

        const response = await httpClient
            .get(
                `${this.getNangoUrl()}/proxy/gmail/v1/users/me/threads?${searchParams}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                    },
                }
            )
            .json<{
                threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
                resultSizeEstimate?: number;
            }>();

        return this.createJSONResponse({
            threads:
                response.threads?.map((t) => ({
                    id: t.id,
                    snippet: t.snippet,
                })) ?? [],
            total_estimate: response.resultSizeEstimate,
        });
    }

    private async handleGetThread(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { thread_id, format = "full" } = params as {
            thread_id: string;
            format?: string;
        };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(
                `${this.getNangoUrl()}/proxy/gmail/v1/users/me/threads/${thread_id}?format=${format}`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                    },
                }
            )
            .json<GmailThread>();

        const messages = response.messages?.map((msg) => {
            const headers = msg.payload?.headers ?? [];
            const getHeader = (name: string) =>
                headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

            return {
                id: msg.id,
                subject: getHeader("subject"),
                from: getHeader("from"),
                to: getHeader("to"),
                date: getHeader("date"),
                snippet: msg.snippet,
                labels: msg.labelIds,
            };
        });

        return this.createJSONResponse({
            id: response.id,
            snippet: response.snippet,
            messages: messages ?? [],
        });
    }

    private async handleCreateDraft(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { to, subject, body, cc, is_html } = params as {
            to: string;
            subject: string;
            body: string;
            cc?: string;
            is_html?: boolean;
        };

        const email = buildRfc2822Email({
            to,
            subject,
            body,
            cc,
            isHtml: is_html,
        });

        const encodedEmail = encodeEmail(email);
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .post(`${this.getNangoUrl()}/proxy/gmail/v1/users/me/drafts`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "gmail",
                    "Content-Type": "application/json",
                },
                json: {
                    message: { raw: encodedEmail },
                },
            })
            .json<{ id: string; message: { id: string; threadId: string } }>();

        return this.createJSONResponse({
            success: true,
            draft_id: response.id,
            message_id: response.message.id,
            thread_id: response.message.threadId,
        });
    }

    private async handleListLabels(connectionId: string): Promise<MCPToolResponse> {
        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/gmail/v1/users/me/labels`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "gmail",
                },
            })
            .json<{
                labels: Array<{
                    id: string;
                    name: string;
                    type: string;
                    messagesTotal?: number;
                    messagesUnread?: number;
                }>;
            }>();

        return this.createJSONResponse({
            labels: response.labels.map((l) => ({
                id: l.id,
                name: l.name,
                type: l.type,
                messages_total: l.messagesTotal,
                messages_unread: l.messagesUnread,
            })),
        });
    }

    private async handleModifyLabels(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { message_id, add_labels, remove_labels } = params as {
            message_id: string;
            add_labels?: string[];
            remove_labels?: string[];
        };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .post(
                `${this.getNangoUrl()}/proxy/gmail/v1/users/me/messages/${message_id}/modify`,
                {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "gmail",
                        "Content-Type": "application/json",
                    },
                    json: {
                        addLabelIds: add_labels ?? [],
                        removeLabelIds: remove_labels ?? [],
                    },
                }
            )
            .json<{ id: string; threadId: string; labelIds: string[] }>();

        return this.createJSONResponse({
            success: true,
            message_id: response.id,
            thread_id: response.threadId,
            labels: response.labelIds,
        });
    }

    /**
     * Execute a raw Gmail API request
     */
    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse("raw_api requires 'endpoint' parameter");
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST, PUT, DELETE, PATCH)"
            );
        }

        // Validate endpoint starts with /gmail/v1
        if (!endpoint.startsWith("/gmail/v1")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/gmail/v1'. " +
                    `Got: ${endpoint}. Example: '/gmail/v1/users/me/messages'`
            );
        }

        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No Gmail connection found. Please connect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/gmail`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "gmail",
            },
        };

        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
            requestOptions.json = body;
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "put"
                | "delete"
                | "patch";
            const fullUrl = `${nangoUrl}/proxy${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            return this.createJSONResponse(response);
        } catch (error) {
            logger.error(
                {
                    endpoint,
                    method,
                    userId,
                    error: error instanceof Error ? error.message : String(error),
                },
                "Gmail raw API request failed"
            );

            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            let errorMessage = "Raw API request failed: ";
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the Gmail API docs: " +
                        "https://developers.google.com/gmail/api/reference/rest";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage +=
                        "Authentication failed. Please reconnect at: " +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/gmail`;
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }
}
