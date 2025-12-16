/**
 * Giphy Service Adapter
 *
 * GIF search via API key authentication.
 *
 * ## Code-Relevant Details
 * - API key passed as query param (api_key), not Authorization header
 * - Rating param filters content (g, pg, pg-13, r) - defaults to "pg" for safety
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { httpClient } from "@/lib/http-client";

const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs";

/** Default content rating for safety - pg keeps results work-appropriate */
const DEFAULT_RATING = "pg";

export class GiphyAdapter extends ServiceAdapter {
    serviceName = "giphy";
    serviceDisplayName = "Giphy";

    /**
     * Test the API key by making a lightweight API call
     * Uses the random endpoint to verify the key works
     */
    async testConnection(
        apiKey: string
    ): Promise<{ success: boolean; error?: string }> {
        return await this.testApiKeyWithEndpoint(
            apiKey,
            `${GIPHY_API_BASE}/random?api_key=${apiKey}&tag=hello`,
            "skip", // We pass api_key as query param, not header
            () => "" // No header value needed
        );
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description: "Find GIFs and stickers for visual communication",
            operations: [
                {
                    name: "search",
                    description: "Search for GIFs on Giphy with a query string",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description: "Search query term or phrase",
                            example: "funny cats",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of GIFs to return (default: 10, max: 50)",
                            example: "25",
                        },
                        {
                            name: "offset",
                            type: "number",
                            required: false,
                            description: "Results offset for pagination (default: 0)",
                            example: "0",
                        },
                        {
                            name: "rating",
                            type: "string",
                            required: false,
                            description:
                                "Content rating filter: g (General Audience), pg (Parental Guidance - default), pg-13 (Parents Strongly Cautioned), r (Restricted)",
                            example: "g",
                        },
                        {
                            name: "lang",
                            type: "string",
                            required: false,
                            description:
                                "Language code for regional results (default: en)",
                            example: "en",
                        },
                    ],
                    returns:
                        "Array of GIF objects with URLs, metadata, dimensions, and attribution info",
                    example: `search({ query: "excited reaction", limit: 5, rating: "g" })`,
                },
                {
                    name: "get_random",
                    description:
                        "Get a random GIF from Giphy, optionally filtered by tag",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "tag",
                            type: "string",
                            required: false,
                            description:
                                "Tag to limit random results (e.g., 'dog', 'birthday')",
                            example: "celebration",
                        },
                        {
                            name: "rating",
                            type: "string",
                            required: false,
                            description:
                                "Content rating filter: g, pg (default), pg-13, r",
                            example: "pg",
                        },
                    ],
                    returns: "Random GIF object with URL, metadata, and attribution",
                    example: `get_random({ tag: "celebration", rating: "g" })`,
                },
                {
                    name: "get_trending",
                    description: "Get currently trending GIFs on Giphy",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description:
                                "Maximum number of GIFs to return (default: 10, max: 50)",
                            example: "15",
                        },
                        {
                            name: "offset",
                            type: "number",
                            required: false,
                            description: "Results offset for pagination (default: 0)",
                            example: "0",
                        },
                        {
                            name: "rating",
                            type: "string",
                            required: false,
                            description:
                                "Content rating filter: g, pg (default), pg-13, r",
                            example: "g",
                        },
                    ],
                    returns: "Array of trending GIF objects with metadata",
                    example: `get_trending({ limit: 10, rating: "pg" })`,
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Giphy API - you can perform nearly any operation supported by Giphy. " +
                        "If you're familiar with the Giphy API structure, construct the request directly. " +
                        "If unsure/errors: try context7 docs (search_libraries('giphy'), get_docs(id)) or fallback to https://developers.giphy.com/docs/api",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Giphy API endpoint path (e.g., '/v1/gifs/search', '/v1/gifs/trending')",
                            example: "/v1/gifs/search",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, DELETE)",
                            example: "GET",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw Giphy API response as JSON",
                },
            ],
            docsUrl: "https://developers.giphy.com/docs/api",
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
                `📥 [GIPHY ADAPTER] Validation failed for action '${action}':`,
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
                case "get_random":
                    return await this.handleGetRandom(params, apiKey);
                case "get_trending":
                    return await this.handleGetTrending(params, apiKey);
                case "raw_api":
                    return await this.executeRawAPI(params as RawAPIParams, userId);
                default:
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(
                `❌ [GIPHY ADAPTER] Failed to execute ${action} for user ${userId}:`,
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
            limit = 10,
            offset = 0,
            rating,
            lang = "en",
        } = params as {
            query: string;
            limit?: number;
            offset?: number;
            rating?: string;
            lang?: string;
        };

        const searchParams: Record<string, string> = {
            api_key: apiKey,
            q: query,
            limit: Math.min(limit, 50).toString(),
            offset: offset.toString(),
            lang,
            rating: rating || DEFAULT_RATING,
        };

        this.logInfo(`🔍 [GIPHY ADAPTER] Searching for GIFs: "${query}"`);

        const response = await httpClient
            .get(`${GIPHY_API_BASE}/search`, {
                searchParams,
            })
            .json<{
                data: Array<GiphyGIF>;
                pagination: {
                    total_count: number;
                    count: number;
                    offset: number;
                };
                meta: {
                    status: number;
                    msg: string;
                };
            }>();

        if (response.data.length === 0) {
            return this.createJSONResponse({
                query,
                totalCount: 0,
                results: [],
                message: "No GIFs found matching your query.",
            });
        }

        this.logInfo(`✅ [GIPHY ADAPTER] Found ${response.data.length} GIFs`);

        return this.createJSONResponse({
            query,
            totalCount: response.pagination.total_count,
            count: response.pagination.count,
            offset: response.pagination.offset,
            results: response.data.map(this.formatGIF),
        });
    }

    private async handleGetRandom(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const { tag, rating } = params as {
            tag?: string;
            rating?: string;
        };

        const searchParams: Record<string, string> = {
            api_key: apiKey,
            rating: rating || DEFAULT_RATING,
        };

        if (tag) {
            searchParams.tag = tag;
        }

        this.logInfo(
            `🎲 [GIPHY ADAPTER] Getting random GIF${tag ? ` with tag: ${tag}` : ""}`
        );

        const response = await httpClient
            .get(`${GIPHY_API_BASE}/random`, {
                searchParams,
            })
            .json<{
                data: GiphyGIF;
                meta: {
                    status: number;
                    msg: string;
                };
            }>();

        this.logInfo(`✅ [GIPHY ADAPTER] Retrieved random GIF`);

        return this.createJSONResponse({
            result: this.formatGIF(response.data),
        });
    }

    private async handleGetTrending(
        params: unknown,
        apiKey: string
    ): Promise<MCPToolResponse> {
        const {
            limit = 10,
            offset = 0,
            rating,
        } = params as {
            limit?: number;
            offset?: number;
            rating?: string;
        };

        const searchParams: Record<string, string> = {
            api_key: apiKey,
            limit: Math.min(limit, 50).toString(),
            offset: offset.toString(),
            rating: rating || DEFAULT_RATING,
        };

        this.logInfo(`🔥 [GIPHY ADAPTER] Getting trending GIFs`);

        const response = await httpClient
            .get(`${GIPHY_API_BASE}/trending`, {
                searchParams,
            })
            .json<{
                data: Array<GiphyGIF>;
                pagination: {
                    total_count: number;
                    count: number;
                    offset: number;
                };
                meta: {
                    status: number;
                    msg: string;
                };
            }>();

        this.logInfo(`✅ [GIPHY ADAPTER] Found ${response.data.length} trending GIFs`);

        return this.createJSONResponse({
            totalCount: response.pagination.total_count,
            count: response.pagination.count,
            offset: response.pagination.offset,
            results: response.data.map(this.formatGIF),
        });
    }

    private formatGIF(gif: GiphyGIF): FormattedGIF {
        return {
            id: gif.id,
            title: gif.title,
            url: gif.url,
            rating: gif.rating,
            images: {
                original: {
                    url: gif.images.original.url,
                    width: gif.images.original.width,
                    height: gif.images.original.height,
                },
                fixed_height: {
                    url: gif.images.fixed_height.url,
                    width: gif.images.fixed_height.width,
                    height: gif.images.fixed_height.height,
                },
                fixed_width: {
                    url: gif.images.fixed_width.url,
                    width: gif.images.fixed_width.width,
                    height: gif.images.fixed_width.height,
                },
            },
            attribution: "Powered by GIPHY",
        };
    }

    async executeRawAPI(
        params: RawAPIParams,
        userId: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, query } = params;

        // Validate parameters
        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST, DELETE)"
            );
        }

        // Security: validate endpoint starts with /v1
        if (!endpoint.startsWith("/v1/")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1/'. " +
                    `Got: ${endpoint}. ` +
                    "Example: '/v1/gifs/search'"
            );
        }

        // Get API key using base class helper
        const keyResult = await this.getApiKeyForExecution(userId);
        if ("isError" in keyResult) return keyResult;
        const { apiKey } = keyResult;

        // Build request options
        const searchParams: Record<string, string> = {
            api_key: apiKey,
        };

        if (query && typeof query === "object") {
            Object.assign(
                searchParams,
                Object.fromEntries(
                    Object.entries(query).map(([k, v]) => [k, String(v)])
                )
            );
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "put"
                | "patch"
                | "delete";

            // Build full URL
            const fullUrl = `https://api.giphy.com${endpoint}`;

            this.logInfo(`🔧 [GIPHY ADAPTER] Raw API call: ${method} ${endpoint}`);

            const response = await httpClient[httpMethod](fullUrl, {
                searchParams,
            }).json<Record<string, unknown>>();

            this.logInfo(`✅ [GIPHY ADAPTER] Raw API call successful`);

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `❌ [GIPHY ADAPTER] Raw API request failed for user ${userId}:`,
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

// Type definitions for Giphy API responses
interface GiphyGIF {
    id: string;
    title: string;
    url: string;
    rating: string;
    images: {
        original: GiphyImage;
        fixed_height: GiphyImage;
        fixed_width: GiphyImage;
    };
}

interface GiphyImage {
    url: string;
    width: string;
    height: string;
}

export interface FormattedGIF {
    id: string;
    title: string;
    url: string;
    rating: string;
    images: {
        original: {
            url: string;
            width: string;
            height: string;
        };
        fixed_height: {
            url: string;
            width: string;
            height: string;
        };
        fixed_width: {
            url: string;
            width: string;
            height: string;
        };
    };
    attribution: string;
}
