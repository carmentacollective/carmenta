/**
 * Limitless Service Adapter
 *
 * Lifelogs (Pendant recordings) and AI Chats via API key (X-API-Key header).
 *
 * ## Code-Relevant Details
 * - Some responses nest data in { data: { lifelogs: [...] } } structure
 * - search uses 'search' query param on /lifelogs, not a separate endpoint
 * - download_audio requires Unix timestamps in milliseconds (startMs, endMs)
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { httpClient } from "@/lib/http-client";

const LIMITLESS_API_BASE = "https://api.limitless.ai/v1";

export class LimitlessAdapter extends ServiceAdapter {
    serviceName = "limitless";
    serviceDisplayName = "Limitless";

    /**
     * Test the API key by making a lightweight API call
     * Uses the /v1/lifelogs endpoint with limit=1 to verify authentication
     */
    async testConnection(
        apiKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return await this.testApiKeyWithEndpoint(
            apiKey,
            `${LIMITLESS_API_BASE}/lifelogs?limit=1`,
            "X-API-Key",
            (k) => k // No prefix, just the key itself
        );
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description:
                "Access conversations recorded by Limitless Pendant. " +
                "IMPORTANT: Use 'search' for topic-based queries (what did I discuss about X?). " +
                "Use 'list_recordings' with date filter for time-based queries (what did I talk about yesterday?). " +
                "Both return summaries - only use get_lifelog if you need the full transcript.",
            operations: [
                {
                    name: "search",
                    description:
                        "Primary action for finding conversations by topic. Returns summaries - no need to fetch each recording.",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "Natural language search query to find relevant Lifelogs",
                            example: "meetings about project alpha",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum results (default: 10). Keep low - summaries are included.",
                            example: "5",
                        },
                        {
                            name: "date",
                            type: "string",
                            required: false,
                            description:
                                "Filter to a specific date (YYYY-MM-DD). Use for 'yesterday', 'last Monday', etc.",
                            example: "2024-01-15",
                        },
                    ],
                    returns:
                        "Lifelogs with summaries and timestamps. Use these summaries directly - don't fetch each one.",
                    example: `search({ query: "project updates", date: "2024-12-13", limit: 5 })`,
                },
                {
                    name: "list_recordings",
                    description:
                        "List recordings for a time period. ALWAYS use date/start/end filters. Returns summaries.",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "date",
                            type: "string",
                            required: false,
                            description:
                                "Filter to a specific date (YYYY-MM-DD). RECOMMENDED for time-based queries.",
                            example: "2024-01-15",
                        },
                        {
                            name: "start",
                            type: "string",
                            required: false,
                            description:
                                "Start datetime (YYYY-MM-DD or YYYY-MM-DD HH:mm:SS)",
                            example: "2024-01-01 09:00:00",
                        },
                        {
                            name: "end",
                            type: "string",
                            required: false,
                            description:
                                "End datetime (YYYY-MM-DD or YYYY-MM-DD HH:mm:SS)",
                            example: "2024-01-01 17:00:00",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum results (default: 10). Summaries included - keep low.",
                            example: "10",
                        },
                    ],
                    returns:
                        "Lifelogs with summaries. Synthesize from these - don't fetch each individually.",
                },
                {
                    name: "get_lifelog",
                    description:
                        "Get FULL content of ONE recording. Only use when user needs transcript/deep details on a specific conversation.",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "lifelogId",
                            type: "string",
                            required: true,
                            description: "The ID of the Lifelog to retrieve",
                        },
                    ],
                    returns:
                        "Full details: summary, markdown, transcript, headings. Use sparingly.",
                },
                {
                    name: "get_transcript",
                    description: "Get full transcript of a Lifelog",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "lifelogId",
                            type: "string",
                            required: true,
                            description: "The ID of the Lifelog",
                        },
                    ],
                    returns: "Full transcript text of the Lifelog entry",
                },
                {
                    name: "list_chats",
                    description: "List your AI chat conversations with Limitless",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of chats to return (default: 50)",
                            example: "20",
                        },
                        {
                            name: "cursor",
                            type: "string",
                            required: false,
                            description: "Pagination cursor from previous response",
                        },
                    ],
                    returns:
                        "List of chat conversations with metadata and pagination info",
                },
                {
                    name: "get_chat",
                    description: "Get details of a specific chat conversation",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "chatId",
                            type: "string",
                            required: true,
                            description: "The ID of the chat to retrieve",
                        },
                    ],
                    returns: "Chat details including messages, context, and metadata",
                },
                {
                    name: "delete_lifelog",
                    description: "Permanently delete a Lifelog entry",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: true,
                    },
                    parameters: [
                        {
                            name: "lifelogId",
                            type: "string",
                            required: true,
                            description: "The ID of the Lifelog to delete",
                        },
                    ],
                    returns: "Confirmation of deletion",
                },
                {
                    name: "delete_chat",
                    description: "Permanently delete a chat conversation",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: true,
                    },
                    parameters: [
                        {
                            name: "chatId",
                            type: "string",
                            required: true,
                            description: "The ID of the chat to delete",
                        },
                    ],
                    returns: "Confirmation of deletion",
                },
                {
                    name: "download_audio",
                    description:
                        "Download audio from your Pendant for a specific time range (max 2 hours)",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "startMs",
                            type: "number",
                            required: true,
                            description: "Start time as Unix timestamp in milliseconds",
                            example: 1705312800000,
                        },
                        {
                            name: "endMs",
                            type: "number",
                            required: true,
                            description: "End time as Unix timestamp in milliseconds",
                            example: 1705316400000,
                        },
                    ],
                    returns:
                        "Audio download URL for the specified time range (Ogg Opus format)",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Limitless API - you can perform nearly any operation supported by Limitless. " +
                        "If you're familiar with the Limitless API structure, construct the request directly. " +
                        "If unsure/errors: try context7 docs (search_libraries('limitless'), get_docs(id)) or fallback to https://www.limitless.ai/developers",
                    annotations: {},
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Limitless API endpoint path (e.g., '/v1/lifelogs', '/v1/chats', '/v1/search')",
                            example: "/v1/lifelogs",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, DELETE)",
                            example: "POST",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description:
                                "Request body for POST requests. Structure depends on the endpoint - " +
                                "for example, searching requires query and optional filter fields. " +
                                "Use the Limitless API structure you're familiar with, or consult the documentation if needed.",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw Limitless API response as JSON",
                },
            ],
            commonOperations: ["search", "list_recordings"],
            docsUrl: "https://www.limitless.ai/developers",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        _accountId?: string // Multi-account support not yet implemented
    ): Promise<MCPToolResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `[LIMITLESS ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's API key credentials using base class helper
        const result = await this.getApiKeyForExecution(userId);
        if ("isError" in result) return result;
        const { apiKey } = result;

        // Route to appropriate handler
        try {
            switch (action) {
                case "search":
                    return await this.handleSearch(params, apiKey);
                case "get_lifelog":
                    return await this.handleGetLifelog(params, apiKey);
                case "list_recordings":
                    return await this.handleListRecordings(params, apiKey);
                case "get_transcript":
                    return await this.handleGetTranscript(params, apiKey);
                case "list_chats":
                    return await this.handleListChats(params, apiKey);
                case "get_chat":
                    return await this.handleGetChat(params, apiKey);
                case "delete_lifelog":
                    return await this.handleDeleteLifelog(params, apiKey);
                case "delete_chat":
                    return await this.handleDeleteChat(params, apiKey);
                case "download_audio":
                    return await this.handleDownloadAudio(params, apiKey);
                case "raw_api":
                    return await this.executeRawAPI(params as RawAPIParams, userId);
                default:
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(
                `[LIMITLESS ADAPTER] Failed to execute ${action} for user ${userId}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            // Use base class error handler
            const errorMessage = this.handleCommonAPIError(error, action);
            return this.createErrorResponse(errorMessage);
        }
    }

    private async handleSearch(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            query,
            limit = 10, // Default to 10 for AI context - summaries are included
            date,
        } = params as {
            query: string;
            limit?: number;
            date?: string;
        };

        const searchParams: Record<string, string> = {
            search: query,
            limit: Math.min(limit, 100).toString(),
        };

        if (date) {
            searchParams.date = date;
        }

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/lifelogs`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams,
            })
            .json<{
                data: {
                    lifelogs: Array<{
                        id: string;
                        summary?: string;
                        startedAt: string;
                        endedAt: string;
                        markdown?: string;
                    }>;
                };
                meta?: {
                    lifelogs?: {
                        count: number;
                        nextCursor?: string;
                    };
                };
            }>();

        const lifelogs = response.data?.lifelogs || [];

        if (lifelogs.length === 0) {
            return this.createJSONResponse({
                query,
                totalCount: 0,
                results: [],
                message: "No Lifelogs found matching your query.",
            });
        }

        return this.createJSONResponse({
            query,
            totalCount: response.meta?.lifelogs?.count || lifelogs.length,
            results: lifelogs.map((log) => ({
                id: log.id,
                title: log.summary || "Recording",
                content: log.markdown || log.summary || "No content available",
                startedAt: log.startedAt,
                endedAt: log.endedAt,
            })),
            nextCursor: response.meta?.lifelogs?.nextCursor,
            note: "Full content included - synthesize directly from these results.",
        });
    }

    private async handleGetLifelog(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { lifelogId } = params as { lifelogId: string };

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/lifelogs/${lifelogId}`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
            })
            .json<{
                data: {
                    lifelog: {
                        id: string;
                        summary?: string;
                        startedAt: string;
                        endedAt: string;
                        markdown?: string;
                        transcript?: string;
                        headings?: Array<{
                            title: string;
                            startMs: number;
                            endMs: number;
                        }>;
                    };
                };
            }>();

        const lifelog = response.data.lifelog;

        return this.createJSONResponse({
            id: lifelog.id,
            summary: lifelog.summary,
            startedAt: lifelog.startedAt,
            endedAt: lifelog.endedAt,
            markdown: lifelog.markdown,
            transcript: lifelog.transcript,
            headings: lifelog.headings,
        });
    }

    private async handleListRecordings(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            limit = 10, // Default to 10 for AI context - use date/time filters for more
            date,
            start,
            end,
        } = params as {
            limit?: number;
            date?: string;
            start?: string;
            end?: string;
        };

        const searchParams: Record<string, string> = {
            limit: Math.min(limit, 100).toString(),
            direction: "desc",
        };

        if (date) {
            searchParams.date = date;
        }
        if (start) {
            searchParams.start = start;
        }
        if (end) {
            searchParams.end = end;
        }

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/lifelogs`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams,
            })
            .json<{
                data: {
                    lifelogs: Array<{
                        id: string;
                        summary?: string;
                        startedAt: string;
                        endedAt: string;
                        markdown?: string;
                    }>;
                };
                meta?: {
                    lifelogs?: {
                        count: number;
                        nextCursor?: string;
                    };
                };
            }>();

        const lifelogs = response.data?.lifelogs || [];

        return this.createJSONResponse({
            totalCount: response.meta?.lifelogs?.count || lifelogs.length,
            lifelogs: lifelogs.map((log) => ({
                id: log.id,
                title: log.summary || "Recording",
                content: log.markdown || log.summary || "No content available",
                startedAt: log.startedAt,
                endedAt: log.endedAt,
            })),
            nextCursor: response.meta?.lifelogs?.nextCursor,
            note: "Use the content field directly - no need to fetch individual recordings.",
        });
    }

    private async handleGetTranscript(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { lifelogId } = params as { lifelogId: string };

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/lifelogs/${lifelogId}`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams: {
                    includeTranscript: "true",
                },
            })
            .json<{
                data: {
                    lifelog: {
                        id: string;
                        transcript?: string;
                        summary?: string;
                        startedAt: string;
                        endedAt: string;
                    };
                };
            }>();

        const lifelog = response.data.lifelog;

        if (!lifelog.transcript) {
            return this.createErrorResponse(
                "No transcript available for this Lifelog. The transcript may still be processing."
            );
        }

        return this.createSuccessResponse(
            `**Lifelog Transcript**\n\n` +
                `**ID:** ${lifelog.id}\n` +
                `**Time:** ${lifelog.startedAt} to ${lifelog.endedAt}\n` +
                `**Summary:** ${lifelog.summary || "N/A"}\n\n` +
                `---\n\n${lifelog.transcript}`
        );
    }

    private async handleListChats(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { limit = 50, cursor } = params as {
            limit?: number;
            cursor?: string;
        };

        const searchParams: Record<string, string> = {
            limit: limit.toString(),
        };

        if (cursor) {
            searchParams.cursor = cursor;
        }

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/chats`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams,
            })
            .json<{
                data: {
                    chats: Array<{
                        id: string;
                        title?: string;
                        createdAt: string;
                        updatedAt: string;
                        messageCount?: number;
                    }>;
                };
                meta?: {
                    chats?: {
                        count: number;
                        nextCursor?: string;
                    };
                };
            }>();

        const chats = response.data?.chats || [];

        return this.createJSONResponse({
            totalCount: response.meta?.chats?.count || chats.length,
            chats: chats.map((chat) => ({
                id: chat.id,
                title: chat.title || "Untitled Chat",
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                messageCount: chat.messageCount || 0,
            })),
            nextCursor: response.meta?.chats?.nextCursor,
        });
    }

    private async handleGetChat(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { chatId } = params as { chatId: string };

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/chats/${chatId}`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
            })
            .json<{
                data: {
                    chat: {
                        id: string;
                        title?: string;
                        createdAt: string;
                        updatedAt: string;
                        messages?: Array<{
                            role: string;
                            content: string;
                            createdAt: string;
                        }>;
                        context?: Array<{
                            lifelogId: string;
                            snippet: string;
                        }>;
                    };
                };
            }>();

        const chat = response.data.chat;

        return this.createJSONResponse({
            id: chat.id,
            title: chat.title || "Untitled Chat",
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            messages: chat.messages || [],
            context: chat.context || [],
        });
    }

    private async handleDeleteLifelog(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { lifelogId } = params as { lifelogId: string };

        await httpClient.delete(`${LIMITLESS_API_BASE}/lifelogs/${lifelogId}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        return this.createSuccessResponse(
            `Successfully deleted Lifelog with ID: ${lifelogId}`
        );
    }

    private async handleDeleteChat(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { chatId } = params as { chatId: string };

        await httpClient.delete(`${LIMITLESS_API_BASE}/chats/${chatId}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        return this.createSuccessResponse(
            `Successfully deleted chat with ID: ${chatId}`
        );
    }

    private async handleDownloadAudio(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { startMs, endMs } = params as {
            startMs: number;
            endMs: number;
        };

        // The download-audio endpoint uses Unix timestamps in milliseconds
        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/download-audio`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams: {
                    startMs: startMs.toString(),
                    endMs: endMs.toString(),
                },
            })
            .json<{
                data?: {
                    downloadUrl?: string;
                    expiresAt?: string;
                    format?: string;
                    duration?: number;
                };
                url?: string; // Some APIs return the URL directly
            }>();

        // Handle different possible response formats
        const downloadUrl = response.data?.downloadUrl || response.url;

        if (!downloadUrl) {
            return this.createErrorResponse(
                "No audio available for the specified time range. Make sure your Pendant was recording during this time."
            );
        }

        return this.createJSONResponse({
            downloadUrl,
            expiresAt: response.data?.expiresAt || "Check URL for expiration",
            format: response.data?.format || "Ogg Opus",
            duration: response.data?.duration,
            note: "Audio file is in Ogg Opus format. Use the download URL to retrieve the audio file.",
        });
    }

    async executeRawAPI(
        params: RawAPIParams,
        userId: string
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
                "raw_api requires 'method' parameter (GET, POST, PUT, DELETE, PATCH)"
            );
        }

        // Security: validate endpoint starts with /v1
        if (!endpoint.startsWith("/v1/")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1/'. " +
                    `Got: ${endpoint}. ` +
                    "Example: '/v1/memories/search'"
            );
        }

        // Get API key using base class helper
        const keyResult = await this.getApiKeyForExecution(userId);
        if ("isError" in keyResult) return keyResult;
        const { apiKey } = keyResult;

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
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
            const httpMethod = method.toLowerCase() as "get" | "post" | "delete";

            // Build full URL - endpoint should already include /v1 prefix
            const fullUrl = endpoint.startsWith("/v1")
                ? `https://api.limitless.ai${endpoint}`
                : `${LIMITLESS_API_BASE}${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `[LIMITLESS ADAPTER] Raw API request failed for user ${userId}:`,
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
                userId,
            });

            // Use base class error handler
            const errorMessage = this.handleCommonAPIError(error, "raw_api");
            return this.createErrorResponse(errorMessage);
        }
    }
}
