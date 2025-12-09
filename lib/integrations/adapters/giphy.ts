/**
 * Giphy Service Adapter
 *
 * GIF search via API key authentication.
 *
 * ## Code-Relevant Details
 * - API key passed as query param (api_key), not Authorization header
 * - Rating param filters content (g, pg, pg-13, r) - default is unfiltered
 */

import { ServiceAdapter } from "./base";
import { getCredentials } from "../connection-manager";
import type { HelpResponse, AdapterResponse, RawAPIParams } from "../types";

const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs";

export class GiphyAdapter extends ServiceAdapter {
    serviceName = "giphy";
    serviceDisplayName = "Giphy";

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
                                "Content rating filter: g (General Audience), pg (Parental Guidance), pg-13 (Parents Strongly Cautioned), r (Restricted)",
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
                            description: "Content rating filter: g, pg, pg-13, r",
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
                            description: "Content rating filter: g, pg, pg-13, r",
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
                        "Fallback to https://developers.giphy.com/docs/api for reference.",
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
                    "Invalid credentials type for Giphy service"
                );
            }

            if (!connectionCreds.credentials.apiKey) {
                return this.createErrorResponse(
                    "Invalid credential format for Giphy service"
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

        const searchParams = new URLSearchParams({
            api_key: apiKey,
            q: query,
            limit: Math.min(limit, 50).toString(),
            offset: offset.toString(),
            lang,
        });

        if (rating) {
            searchParams.set("rating", rating);
        }

        this.logInfo(`Searching for GIFs: "${query}"`);

        const response = await fetch(`${GIPHY_API_BASE}/search?${searchParams}`);

        if (!response.ok) {
            throw new Error(`Giphy API error: ${response.status}`);
        }

        const data = (await response.json()) as GiphySearchResponse;

        if (data.data.length === 0) {
            return this.createJSONResponse({
                query,
                totalCount: 0,
                results: [],
                message: "No GIFs found matching your query.",
            });
        }

        this.logInfo(`Found ${data.data.length} GIFs`);

        return this.createJSONResponse({
            query,
            totalCount: data.pagination.total_count,
            count: data.pagination.count,
            offset: data.pagination.offset,
            results: data.data.map(this.formatGIF),
        });
    }

    private async handleGetRandom(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const { tag, rating } = params as {
            tag?: string;
            rating?: string;
        };

        const searchParams = new URLSearchParams({
            api_key: apiKey,
        });

        if (tag) {
            searchParams.set("tag", tag);
        }
        if (rating) {
            searchParams.set("rating", rating);
        }

        this.logInfo(`Getting random GIF${tag ? ` with tag: ${tag}` : ""}`);

        const response = await fetch(`${GIPHY_API_BASE}/random?${searchParams}`);

        if (!response.ok) {
            throw new Error(`Giphy API error: ${response.status}`);
        }

        const data = (await response.json()) as GiphyRandomResponse;

        this.logInfo("Retrieved random GIF");

        return this.createJSONResponse({
            result: this.formatGIF(data.data),
        });
    }

    private async handleGetTrending(
        params: unknown,
        apiKey: string
    ): Promise<AdapterResponse> {
        const {
            limit = 10,
            offset = 0,
            rating,
        } = params as {
            limit?: number;
            offset?: number;
            rating?: string;
        };

        const searchParams = new URLSearchParams({
            api_key: apiKey,
            limit: Math.min(limit, 50).toString(),
            offset: offset.toString(),
        });

        if (rating) {
            searchParams.set("rating", rating);
        }

        this.logInfo("Getting trending GIFs");

        const response = await fetch(`${GIPHY_API_BASE}/trending?${searchParams}`);

        if (!response.ok) {
            throw new Error(`Giphy API error: ${response.status}`);
        }

        const data = (await response.json()) as GiphySearchResponse;

        this.logInfo(`Found ${data.data.length} trending GIFs`);

        return this.createJSONResponse({
            totalCount: data.pagination.total_count,
            count: data.pagination.count,
            offset: data.pagination.offset,
            results: data.data.map(this.formatGIF),
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
    ): Promise<AdapterResponse> {
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
        const searchParams = new URLSearchParams({
            api_key: apiKey,
        });

        if (query && typeof query === "object") {
            for (const [key, value] of Object.entries(query)) {
                searchParams.set(key, String(value));
            }
        }

        try {
            const fullUrl = `https://api.giphy.com${endpoint}?${searchParams}`;

            this.logInfo(`Raw API call: ${method} ${endpoint}`);

            const response = await fetch(fullUrl, {
                method: method.toUpperCase(),
            });

            if (!response.ok) {
                throw new Error(`Giphy API error: ${response.status}`);
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
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
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

interface FormattedGIF {
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

interface GiphySearchResponse {
    data: GiphyGIF[];
    pagination: {
        total_count: number;
        count: number;
        offset: number;
    };
    meta: {
        status: number;
        msg: string;
    };
}

interface GiphyRandomResponse {
    data: GiphyGIF;
    meta: {
        status: number;
        msg: string;
    };
}
