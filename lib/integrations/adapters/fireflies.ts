/**
 * Fireflies.ai Service Adapter
 *
 * Meeting transcripts and AI insights via GraphQL API (no REST endpoints).
 *
 * ## Code-Relevant Details
 * - Search is CLIENT-SIDE filtering (fetches transcripts then filters) because
 *   Fireflies GraphQL doesn't have server-side search
 * - action_items returns formatted string, not array
 * - Duration in seconds, not minutes
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { isApiKeyCredentials } from "@/lib/integrations/encryption";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

const FIREFLIES_API_BASE = "https://api.fireflies.ai/graphql";

export class FirefliesAdapter extends ServiceAdapter {
    serviceName = "fireflies";
    serviceDisplayName = "Fireflies.ai";

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description: "Search and analyze meeting transcripts",
            commonOperations: [
                "search_transcripts",
                "get_transcript",
                "generate_summary",
            ],
            operations: [
                {
                    name: "list_transcripts",
                    description: "List recent meeting transcripts from your account",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of transcripts to return (default: 20, max: 50)",
                            example: "10",
                        },
                    ],
                    returns:
                        "List of meeting transcripts with metadata (ID, title, date, participants)",
                    example: `list_transcripts({ limit: 10 })`,
                },
                {
                    name: "get_transcript",
                    description:
                        "Get full details of a specific meeting transcript including content, speakers, and summary",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "transcriptId",
                            type: "string",
                            required: true,
                            description: "The ID of the transcript to retrieve",
                        },
                    ],
                    returns:
                        "Complete transcript details including sentences, speakers, timestamps, summary, and action items",
                },
                {
                    name: "search_transcripts",
                    description: "Search meeting transcripts by keywords or phrases",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description: "Search query to find in transcripts",
                            example: "project timeline",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Maximum number of results (default: 20)",
                            example: "10",
                        },
                    ],
                    returns:
                        "List of transcripts matching the search query with relevance scores",
                    example: `search_transcripts({ query: "project timeline", limit: 10 })`,
                },
                {
                    name: "generate_summary",
                    description: "Generate an AI summary of a meeting transcript",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "transcriptId",
                            type: "string",
                            required: true,
                            description: "The ID of the transcript to summarize",
                        },
                        {
                            name: "format",
                            type: "string",
                            required: false,
                            description:
                                "Summary format: 'bullet_points' or 'paragraph' (default: bullet_points)",
                            example: "bullet_points",
                        },
                    ],
                    returns:
                        "AI-generated summary of the meeting in the specified format",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Fireflies GraphQL API - you can perform nearly any query supported by Fireflies. " +
                        "If you're familiar with the Fireflies GraphQL schema, construct the query directly. " +
                        "If unsure/errors: try context7 (/websites/fireflies_ai) or https://docs.fireflies.ai/",
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "GraphQL query string (e.g., '{ users { name user_id } }' or 'query SearchTranscripts($query: String!) { ... }')",
                            example: "{ transcripts { id title date } }",
                        },
                        {
                            name: "variables",
                            type: "object",
                            required: false,
                            description:
                                "GraphQL query variables. Structure depends on your query - " +
                                "for example, a search query might require query and filters variables. " +
                                "Use the Fireflies GraphQL schema you're familiar with, or consult the documentation if needed.",
                        },
                    ],
                    returns: "Raw GraphQL API response as JSON",
                },
            ],
            docsUrl: "https://docs.fireflies.ai/",
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
                `[FIREFLIES ADAPTER] 🔴 Validation failed for action '${action}':`,
                validation.errors
            );
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
                    "Invalid credentials type for Fireflies service"
                );
            }

            if (!isApiKeyCredentials(connectionCreds.credentials)) {
                return this.createErrorResponse(
                    "Invalid credential format for Fireflies service"
                );
            }

            apiKey = connectionCreds.credentials.apiKey;
        } catch (error) {
            if (error instanceof ValidationError) {
                const errorMsg = [
                    "❌ Fireflies.ai is not connected to your account.",
                    "",
                    `Please connect Fireflies.ai at: ${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/integrations/fireflies`,
                    "",
                    "Once connected, try your request again.",
                ].join("\n");
                return this.createErrorResponse(errorMsg);
            }
            throw error;
        }

        // Route to appropriate handler
        try {
            this.logInfo(
                `[FIREFLIES ADAPTER] 📥 Executing action '${action}' for user ${userId}`
            );

            switch (action) {
                case "list_transcripts":
                    return await this.handleListTranscripts(params, apiKey);
                case "get_transcript":
                    return await this.handleGetTranscript(params, apiKey);
                case "search_transcripts":
                    return await this.handleSearchTranscripts(params, apiKey);
                case "generate_summary":
                    return await this.handleGenerateSummary(params, apiKey);
                case "raw_api":
                    return await this.executeRawAPI(params as RawAPIParams, userId);
                default:
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(
                `[FIREFLIES ADAPTER] ❌ Failed to execute ${action} for user ${userId}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            let errorMessage = `Failed to ${action}: `;
            if (error instanceof Error) {
                if (
                    error.message.includes("401") ||
                    error.message.includes("Unauthorized")
                ) {
                    errorMessage +=
                        "Authentication failed. Your API key may be invalid. Please reconnect at: " +
                        `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/integrations/fireflies`;
                } else if (error.message.includes("404")) {
                    errorMessage += "Resource not found.";
                } else if (error.message.includes("429")) {
                    errorMessage +=
                        "Rate limit exceeded (50 calls/day on free plan). Please try again later.";
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    private async executeGraphQL<T>(
        query: string,
        apiKey: string,
        variables?: Record<string, unknown>
    ): Promise<T> {
        this.logInfo(
            `[FIREFLIES ADAPTER] 🚀 Executing GraphQL query:`,
            query.substring(0, 100) + "..."
        );

        const response = await httpClient
            .post(FIREFLIES_API_BASE, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                json: {
                    query,
                    variables: variables || {},
                },
            })
            .json<{ data?: T; errors?: Array<{ message: string }> }>();

        if (response.errors && response.errors.length > 0) {
            const errorMessages = response.errors.map((e) => e.message).join(", ");
            this.logError(`[FIREFLIES ADAPTER] 🔴 GraphQL errors:`, errorMessages);
            throw new Error(`GraphQL error: ${errorMessages}`);
        }

        if (!response.data) {
            this.logError(`[FIREFLIES ADAPTER] 🔴 No data in response`);
            throw new Error("No data returned from Fireflies API");
        }

        this.logInfo(`[FIREFLIES ADAPTER] ✅ GraphQL query successful`);
        return response.data;
    }

    private async handleListTranscripts(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { limit = 20 } = params as { limit?: number };
        const cappedLimit = Math.min(Math.max(1, Math.floor(limit)), 50); // API max is 50

        const query = `
            query ListTranscripts($limit: Int!) {
                transcripts(limit: $limit) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    meeting_attendees {
                        displayName
                        email
                    }
                    summary {
                        overview
                        action_items
                        keywords
                    }
                }
            }
        `;

        const data = await this.executeGraphQL<{
            transcripts: Array<{
                id: string;
                title: string;
                date: string;
                duration: number;
                organizer_email: string;
                meeting_attendees?: Array<{ displayName: string; email: string }>;
                summary?: {
                    overview?: string;
                    action_items?: string; // API returns formatted string, not array
                    keywords?: string[];
                };
            }>;
        }>(query, apiKey, { limit: cappedLimit });

        const transcripts = data.transcripts || [];

        if (transcripts.length === 0) {
            return this.createJSONResponse({
                totalCount: 0,
                transcripts: [],
                message: "No transcripts found in your account.",
            });
        }

        this.logInfo(`[FIREFLIES ADAPTER] 📦 Found ${transcripts.length} transcripts`);

        return this.createJSONResponse({
            totalCount: transcripts.length,
            transcripts: transcripts.map((t) => ({
                id: t.id,
                title: t.title,
                date: t.date,
                duration: t.duration,
                organizer: t.organizer_email,
                attendees:
                    t.meeting_attendees?.map((a) => a.displayName || a.email) || [],
                overview: t.summary?.overview || "No summary available",
                actionItems: t.summary?.action_items || "",
                keywords: t.summary?.keywords || [],
            })),
        });
    }

    private async handleGetTranscript(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { transcriptId } = params as { transcriptId: string };

        const query = `
            query GetTranscript($transcriptId: String!) {
                transcript(id: $transcriptId) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    meeting_attendees {
                        displayName
                        email
                    }
                    summary {
                        overview
                        action_items
                        keywords
                        outline
                        shorthand_bullet
                    }
                    sentences {
                        text
                        speaker_name
                        start_time
                        end_time
                    }
                }
            }
        `;

        const data = await this.executeGraphQL<{
            transcript: {
                id: string;
                title: string;
                date: string;
                duration: number;
                organizer_email: string;
                meeting_attendees?: Array<{ displayName: string; email: string }>;
                summary?: {
                    overview?: string;
                    action_items?: string; // API returns formatted string, not array
                    keywords?: string[];
                    outline?: string;
                    shorthand_bullet?: string;
                };
                sentences?: Array<{
                    text: string;
                    speaker_name: string;
                    start_time: number;
                    end_time: number;
                }>;
            };
        }>(query, apiKey, { transcriptId });

        const transcript = data.transcript;

        if (!transcript) {
            return this.createErrorResponse(
                `Transcript with ID '${transcriptId}' not found.`
            );
        }

        this.logInfo(
            `[FIREFLIES ADAPTER] 📄 Retrieved transcript: ${transcript.title}`
        );

        // Format transcript for better readability
        const formattedTranscript = [
            `**${transcript.title}**`,
            ``,
            `**Date:** ${transcript.date}`,
            `**Duration:** ${Math.round(transcript.duration / 60)} minutes`,
            `**Organizer:** ${transcript.organizer_email}`,
            `**Attendees:** ${transcript.meeting_attendees?.map((a) => a.displayName || a.email).join(", ") || "None"}`,
            ``,
            `## Summary`,
            transcript.summary?.overview || "No summary available",
            ``,
        ];

        if (
            transcript.summary?.action_items &&
            transcript.summary.action_items.trim().length > 0
        ) {
            formattedTranscript.push(
                `## Action Items`,
                transcript.summary.action_items,
                ``
            );
        }

        if (transcript.summary?.keywords && transcript.summary.keywords.length > 0) {
            formattedTranscript.push(
                `## Keywords`,
                transcript.summary.keywords.join(", "),
                ``
            );
        }

        if (transcript.sentences && transcript.sentences.length > 0) {
            formattedTranscript.push(
                `## Transcript`,
                ``,
                ...transcript.sentences.map((s) => `**${s.speaker_name}:** ${s.text}`)
            );
        }

        return this.createSuccessResponse(formattedTranscript.join("\n"));
    }

    private async handleSearchTranscripts(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { query: searchQuery, limit = 20 } = params as {
            query: string;
            limit?: number;
        };

        const cappedLimit = Math.min(Math.max(1, Math.floor(limit)), 50); // API max is 50

        // Use GraphQL query to search transcripts by title or content
        const query = `
            query SearchTranscripts($limit: Int!) {
                transcripts(limit: $limit) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    summary {
                        overview
                        keywords
                    }
                }
            }
        `;

        const data = await this.executeGraphQL<{
            transcripts: Array<{
                id: string;
                title: string;
                date: string;
                duration: number;
                organizer_email: string;
                summary?: {
                    overview?: string;
                    keywords?: string[];
                };
            }>;
        }>(query, apiKey, { limit: cappedLimit * 2 }); // Get more to filter

        // Filter transcripts by search query (simple text matching)
        const searchLower = searchQuery.toLowerCase();
        const filteredTranscripts = (data.transcripts || [])
            .filter(
                (t) =>
                    t.title.toLowerCase().includes(searchLower) ||
                    t.summary?.overview?.toLowerCase().includes(searchLower) ||
                    t.summary?.keywords?.some((k) =>
                        k.toLowerCase().includes(searchLower)
                    )
            )
            .slice(0, cappedLimit);

        this.logInfo(
            `[FIREFLIES ADAPTER] 🔍 Search for '${searchQuery}' found ${filteredTranscripts.length} results`
        );

        if (filteredTranscripts.length === 0) {
            return this.createJSONResponse({
                query: searchQuery,
                totalCount: 0,
                results: [],
                message: `No transcripts found matching '${searchQuery}'.`,
            });
        }

        return this.createJSONResponse({
            query: searchQuery,
            totalCount: filteredTranscripts.length,
            results: filteredTranscripts.map((t) => ({
                id: t.id,
                title: t.title,
                date: t.date,
                duration: t.duration,
                organizer: t.organizer_email,
                overview: t.summary?.overview || "No summary available",
                keywords: t.summary?.keywords || [],
            })),
        });
    }

    private async handleGenerateSummary(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { transcriptId, format = "bullet_points" } = params as {
            transcriptId: string;
            format?: string;
        };

        const query = `
            query GetSummary($transcriptId: String!) {
                transcript(id: $transcriptId) {
                    id
                    title
                    summary {
                        overview
                        action_items
                        outline
                        shorthand_bullet
                        keywords
                    }
                }
            }
        `;

        const data = await this.executeGraphQL<{
            transcript: {
                id: string;
                title: string;
                summary?: {
                    overview?: string;
                    action_items?: string; // API returns formatted string, not array
                    outline?: string;
                    shorthand_bullet?: string;
                    keywords?: string[];
                };
            };
        }>(query, apiKey, { transcriptId });

        const transcript = data.transcript;

        if (!transcript || !transcript.summary) {
            return this.createErrorResponse(
                `No summary available for transcript '${transcriptId}'.`
            );
        }

        this.logInfo(
            `[FIREFLIES ADAPTER] 📝 Generated summary for: ${transcript.title}`
        );

        let formattedSummary: string[] | string;

        if (format === "bullet_points" || format === "bullets") {
            formattedSummary = [
                `**Summary: ${transcript.title}**`,
                ``,
                `## Overview`,
                transcript.summary.shorthand_bullet ||
                    transcript.summary.overview ||
                    "No overview available",
                ``,
            ];

            if (
                transcript.summary.action_items &&
                transcript.summary.action_items.trim().length > 0
            ) {
                formattedSummary.push(
                    `## Action Items`,
                    transcript.summary.action_items,
                    ``
                );
            }

            if (transcript.summary.keywords && transcript.summary.keywords.length > 0) {
                formattedSummary.push(
                    `## Key Topics`,
                    transcript.summary.keywords.join(", ")
                );
            }

            return this.createSuccessResponse(formattedSummary.join("\n"));
        } else {
            // Paragraph format
            formattedSummary = [
                `**Summary: ${transcript.title}**`,
                ``,
                transcript.summary.overview || "No summary available",
            ];

            if (
                transcript.summary.action_items &&
                transcript.summary.action_items.trim().length > 0
            ) {
                formattedSummary.push(
                    ``,
                    `**Action Items:**`,
                    transcript.summary.action_items
                );
            }

            return this.createSuccessResponse(formattedSummary.join("\n"));
        }
    }

    async executeRawAPI(
        params: RawAPIParams,
        userId: string
    ): Promise<MCPToolResponse> {
        // For Fireflies, raw_api accepts GraphQL queries
        // We use a custom 'query' parameter (string) for the GraphQL query,
        // not the standard RawAPIParams.query (Record<string, unknown> for URL params)
        const customParams = params as unknown as Record<string, unknown>;
        const query = customParams.query;

        if (!query || typeof query !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'query' parameter (GraphQL query string)"
            );
        }

        const body = params.body;

        // Get API key
        const connectionCreds = await getCredentials(userId, this.serviceName);
        if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
            return this.createErrorResponse("Invalid credentials");
        }
        if (!isApiKeyCredentials(connectionCreds.credentials)) {
            return this.createErrorResponse("Invalid credential format");
        }

        const apiKey = connectionCreds.credentials.apiKey;

        try {
            // Accept variables from either 'variables' param (as documented) or 'body' param (for compatibility)
            const variables =
                (customParams.variables as Record<string, unknown>) ||
                (body as Record<string, unknown>) ||
                {};
            const data = await this.executeGraphQL<Record<string, unknown>>(
                query,
                apiKey,
                variables
            );

            return this.createJSONResponse(data);
        } catch (error) {
            this.logError(
                `[FIREFLIES ADAPTER] ❌ Raw API request failed for user ${userId}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action: "raw_api",
                params: {
                    query,
                    ...(body ? { body } : {}),
                },
                userId,
            });

            let errorMessage = `Raw API request failed: `;
            if (error instanceof Error) {
                errorMessage += error.message;
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }
}
