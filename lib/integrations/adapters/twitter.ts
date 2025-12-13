/**
 * X (Twitter) Service Adapter
 *
 * Tweets and timeline via X API v2 through Nango proxy. All endpoints use "2/" prefix.
 *
 * ## safeNangoRequest Wrapper
 * Connection resets during JSON parsing are common with X API. All requests wrapped
 * in safeNangoRequest which handles retry and error recovery.
 *
 * ## User ID Dependency
 * V2 POST operations (likes, retweets) require user ID, not username.
 * Code fetches via /2/users/me before these operations.
 *
 * ## Search Limitation
 * Search returns only last 7 days of tweets on free/basic tiers.
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

// Constants for X API limits
const MAX_TWEETS_FETCH = 100; // Max allowed by API per request
const MAX_USERS_FETCH = 100;

/** Get and validate Nango secret key */
function getNangoSecretKey(): string {
    if (!env.NANGO_SECRET_KEY) {
        throw new Error("Missing required environment variable: NANGO_SECRET_KEY");
    }
    return env.NANGO_SECRET_KEY;
}

export class TwitterAdapter extends ServiceAdapter {
    serviceName = "twitter";
    serviceDisplayName = "X (Twitter)";

    private getNangoUrl(): string {
        if (!env.NANGO_API_URL) {
            throw new Error("Missing required environment variable: NANGO_API_URL");
        }
        return env.NANGO_API_URL;
    }

    /**
     * Safely fetch and parse JSON from Nango proxy
     * Automatically includes Nango authentication headers
     * Handles connection errors that can occur during JSON parsing
     */
    private async safeNangoRequest<T>(
        method: "get" | "post" | "delete",
        endpoint: string,
        connectionId: string,
        options?: {
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        }
    ): Promise<T> {
        const nangoSecretKey = getNangoSecretKey();
        const url = `${this.getNangoUrl()}/proxy/${endpoint}`;

        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "twitter",
            },
        };

        if (options?.searchParams) {
            requestOptions.searchParams = options.searchParams;
        }

        if (options?.json) {
            requestOptions.headers["Content-Type"] = "application/json";
            requestOptions.json = options.json;
        }

        try {
            // Make the HTTP request
            const response = await httpClient[method](url, requestOptions);

            // Parse JSON with error handling
            try {
                return await response.json<T>();
            } catch (jsonError) {
                // Handle JSON parsing errors specifically
                const errorMessage =
                    jsonError instanceof Error ? jsonError.message : String(jsonError);

                if (
                    errorMessage.includes("closed") ||
                    errorMessage.includes("ECONNRESET")
                ) {
                    this.logError(
                        "❌ [twitter] Connection closed during response parsing:",
                        {
                            endpoint,
                            method,
                            error: errorMessage,
                        }
                    );
                    throw new Error(
                        "Connection to X API was closed unexpectedly. " +
                            "This may be due to network issues or API rate limiting. Please try again."
                    );
                }

                // Re-throw other JSON errors
                throw jsonError;
            }
        } catch (error) {
            // Handle connection errors
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (
                errorMessage.includes("closed") ||
                errorMessage.includes("ECONNRESET") ||
                errorMessage.includes("EPIPE") ||
                errorMessage.includes("socket hang up")
            ) {
                this.logError("❌ [twitter] Network connection error:", {
                    endpoint,
                    method,
                    error: errorMessage,
                });
                throw new Error(
                    "Lost connection to X API. This may be temporary. Please try again."
                );
            }

            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Fetch the X account information
     * Used to populate accountIdentifier and accountDisplayName after OAuth
     *
     * @param connectionId - Nango connection ID (required for OAuth webhook flow)
     * @param _userId - User ID (optional, only used for logging)
     */
    async fetchAccountInfo(
        connectionId: string,
        _userId?: string
    ): Promise<{
        identifier: string;
        displayName: string;
    }> {
        try {
            // Get authenticated user info
            const userResponse = await this.safeNangoRequest<{
                data: {
                    id: string;
                    name: string;
                    username: string;
                };
            }>("get", "2/users/me", connectionId);

            return {
                identifier: `@${userResponse.data.username}`,
                displayName: userResponse.data.name,
            };
        } catch (error) {
            this.logError("❌ Failed to fetch X account info:", error);
            throw new ValidationError("Failed to fetch X account information");
        }
    }

    /**
     * Test the OAuth connection by making a live API request
     * Called when user clicks "Test" button to verify credentials are working
     *
     * @param connectionId - Nango connection ID
     * @param _userId - User ID (optional, only used for logging)
     */
    async testConnection(
        connectionId: string,
        _userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Make a simple request to verify connection
            await this.safeNangoRequest<{
                data: { id: string };
            }>("get", "2/users/me", connectionId);

            return { success: true };
        } catch (error) {
            this.logError("❌ [twitter] Failed to verify connection:", error);
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
            description: "Post tweets and manage X (Twitter) timeline",
            operations: [
                {
                    name: "post_tweet",
                    description:
                        "Post a new tweet (counts toward 1,500/month application quota)",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                    },
                    parameters: [
                        {
                            name: "text",
                            type: "string",
                            required: true,
                            description: "Tweet content (max 280 characters)",
                            example: "Hello from Carmenta!",
                        },
                    ],
                    returns: "Tweet details including ID and creation time",
                },
                {
                    name: "get_user_timeline",
                    description: "Get tweets from your timeline",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Number of tweets to fetch (default: 10, max: 100)",
                            example: "20",
                        },
                    ],
                    returns: "List of tweets from your timeline",
                },
                {
                    name: "search_tweets",
                    description: "Search for tweets matching a query",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "Search query (supports Twitter search operators)",
                            example: "AI tools from:elonmusk",
                        },
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description: "Number of results (default: 10, max: 100)",
                            example: "25",
                        },
                    ],
                    returns: "List of tweets matching the search query",
                },
                {
                    name: "get_user_profile",
                    description: "Get profile information for a user",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "username",
                            type: "string",
                            required: true,
                            description: "Username (without @ symbol)",
                            example: "elonmusk",
                        },
                    ],
                    returns: "User profile including bio, followers, and stats",
                },
                {
                    name: "get_mentions",
                    description: "Get tweets mentioning you",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Number of mentions to fetch (default: 10, max: 100)",
                            example: "20",
                        },
                    ],
                    returns: "List of tweets mentioning your account",
                },
                {
                    name: "like_tweet",
                    description: "Like a tweet",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                    },
                    parameters: [
                        {
                            name: "tweet_id",
                            type: "string",
                            required: true,
                            description: "ID of the tweet to like",
                            example: "1234567890",
                        },
                    ],
                    returns: "Confirmation of like action",
                },
                {
                    name: "unlike_tweet",
                    description: "Unlike a tweet",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                    },
                    parameters: [
                        {
                            name: "tweet_id",
                            type: "string",
                            required: true,
                            description: "ID of the tweet to unlike",
                            example: "1234567890",
                        },
                    ],
                    returns: "Confirmation of unlike action",
                },
                {
                    name: "retweet",
                    description: "Retweet a tweet (counts toward 1,500/month quota)",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                    },
                    parameters: [
                        {
                            name: "tweet_id",
                            type: "string",
                            required: true,
                            description: "ID of the tweet to retweet",
                            example: "1234567890",
                        },
                    ],
                    returns: "Confirmation of retweet action",
                },
                {
                    name: "unretweet",
                    description: "Remove a retweet",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                    },
                    parameters: [
                        {
                            name: "tweet_id",
                            type: "string",
                            required: true,
                            description: "ID of the tweet to unretweet",
                            example: "1234567890",
                        },
                    ],
                    returns: "Confirmation of unretweet action",
                },
                {
                    name: "get_followers",
                    description: "Get your followers",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Number of followers to fetch (default: 10, max: 100)",
                            example: "50",
                        },
                    ],
                    returns: "List of users following you",
                },
                {
                    name: "get_following",
                    description: "Get users you follow",
                    annotations: {
                        readOnlyHint: true,
                    },
                    parameters: [
                        {
                            name: "max_results",
                            type: "number",
                            required: false,
                            description:
                                "Number of users to fetch (default: 10, max: 100)",
                            example: "50",
                        },
                    ],
                    returns: "List of users you follow",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full X API v2 - you can perform nearly any operation supported by X. " +
                        "If you're familiar with the X API structure, construct the request directly. " +
                        "If unsure/errors: consult https://developer.twitter.com/en/docs/api-reference-index",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "X API v2 endpoint path (e.g., '2/tweets', '2/users/me', '2/users/by/username/:username')",
                            example: "2/tweets",
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
                                "for example, posting a tweet requires a 'text' field. " +
                                "Use the X API structure you're familiar with, or consult the documentation if needed.",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw X API response as JSON",
                    example: `raw_api({ endpoint: "2/users/me", method: "GET" })`,
                },
            ],
            commonOperations: [
                "post_tweet",
                "search_tweets",
                "get_user_timeline",
                "get_mentions",
            ],
            docsUrl: "https://developer.twitter.com/en/docs/twitter-api",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userEmail: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        // Validate parameters (skip for raw_api which has its own validation)
        if (action !== "raw_api") {
            const validation = this.validate(action, params);
            if (!validation.valid) {
                this.logError(
                    `❌ [TWITTER ADAPTER] Validation failed for action '${action}':`,
                    validation.errors
                );
                return this.createErrorResponse(
                    `Validation errors:\n${validation.errors.join("\n")}`
                );
            }
        }

        // Get user's X connection via connection manager
        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userEmail,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for X. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/twitter`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                this.logInfo(
                    `📝 [TWITTER ADAPTER] User ${userEmail} attempted to use X but no connection found`
                );
                return this.createErrorResponse(this.createNotConnectedError());
            }
            throw error;
        }

        // Route to appropriate handler
        try {
            switch (action) {
                case "post_tweet":
                    return await this.handlePostTweet(params, connectionId);
                case "get_user_timeline":
                    return await this.handleGetUserTimeline(params, connectionId);
                case "search_tweets":
                    return await this.handleSearchTweets(params, connectionId);
                case "get_user_profile":
                    return await this.handleGetUserProfile(params, connectionId);
                case "get_mentions":
                    return await this.handleGetMentions(params, connectionId);
                case "like_tweet":
                    return await this.handleLikeTweet(params, connectionId);
                case "unlike_tweet":
                    return await this.handleUnlikeTweet(params, connectionId);
                case "retweet":
                    return await this.handleRetweet(params, connectionId);
                case "unretweet":
                    return await this.handleUnretweet(params, connectionId);
                case "get_followers":
                    return await this.handleGetFollowers(params, connectionId);
                case "get_following":
                    return await this.handleGetFollowing(params, connectionId);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userEmail,
                        accountId
                    );
                default:
                    this.logError(
                        `❌ [TWITTER ADAPTER] Unknown action '${action}' requested by user ${userEmail}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            // Comprehensive error logging
            this.logError(
                `❌ [TWITTER ADAPTER] Failed to execute ${action} for user ${userEmail}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                    connectionId,
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

    private async handlePostTweet(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { text } = params as { text: string };

        if (!text || typeof text !== "string") {
            throw new ValidationError("Tweet text is required");
        }

        if (text.length > 280) {
            throw new ValidationError(
                `Tweet is too long (${text.length} characters). Maximum is 280 characters.`
            );
        }

        this.logInfo(`📤 [twitter] Posting tweet: "${text.substring(0, 50)}..."`);

        // Get user ID first (required for posting tweets in v2 API)
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Post the tweet
        const response = await this.safeNangoRequest<{
            data: {
                id: string;
                text: string;
            };
        }>("post", "2/tweets", connectionId, {
            json: {
                text,
            },
        });

        this.logInfo(`✅ [twitter] Tweet posted successfully, ID: ${response.data.id}`);

        return this.createJSONResponse({
            success: true,
            tweet_id: response.data.id,
            text: response.data.text,
            user_id: userId,
        });
    }

    private async handleGetUserTimeline(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { max_results = 10 } = params as { max_results?: number };

        const cappedLimit = Math.min(Math.max(1, max_results || 10), MAX_TWEETS_FETCH);

        this.logInfo(`📥 [twitter] Fetching user timeline, limit: ${cappedLimit}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Get user's tweets
        const response = await this.safeNangoRequest<{
            data: Array<{
                id: string;
                text: string;
                created_at: string;
                public_metrics?: {
                    retweet_count: number;
                    reply_count: number;
                    like_count: number;
                    quote_count: number;
                };
            }>;
            meta?: {
                result_count: number;
            };
        }>("get", `2/users/${userId}/tweets`, connectionId, {
            searchParams: {
                max_results: cappedLimit.toString(),
                "tweet.fields": "created_at,public_metrics",
            },
        });

        const resultCount = response.meta?.result_count ?? 0;
        this.logInfo(`✅ [twitter] Retrieved ${resultCount} tweets`);

        return this.createJSONResponse({
            tweets: response.data || [],
            count: resultCount,
        });
    }

    private async handleSearchTweets(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { query, max_results = 10 } = params as {
            query: string;
            max_results?: number;
        };

        if (!query || typeof query !== "string") {
            throw new ValidationError("Search query is required");
        }

        const cappedLimit = Math.min(Math.max(1, max_results || 10), MAX_TWEETS_FETCH);

        this.logInfo(
            `🔍 [twitter] Searching tweets: "${query}", limit: ${cappedLimit}`
        );

        const response = await this.safeNangoRequest<{
            data: Array<{
                id: string;
                text: string;
                author_id: string;
                created_at: string;
                public_metrics?: {
                    retweet_count: number;
                    reply_count: number;
                    like_count: number;
                    quote_count: number;
                };
            }>;
            meta?: {
                result_count: number;
            };
        }>("get", "2/tweets/search/recent", connectionId, {
            searchParams: {
                query,
                max_results: cappedLimit.toString(),
                "tweet.fields": "created_at,author_id,public_metrics",
            },
        });

        const resultCount = response.meta?.result_count ?? 0;
        this.logInfo(`✅ [twitter] Search returned ${resultCount} tweets`);

        return this.createJSONResponse({
            query,
            tweets: response.data || [],
            count: resultCount,
        });
    }

    private async handleGetUserProfile(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { username } = params as { username: string };

        if (!username || typeof username !== "string") {
            throw new ValidationError("Username is required");
        }

        this.logInfo(`👤 [twitter] Fetching profile for @${username}`);

        const response = await this.safeNangoRequest<{
            data: {
                id: string;
                name: string;
                username: string;
                description?: string;
                created_at: string;
                verified?: boolean;
                profile_image_url?: string;
                public_metrics?: {
                    followers_count: number;
                    following_count: number;
                    tweet_count: number;
                    listed_count: number;
                };
            };
        }>("get", `2/users/by/username/${username}`, connectionId, {
            searchParams: {
                "user.fields":
                    "created_at,description,public_metrics,verified,profile_image_url",
            },
        });

        this.logInfo(`✅ [twitter] Retrieved profile for @${response.data.username}`);

        return this.createJSONResponse({
            user: response.data,
        });
    }

    private async handleGetMentions(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { max_results = 10 } = params as { max_results?: number };

        const cappedLimit = Math.min(Math.max(1, max_results || 10), MAX_TWEETS_FETCH);

        this.logInfo(`📥 [twitter] Fetching mentions, limit: ${cappedLimit}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Get mentions
        const response = await this.safeNangoRequest<{
            data: Array<{
                id: string;
                text: string;
                author_id: string;
                created_at: string;
                public_metrics?: {
                    retweet_count: number;
                    reply_count: number;
                    like_count: number;
                    quote_count: number;
                };
            }>;
            meta?: {
                result_count: number;
            };
        }>("get", `2/users/${userId}/mentions`, connectionId, {
            searchParams: {
                max_results: cappedLimit.toString(),
                "tweet.fields": "created_at,author_id,public_metrics",
            },
        });

        const resultCount = response.meta?.result_count ?? 0;
        this.logInfo(`✅ [twitter] Retrieved ${resultCount} mentions`);

        return this.createJSONResponse({
            mentions: response.data || [],
            count: resultCount,
        });
    }

    private async handleLikeTweet(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { tweet_id } = params as { tweet_id: string };

        if (!tweet_id || typeof tweet_id !== "string") {
            throw new ValidationError("Tweet ID is required");
        }

        this.logInfo(`👍 [twitter] Liking tweet ${tweet_id}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Like the tweet
        const response = await this.safeNangoRequest<{
            data: {
                liked: boolean;
            };
        }>("post", `2/users/${userId}/likes`, connectionId, {
            json: {
                tweet_id,
            },
        });

        this.logInfo(`✅ [twitter] Tweet ${tweet_id} liked successfully`);

        return this.createJSONResponse({
            success: true,
            tweet_id,
            liked: response.data.liked,
        });
    }

    private async handleUnlikeTweet(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { tweet_id } = params as { tweet_id: string };

        if (!tweet_id || typeof tweet_id !== "string") {
            throw new ValidationError("Tweet ID is required");
        }

        this.logInfo(`👎 [twitter] Unliking tweet ${tweet_id}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Unlike the tweet
        await this.safeNangoRequest<{ data: { liked: boolean } }>(
            "delete",
            `2/users/${userId}/likes/${tweet_id}`,
            connectionId
        );

        this.logInfo(`✅ [twitter] Tweet ${tweet_id} unliked successfully`);

        return this.createJSONResponse({
            success: true,
            tweet_id,
            liked: false,
        });
    }

    private async handleRetweet(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { tweet_id } = params as { tweet_id: string };

        if (!tweet_id || typeof tweet_id !== "string") {
            throw new ValidationError("Tweet ID is required");
        }

        this.logInfo(`🔄 [twitter] Retweeting tweet ${tweet_id}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Retweet
        const response = await this.safeNangoRequest<{
            data: {
                retweeted: boolean;
            };
        }>("post", `2/users/${userId}/retweets`, connectionId, {
            json: {
                tweet_id,
            },
        });

        this.logInfo(`✅ [twitter] Tweet ${tweet_id} retweeted successfully`);

        return this.createJSONResponse({
            success: true,
            tweet_id,
            retweeted: response.data.retweeted,
        });
    }

    private async handleUnretweet(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { tweet_id } = params as { tweet_id: string };

        if (!tweet_id || typeof tweet_id !== "string") {
            throw new ValidationError("Tweet ID is required");
        }

        this.logInfo(`🔙 [twitter] Unretweeting tweet ${tweet_id}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Unretweet
        await this.safeNangoRequest<{ data: { retweeted: boolean } }>(
            "delete",
            `2/users/${userId}/retweets/${tweet_id}`,
            connectionId
        );

        this.logInfo(`✅ [twitter] Tweet ${tweet_id} unretweeted successfully`);

        return this.createJSONResponse({
            success: true,
            tweet_id,
            retweeted: false,
        });
    }

    private async handleGetFollowers(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { max_results = 10 } = params as { max_results?: number };

        const cappedLimit = Math.min(Math.max(1, max_results || 10), MAX_USERS_FETCH);

        this.logInfo(`👥 [twitter] Fetching followers, limit: ${cappedLimit}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Get followers
        const response = await this.safeNangoRequest<{
            data: Array<{
                id: string;
                name: string;
                username: string;
                description?: string;
                verified?: boolean;
                public_metrics?: {
                    followers_count: number;
                    following_count: number;
                    tweet_count: number;
                };
            }>;
            meta?: {
                result_count: number;
            };
        }>("get", `2/users/${userId}/followers`, connectionId, {
            searchParams: {
                max_results: cappedLimit.toString(),
                "user.fields": "description,public_metrics,verified",
            },
        });

        const resultCount = response.meta?.result_count ?? 0;
        this.logInfo(`✅ [twitter] Retrieved ${resultCount} followers`);

        return this.createJSONResponse({
            followers: response.data || [],
            count: resultCount,
        });
    }

    private async handleGetFollowing(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { max_results = 10 } = params as { max_results?: number };

        const cappedLimit = Math.min(Math.max(1, max_results || 10), MAX_USERS_FETCH);

        this.logInfo(`👥 [twitter] Fetching following, limit: ${cappedLimit}`);

        // Get user ID first
        const userResponse = await this.safeNangoRequest<{
            data: {
                id: string;
            };
        }>("get", "2/users/me", connectionId);

        const userId = userResponse.data.id;

        // Get following
        const response = await this.safeNangoRequest<{
            data: Array<{
                id: string;
                name: string;
                username: string;
                description?: string;
                verified?: boolean;
                public_metrics?: {
                    followers_count: number;
                    following_count: number;
                    tweet_count: number;
                };
            }>;
            meta?: {
                result_count: number;
            };
        }>("get", `2/users/${userId}/following`, connectionId, {
            searchParams: {
                max_results: cappedLimit.toString(),
                "user.fields": "description,public_metrics,verified",
            },
        });

        const resultCount = response.meta?.result_count ?? 0;
        this.logInfo(`✅ [twitter] Retrieved ${resultCount} following`);

        return this.createJSONResponse({
            following: response.data || [],
            count: resultCount,
        });
    }

    /**
     * Execute a raw X API request
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
                "raw_api requires 'method' parameter (GET, POST, DELETE)"
            );
        }

        // Security: validate endpoint starts with 2/
        if (!endpoint.startsWith("2/")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '2/' (X API v2). " +
                    `Got: ${endpoint}. ` +
                    "Example: '2/tweets', '2/users/me'"
            );
        }

        // Get user credentials via connection manager
        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userEmail,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for X. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/twitter`
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

        this.logInfo(`🔧 [twitter] Raw API call: ${method} ${endpoint}`);

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "twitter",
            },
        };

        // Add query parameters if provided
        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        // Add body for POST/PUT/PATCH
        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
            requestOptions.headers["Content-Type"] = "application/json";
            if (body) {
                requestOptions.json = body;
            }
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "delete"
                | "put"
                | "patch";
            const fullUrl = `${nangoUrl}/proxy/${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            this.logInfo(`✅ [twitter] Raw API call successful`);

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `❌ [TWITTER ADAPTER] Raw API request failed for user ${userEmail}:`,
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

            let errorMessage = `Raw API request failed: `;
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the X API documentation for the correct endpoint: " +
                        "https://developer.twitter.com/en/docs/twitter-api";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage +=
                        "Authentication failed. Your X connection may have expired. " +
                        `Please reconnect at: ${this.getIntegrationUrl()}`;
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
