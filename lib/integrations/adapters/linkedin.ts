/**
 * LinkedIn Service Adapter
 *
 * Share posts and manage your LinkedIn profile. Uses OAuth 2.0 with OpenID Connect.
 * Posts appear as coming from the authenticated user's account.
 *
 * ## LinkedIn API v2 Notes
 * - User profile data comes from /v2/userinfo (OpenID Connect endpoint)
 * - Posts use the UGC (User-Generated Content) API at /v2/ugcPosts
 * - Organization lookup supports both numeric ID and vanity name
 * - All endpoints require X-Restli-Protocol-Version: 2.0.0 header
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { ValidationError } from "@/lib/errors";

/** LinkedIn API base URL */
export const LINKEDIN_API_BASE = "https://api.linkedin.com";

/** Maximum post length per LinkedIn API */
const MAX_POST_LENGTH = 3000;

export class LinkedInAdapter extends ServiceAdapter {
    serviceName = "linkedin";
    serviceDisplayName = "LinkedIn";

    /**
     * Build headers for LinkedIn API requests.
     * Uses Bearer token auth with X-Restli-Protocol-Version header.
     */
    private buildHeaders(accessToken: string): Record<string, string> {
        return {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        };
    }

    /**
     * Test the OAuth connection by fetching user profile.
     */
    async testConnection(
        credentialOrToken: string,
        _userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await httpClient
                .get(`${LINKEDIN_API_BASE}/v2/userinfo`, {
                    headers: this.buildHeaders(credentialOrToken),
                })
                .json<{ sub: string }>();

            return { success: true };
        } catch (error) {
            this.logError("❌ [linkedin] Failed to verify connection:", error);
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
            description:
                "Share posts and access your LinkedIn profile. " +
                "Use 'get_profile' for your profile info. " +
                "Use 'create_post' to share content on your feed. " +
                "Use 'get_organization' to look up company information.",
            operations: [
                {
                    name: "get_profile",
                    description:
                        "Get authenticated user's LinkedIn profile information",
                    annotations: { readOnlyHint: true },
                    parameters: [],
                    returns:
                        "Profile data including name, headline, location, and profile URL",
                    example: "get_profile()",
                },
                {
                    name: "create_post",
                    description:
                        "Share a post on your LinkedIn feed (text only for now)",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "text",
                            type: "string",
                            required: true,
                            description: `Post content (up to ${MAX_POST_LENGTH} characters)`,
                            example: "Excited to share my new project!",
                        },
                        {
                            name: "visibility",
                            type: "string",
                            required: false,
                            description:
                                "Post visibility: PUBLIC or CONNECTIONS (default: PUBLIC)",
                            example: "PUBLIC",
                        },
                    ],
                    returns: "Created post details including post ID and URN",
                    example:
                        'create_post({ text: "Excited to share my new project!" })',
                },
                {
                    name: "get_organization",
                    description:
                        "Get organization profile information by ID or vanity name",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "organizationId",
                            type: "string",
                            required: false,
                            description: "Numeric organization ID",
                            example: "1441",
                        },
                        {
                            name: "vanityName",
                            type: "string",
                            required: false,
                            description: "Organization vanity name from URL",
                            example: "microsoft",
                        },
                    ],
                    returns:
                        "Organization details including name, description, and website",
                    example: 'get_organization({ vanityName: "microsoft" })',
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full LinkedIn API - you can perform nearly any operation supported by LinkedIn. " +
                        "If you're familiar with the LinkedIn API structure, construct the request directly. " +
                        "If unsure/errors: try context7 (/websites/learn_microsoft_en-us_linkedin) or https://learn.microsoft.com/en-us/linkedin/",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "LinkedIn API endpoint path (e.g., '/v2/me', '/v2/ugcPosts')",
                            example: "/v2/me",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, DELETE, PATCH)",
                            example: "GET",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description:
                                "Request body for POST/PUT/PATCH requests. Structure depends on the endpoint.",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw LinkedIn API response as JSON",
                    example: 'raw_api({ endpoint: "/v2/me", method: "GET" })',
                },
            ],
            commonOperations: ["get_profile", "create_post", "get_organization"],
            docsUrl: "https://learn.microsoft.com/en-us/linkedin/",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userEmail: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        // Validate action and params (skip for raw_api which has its own validation)
        if (action !== "raw_api") {
            const validation = this.validate(action, params);
            if (!validation.valid) {
                this.logError(
                    `❌ [LINKEDIN ADAPTER] Validation failed for action '${action}':`,
                    validation.errors
                );
                return this.createErrorResponse(
                    `Validation errors:\n${validation.errors.join("\n")}`
                );
            }
        }

        // Get user's LinkedIn credentials via connection manager
        let accessToken: string;
        try {
            const credentials = await getCredentials(
                userEmail,
                this.serviceName,
                accountId
            );

            if (credentials.type !== "oauth" || !credentials.accessToken) {
                this.logInfo(
                    `📝 [LINKEDIN ADAPTER] User ${userEmail} attempted to use LinkedIn but no connection found`
                );
                return this.createErrorResponse(this.createNotConnectedError());
            }
            accessToken = credentials.accessToken;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        // Route to appropriate handler
        try {
            switch (action) {
                case "get_profile":
                    return await this.handleGetProfile(accessToken);
                case "create_post":
                    return await this.handleCreatePost(params, accessToken);
                case "get_organization":
                    return await this.handleGetOrganization(params, accessToken);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userEmail,
                        accountId
                    );
                default:
                    this.logError(
                        `❌ [LINKEDIN ADAPTER] Unknown action '${action}' requested by user ${userEmail}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            this.logError(
                `❌ [LINKEDIN ADAPTER] Failed to execute ${action} for user ${userEmail}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                }
            );

            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId: userEmail,
            });

            return this.createErrorResponse(this.handleCommonAPIError(error, action));
        }
    }

    /**
     * Get authenticated user's profile via OpenID Connect userinfo endpoint.
     */
    private async handleGetProfile(accessToken: string): Promise<MCPToolResponse> {
        this.logInfo("👤 [linkedin] Fetching user profile");

        interface UserInfoResponse {
            sub: string;
            name?: string;
            given_name?: string;
            family_name?: string;
            email?: string;
            email_verified?: boolean;
            locale?: { country: string; language: string };
            picture?: string;
        }

        const response = await httpClient
            .get(`${LINKEDIN_API_BASE}/v2/userinfo`, {
                headers: this.buildHeaders(accessToken),
            })
            .json<UserInfoResponse>();

        this.logInfo(
            `✅ [linkedin] Retrieved profile for ${response.name || response.sub}`
        );

        return this.createJSONResponse({
            id: response.sub,
            name: response.name,
            givenName: response.given_name,
            familyName: response.family_name,
            email: response.email,
            emailVerified: response.email_verified,
            locale: response.locale,
            picture: response.picture,
        });
    }

    /**
     * Create a post on the user's LinkedIn feed.
     * Two-step process: fetch user ID, then create UGC post.
     */
    private async handleCreatePost(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { text, visibility } = params as {
            text: string;
            visibility?: string;
        };

        // Validate text
        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return this.createErrorResponse(
                "Post text is required and cannot be empty"
            );
        }

        if (text.length > MAX_POST_LENGTH) {
            return this.createErrorResponse(
                `Post is too long (${text.length} characters). Maximum is ${MAX_POST_LENGTH} characters.`
            );
        }

        // Validate visibility (default to PUBLIC if not provided or invalid type)
        const validVisibilities = ["PUBLIC", "CONNECTIONS"];
        const normalizedVisibility = (
            typeof visibility === "string" ? visibility : "PUBLIC"
        ).toUpperCase();
        if (!validVisibilities.includes(normalizedVisibility)) {
            return this.createErrorResponse(
                `Invalid visibility '${visibility}'. Must be PUBLIC or CONNECTIONS.`
            );
        }

        this.logInfo(
            `📤 [linkedin] Creating post, visibility: ${normalizedVisibility}`
        );

        // Step 1: Get user's LinkedIn person ID
        const userInfo = await httpClient
            .get(`${LINKEDIN_API_BASE}/v2/userinfo`, {
                headers: this.buildHeaders(accessToken),
            })
            .json<{ sub: string }>();

        const personUrn = `urn:li:person:${userInfo.sub}`;

        // Step 2: Create UGC post
        const postBody = {
            author: personUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: text,
                    },
                    shareMediaCategory: "NONE",
                },
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": normalizedVisibility,
            },
        };

        const response = await httpClient
            .post(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
                headers: this.buildHeaders(accessToken),
                json: postBody,
            })
            .json<{ id: string }>();

        this.logInfo(`✅ [linkedin] Post created: ${response.id}`);

        return this.createJSONResponse({
            success: true,
            postId: response.id,
            author: personUrn,
            text: text,
            visibility: normalizedVisibility,
        });
    }

    /**
     * Get organization information by ID or vanity name.
     */
    private async handleGetOrganization(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { organizationId, vanityName } = params as {
            organizationId?: string;
            vanityName?: string;
        };

        if (!organizationId && !vanityName) {
            return this.createErrorResponse(
                "Either organizationId or vanityName is required"
            );
        }

        this.logInfo(
            `🏢 [linkedin] Looking up organization: ${organizationId || vanityName}`
        );

        let url: string;
        if (organizationId) {
            // Encode organizationId to prevent path traversal
            url = `${LINKEDIN_API_BASE}/v2/organizations/${encodeURIComponent(organizationId)}`;
        } else {
            url = `${LINKEDIN_API_BASE}/v2/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityName!)}`;
        }

        interface Organization {
            id?: number;
            localizedName?: string;
            localizedDescription?: string;
            vanityName?: string;
            logoV2?: { original: string };
            websiteUrl?: string;
            staffCountRange?: { start: number; end: number };
            industries?: string[];
        }

        interface OrgResponse extends Organization {
            elements?: Organization[];
        }

        const response = await httpClient
            .get(url, {
                headers: this.buildHeaders(accessToken),
            })
            .json<OrgResponse>();

        // Handle vanity name search (returns elements array) vs direct ID lookup
        const org: Organization | undefined =
            response.elements?.[0] ?? (response.id ? response : undefined);

        // Check if we found a valid organization
        if (!org || !org.id) {
            return this.createErrorResponse(
                `Organization not found: ${vanityName || organizationId}`
            );
        }

        this.logInfo(
            `✅ [linkedin] Found organization: ${org.localizedName || organizationId}`
        );

        return this.createJSONResponse({
            id: org.id,
            name: org.localizedName,
            description: org.localizedDescription,
            vanityName: org.vanityName,
            logo: org.logoV2?.original,
            website: org.websiteUrl,
            staffCount: org.staffCountRange,
            industries: org.industries,
        });
    }

    /**
     * Execute a raw LinkedIn API request.
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
                "raw_api requires 'method' parameter (GET, POST, PUT, DELETE, PATCH)"
            );
        }

        // Validate HTTP method
        const validMethods = ["GET", "POST", "DELETE", "PUT", "PATCH"];
        if (!validMethods.includes(method.toUpperCase())) {
            return this.createErrorResponse(
                `Invalid method '${method}'. Must be one of: ${validMethods.join(", ")}`
            );
        }

        // Security: validate endpoint starts with /v2
        if (!endpoint.startsWith("/v2")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v2' (LinkedIn API v2). " +
                    `Got: ${endpoint}. ` +
                    "Example: '/v2/me', '/v2/ugcPosts'"
            );
        }

        // Get user credentials
        let accessToken: string;
        try {
            const credentials = await getCredentials(
                userEmail,
                this.serviceName,
                accountId
            );
            if (credentials.type !== "oauth" || !credentials.accessToken) {
                return this.createErrorResponse(this.createNotConnectedError());
            }
            accessToken = credentials.accessToken;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        this.logInfo(`🔧 [linkedin] Raw API call: ${method} ${endpoint}`);

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: this.buildHeaders(accessToken),
        };

        // Add query parameters if provided
        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        // Add body for POST/PUT/PATCH
        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
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

            const fullUrl = `${LINKEDIN_API_BASE}${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            this.logInfo("✅ [linkedin] Raw API call successful");

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `❌ [LINKEDIN ADAPTER] Raw API request failed for user ${userEmail}:`,
                {
                    endpoint,
                    method,
                    error: error instanceof Error ? error.message : String(error),
                }
            );

            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId: userEmail,
            });

            let errorMessage = "Raw API request failed: ";
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the LinkedIn API documentation: " +
                        "https://learn.microsoft.com/en-us/linkedin/";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage +=
                        "Authentication failed. Your LinkedIn connection may have expired. " +
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
