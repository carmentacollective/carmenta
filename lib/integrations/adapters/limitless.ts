/**
 * Limitless Service Adapter
 *
 * Lifelogs (Pendant recordings) and AI Chats via API key (X-API-Key header).
 *
 * ## Code-Relevant Details
 * - Some responses nest data in { data: { lifelogs: [...] } } structure
 * - search uses 'search' query param on /lifelogs, not a separate endpoint
 * - download_audio requires ISO 8601 timestamps with timezone
 */

import { ServiceAdapter } from "./base";
import { getCredentials } from "../connection-manager";
import type { HelpResponse, AdapterResponse, RawAPIParams } from "../types";

const LIMITLESS_API_BASE = "https://api.limitless.ai/v1";

export class LimitlessAdapter extends ServiceAdapter {
    serviceName = "limitless";
    serviceDisplayName = "Limitless";

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description: "Search conversations recorded by Limitless Pendant wearable",
            operations: [
                {
                    name: "search",
                    description:
                        "Search your Limitless Lifelogs with natural language queries",
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
                                "Maximum number of results (default: 50, max: 100)",
                            example: "10",
                        },
                        {
                            name: "date",
                            type: "string",
                            required: false,
                            description:
                                "Filter to entries on a specific date (YYYY-MM-DD)",
                            example: "2024-01-15",
                        },
                    ],
                    returns:
                        "List of relevant Lifelogs matching your query with summaries and timestamps",
                    example: `search({ query: "meetings about project alpha", limit: 10 })`,
                },
                {
                    name: "get_lifelog",
                    description: "Get details of a specific Lifelog entry by ID",
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
                        "Lifelog details including summary, markdown content, transcript, and metadata",
                },
                {
                    name: "list_recordings",
                    description: "List recent Lifelogs from your Pendant",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of Lifelogs to return (default: 50, max: 100)",
                            example: "20",
                        },
                        {
                            name: "date",
                            type: "string",
                            required: false,
                            description:
                                "Filter to entries on a specific date (YYYY-MM-DD)",
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
                    ],
                    returns:
                        "List of recent Lifelogs with metadata, summaries, and timestamps",
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
                        "Download audio from your Pendant for a specific time range",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "startTime",
                            type: "string",
                            required: true,
                            description:
                                "Start time in ISO 8601 format (e.g., 2024-01-15T09:00:00Z)",
                            example: "2024-01-15T09:00:00Z",
                        },
                        {
                            name: "endTime",
                            type: "string",
                            required: true,
                            description:
                                "End time in ISO 8601 format (e.g., 2024-01-15T10:00:00Z)",
                            example: "2024-01-15T10:00:00Z",
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
            commonOperations: [
                "search",
                "get_lifelog",
                "get_transcript",
                "list_recordings",
            ],
            docsUrl: "https://www.limitless.ai/developers",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        _accountId?: string
    ): Promise<AdapterResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError("Validation failed", {
                action,
                errors: validation.errors,
            });
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's API key credentials
        let apiKey: string;
        try {
            const connectionCreds = await getCredentials(userId, this.serviceName);

            if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
                return this.createErrorResponse(
                    "Invalid credentials type for Limitless service"
                );
            }

            if (!connectionCreds.credentials.apiKey) {
                return this.createErrorResponse(
                    "Invalid credential format for Limitless service"
                );
            }

            apiKey = connectionCreds.credentials.apiKey;
        } catch (error) {
            if (error instanceof Error && error.message.includes("No")) {
                return this.createErrorResponse(this.createNotConnectedError());
            }
            throw error;
        }

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
            this.logError(`Failed to execute ${action}`, {
                error: error instanceof Error ? error.message : String(error),
                userId,
            });

            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            return this.createErrorResponse(this.handleCommonAPIError(error, action));
        }
    }

    private async handleSearch(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const {
            query,
            limit = 50,
            date,
        } = params as {
            query: string;
            limit?: number;
            date?: string;
        };

        const searchParams = new URLSearchParams({
            search: query,
            limit: Math.min(limit, 100).toString(),
        });

        if (date) {
            searchParams.set("date", date);
        }

        this.logInfo(`Searching Lifelogs: "${query}"`);

        const response = await fetch(`${LIMITLESS_API_BASE}/lifelogs?${searchParams}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
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
        };

        const lifelogs = data.data?.lifelogs || [];

        if (lifelogs.length === 0) {
            return this.createJSONResponse({
                query,
                totalCount: 0,
                results: [],
                message: "No Lifelogs found matching your query.",
            });
        }

        this.logInfo(`Found ${lifelogs.length} Lifelogs`);

        return this.createJSONResponse({
            query,
            totalCount: data.meta?.lifelogs?.count || lifelogs.length,
            results: lifelogs.map((log) => ({
                id: log.id,
                summary: log.summary || "No summary available",
                startedAt: log.startedAt,
                endedAt: log.endedAt,
                preview: log.markdown?.substring(0, 200),
            })),
            nextCursor: data.meta?.lifelogs?.nextCursor,
        });
    }

    private async handleGetLifelog(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const { lifelogId } = params as { lifelogId: string };

        this.logInfo(`Getting Lifelog: ${lifelogId}`);

        const response = await fetch(`${LIMITLESS_API_BASE}/lifelogs/${lifelogId}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
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
        };

        const lifelog = data.data.lifelog;

        this.logInfo("Retrieved Lifelog details");

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
    ): Promise<AdapterResponse> {
        const {
            limit = 50,
            date,
            start,
            end,
        } = params as {
            limit?: number;
            date?: string;
            start?: string;
            end?: string;
        };

        const searchParams = new URLSearchParams({
            limit: Math.min(limit, 100).toString(),
            direction: "desc",
        });

        if (date) {
            searchParams.set("date", date);
        }
        if (start) {
            searchParams.set("start", start);
        }
        if (end) {
            searchParams.set("end", end);
        }

        this.logInfo("Listing recordings");

        const response = await fetch(`${LIMITLESS_API_BASE}/lifelogs?${searchParams}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
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
        };

        const lifelogs = data.data?.lifelogs || [];

        this.logInfo(`Found ${lifelogs.length} recordings`);

        return this.createJSONResponse({
            totalCount: data.meta?.lifelogs?.count || lifelogs.length,
            lifelogs: lifelogs.map((log) => ({
                id: log.id,
                summary: log.summary || "No summary available",
                startedAt: log.startedAt,
                endedAt: log.endedAt,
            })),
            nextCursor: data.meta?.lifelogs?.nextCursor,
        });
    }

    private async handleGetTranscript(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const { lifelogId } = params as { lifelogId: string };

        this.logInfo(`Getting transcript: ${lifelogId}`);

        const searchParams = new URLSearchParams({
            includeTranscript: "true",
        });

        const response = await fetch(
            `${LIMITLESS_API_BASE}/lifelogs/${lifelogId}?${searchParams}`,
            {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
            data: {
                lifelog: {
                    id: string;
                    transcript?: string;
                    summary?: string;
                    startedAt: string;
                    endedAt: string;
                };
            };
        };

        const lifelog = data.data.lifelog;

        if (!lifelog.transcript) {
            return this.createErrorResponse(
                "No transcript available for this Lifelog. The transcript may still be processing."
            );
        }

        this.logInfo("Retrieved transcript");

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
    ): Promise<AdapterResponse> {
        const { limit = 50, cursor } = params as {
            limit?: number;
            cursor?: string;
        };

        const searchParams = new URLSearchParams({
            limit: limit.toString(),
        });

        if (cursor) {
            searchParams.set("cursor", cursor);
        }

        this.logInfo("Listing chats");

        const response = await fetch(`${LIMITLESS_API_BASE}/chats?${searchParams}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
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
        };

        const chats = data.data?.chats || [];

        this.logInfo(`Found ${chats.length} chats`);

        return this.createJSONResponse({
            totalCount: data.meta?.chats?.count || chats.length,
            chats: chats.map((chat) => ({
                id: chat.id,
                title: chat.title || "Untitled Chat",
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                messageCount: chat.messageCount || 0,
            })),
            nextCursor: data.meta?.chats?.nextCursor,
        });
    }

    private async handleGetChat(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const { chatId } = params as { chatId: string };

        this.logInfo(`Getting chat: ${chatId}`);

        const response = await fetch(`${LIMITLESS_API_BASE}/chats/${chatId}`, {
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
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
        };

        const chat = data.data.chat;

        this.logInfo("Retrieved chat details");

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
    ): Promise<AdapterResponse> {
        const { lifelogId } = params as { lifelogId: string };

        this.logInfo(`Deleting Lifelog: ${lifelogId}`);

        const response = await fetch(`${LIMITLESS_API_BASE}/lifelogs/${lifelogId}`, {
            method: "DELETE",
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        this.logInfo("Lifelog deleted");

        return this.createSuccessResponse(
            `Successfully deleted Lifelog with ID: ${lifelogId}`
        );
    }

    private async handleDeleteChat(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const { chatId } = params as { chatId: string };

        this.logInfo(`Deleting chat: ${chatId}`);

        const response = await fetch(`${LIMITLESS_API_BASE}/chats/${chatId}`, {
            method: "DELETE",
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        this.logInfo("Chat deleted");

        return this.createSuccessResponse(
            `Successfully deleted chat with ID: ${chatId}`
        );
    }

    private async handleDownloadAudio(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const { startTime, endTime } = params as {
            startTime: string;
            endTime: string;
        };

        this.logInfo(`Downloading audio: ${startTime} to ${endTime}`);

        const searchParams = new URLSearchParams({
            startTime,
            endTime,
        });

        const response = await fetch(
            `${LIMITLESS_API_BASE}/download-audio?${searchParams}`,
            {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Limitless API error: ${response.status}`);
        }

        const data = (await response.json()) as {
            data?: {
                downloadUrl?: string;
                expiresAt?: string;
                format?: string;
                duration?: number;
            };
            url?: string;
        };

        const downloadUrl = data.data?.downloadUrl || data.url;

        if (!downloadUrl) {
            return this.createErrorResponse(
                "No audio available for the specified time range. Make sure your Pendant was recording during this time."
            );
        }

        this.logInfo("Audio download URL generated");

        return this.createJSONResponse({
            downloadUrl,
            expiresAt: data.data?.expiresAt || "Check URL for expiration",
            format: data.data?.format || "Ogg Opus",
            duration: data.data?.duration,
            note: "Audio file is in Ogg Opus format. Use the download URL to retrieve the audio file.",
        });
    }

    async executeRawAPI(
        params: RawAPIParams,
        userId: string
    ): Promise<AdapterResponse> {
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
                    "Example: '/v1/lifelogs'"
            );
        }

        // Get API key
        const connectionCreds = await getCredentials(userId, this.serviceName);
        if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
            return this.createErrorResponse("Invalid credentials");
        }
        if (!connectionCreds.credentials.apiKey) {
            return this.createErrorResponse("Invalid credential format");
        }

        const apiKey = connectionCreds.credentials.apiKey;

        // Build request options
        const searchParams = new URLSearchParams();

        if (query && typeof query === "object") {
            for (const [key, value] of Object.entries(query)) {
                searchParams.set(key, String(value));
            }
        }

        const requestInit: RequestInit = {
            method: method.toUpperCase(),
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
        };

        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
            requestInit.body = JSON.stringify(body);
        }

        try {
            const fullUrl = endpoint.startsWith("/v1")
                ? `https://api.limitless.ai${endpoint}${searchParams.toString() ? `?${searchParams}` : ""}`
                : `${LIMITLESS_API_BASE}${endpoint}${searchParams.toString() ? `?${searchParams}` : ""}`;

            this.logInfo(`Raw API call: ${method} ${endpoint}`);

            const response = await fetch(fullUrl, requestInit);

            if (!response.ok) {
                throw new Error(`Limitless API error: ${response.status}`);
            }

            const data = await response.json();

            this.logInfo("Raw API call successful");

            return this.createJSONResponse(data as Record<string, unknown>);
        } catch (error) {
            this.logError("Raw API request failed", {
                endpoint,
                method,
                error: error instanceof Error ? error.message : String(error),
            });

            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            let errorMessage = "Raw API request failed: ";
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage += "Endpoint not found. Check the API documentation.";
                } else if (error.message.includes("401")) {
                    errorMessage += "Authentication failed. Please check your API key.";
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
