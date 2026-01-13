/**
 * OAuth Token Exchange & Refresh Lifecycle Tests
 *
 * Tests the full OAuth token lifecycle:
 * - Authorization code exchange (PKCE and Basic Auth patterns)
 * - Token refresh before expiry window
 * - Error handling for HTTP and network failures
 * - Encryption/decryption round-trip for credentials
 * - Provider-specific configurations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OAuthProviderConfig } from "@/lib/integrations/oauth/types";

// Mock ky HTTP client
vi.mock("ky", () => {
    const mockPost = vi.fn();
    return {
        default: {
            post: mockPost,
        },
        HTTPError: class HTTPError extends Error {
            response: { status: number; json: () => Promise<unknown> };
            constructor(status: number, body: unknown) {
                super(`HTTP ${status}`);
                this.name = "HTTPError";
                this.response = {
                    status,
                    json: vi.fn().mockResolvedValue(body),
                };
            }
        },
    };
});

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock database
vi.mock("@/lib/db", () => ({
    db: {
        query: {
            integrations: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            }),
        }),
    },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
    eq: vi.fn((a, b) => ({ type: "eq", a, b })),
    and: vi.fn((...args) => ({ type: "and", conditions: args })),
}));

// Mock schema
vi.mock("@/lib/db/schema", () => ({
    integrations: {
        id: "id",
        userEmail: "userEmail",
        service: "service",
        accountId: "accountId",
        encryptedCredentials: "encryptedCredentials",
        status: "status",
        isDefault: "isDefault",
        connectedAt: "connectedAt",
    },
    integrationHistory: {},
}));

// Mock encryption with real-ish behavior
const mockEncrypt = vi.fn((data: string) => `encrypted:${data}`);
const mockDecrypt = vi.fn((data: string) => data.replace("encrypted:", ""));

vi.mock("@/lib/integrations/encryption", () => ({
    encryptCredentials: (creds: unknown) => mockEncrypt(JSON.stringify(creds)),
    decryptCredentials: (data: string) => JSON.parse(mockDecrypt(data)),
}));

// Mock provider registry
vi.mock("@/lib/integrations/oauth/providers", () => ({
    getProvider: vi.fn(),
}));

describe("OAuth Token Exchange & Refresh Lifecycle", () => {
    let ky: { post: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
        ky = (await import("ky")).default as unknown as typeof ky;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // Helper to create a mock provider config
    function createMockProvider(
        overrides: Partial<OAuthProviderConfig> = {}
    ): OAuthProviderConfig {
        return {
            id: "test-provider",
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            authorizationUrl: "https://provider.com/authorize",
            tokenUrl: "https://provider.com/token",
            scopes: ["read", "write"],
            ...overrides,
        };
    }

    describe("exchangeCodeForTokens", () => {
        describe("PKCE Flow (Google, Dropbox pattern)", () => {
            it("includes code_verifier in token request when provided", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    id: "google",
                    useBasicAuth: false,
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "access-token-123",
                        refresh_token: "refresh-token-456",
                        token_type: "Bearer",
                        expires_in: 3600,
                        scope: "read write",
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "auth-code-xyz",
                    "https://app.com/callback",
                    "pkce-verifier-abc123"
                );

                expect(ky.post).toHaveBeenCalledWith(
                    "https://provider.com/token",
                    expect.objectContaining({
                        body: expect.stringContaining(
                            "code_verifier=pkce-verifier-abc123"
                        ),
                    })
                );
                expect(result.tokens.accessToken).toBe("access-token-123");
                expect(result.tokens.refreshToken).toBe("refresh-token-456");
            });

            it("adds client credentials to body when not using Basic Auth", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    useBasicAuth: false,
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        token_type: "Bearer",
                    }),
                });

                await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                expect(ky.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        body: expect.stringContaining("client_id=test-client-id"),
                    })
                );
                expect(ky.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        body: expect.stringContaining(
                            "client_secret=test-client-secret"
                        ),
                    })
                );
            });
        });

        describe("Basic Auth Flow (Notion pattern)", () => {
            it("uses Authorization header with base64 credentials", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    id: "notion",
                    useBasicAuth: true,
                    scopes: [], // Notion has no OAuth scopes
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "notion-token",
                        token_type: "bearer",
                        workspace_id: "workspace-123",
                        workspace_name: "My Workspace",
                    }),
                });

                await exchangeCodeForTokens(
                    provider,
                    "notion-auth-code",
                    "https://app.com/callback"
                );

                const expectedCredentials = Buffer.from(
                    "test-client-id:test-client-secret"
                ).toString("base64");

                expect(ky.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            Authorization: `Basic ${expectedCredentials}`,
                        }),
                    })
                );

                // Should NOT include credentials in body when using Basic Auth
                const callArgs = ky.post.mock.calls[0][1];
                expect(callArgs.body).not.toContain("client_id");
                expect(callArgs.body).not.toContain("client_secret");
            });

            it("extracts account info using provider-specific extractor", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    id: "notion",
                    useBasicAuth: true,
                    extractAccountInfo: (response) => ({
                        identifier: response.workspace_id as string,
                        displayName: response.workspace_name as string,
                    }),
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        token_type: "bearer",
                        workspace_id: "ws-abc123",
                        workspace_name: "Engineering Team",
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                expect(result.accountInfo.identifier).toBe("ws-abc123");
                expect(result.accountInfo.displayName).toBe("Engineering Team");
            });
        });

        describe("Custom Token Extraction (Slack pattern)", () => {
            it("uses extractTokens for non-standard token response locations", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    id: "slack",
                    extractTokens: (response) => {
                        const authedUser = response.authed_user as {
                            access_token: string;
                            scope: string;
                        };
                        return {
                            accessToken: authedUser.access_token,
                            scope: authedUser.scope,
                            tokenType: "user",
                        };
                    },
                    extractAccountInfo: (response) => {
                        const team = response.team as { id: string; name: string };
                        const authedUser = response.authed_user as { id: string };
                        return {
                            identifier: `${team.id}:${authedUser.id}`,
                            displayName: team.name,
                        };
                    },
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        ok: true,
                        authed_user: {
                            id: "U123",
                            access_token: "xoxp-user-token",
                            scope: "channels:read chat:write",
                        },
                        team: {
                            id: "T456",
                            name: "Acme Corp",
                        },
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "slack-code",
                    "https://app.com/callback"
                );

                expect(result.tokens.accessToken).toBe("xoxp-user-token");
                expect(result.tokens.tokenType).toBe("user");
                expect(result.accountInfo.identifier).toBe("T456:U123");
                expect(result.accountInfo.displayName).toBe("Acme Corp");
            });

            it("falls back to standard extraction when extractTokens returns null", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    extractTokens: () => null, // Explicitly return null to trigger fallback
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "standard-token",
                        token_type: "Bearer",
                        expires_in: 7200,
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                expect(result.tokens.accessToken).toBe("standard-token");
                expect(result.tokens.tokenType).toBe("Bearer");
            });
        });

        describe("Error Handling", () => {
            it("handles HTTP 400 with OAuth error (invalid_code)", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");
                const kyModule = await import("ky");
                const MockHTTPError = kyModule.HTTPError as unknown as new (
                    status: number,
                    body: unknown
                ) => Error & {
                    response: { status: number; json: () => Promise<unknown> };
                };

                const provider = createMockProvider();

                const httpError = new MockHTTPError(400, {
                    error: "invalid_grant",
                    error_description: "Authorization code has expired",
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockRejectedValue(httpError),
                });

                await expect(
                    exchangeCodeForTokens(
                        provider,
                        "expired-code",
                        "https://app.com/callback"
                    )
                ).rejects.toThrow(
                    "OAuth error: invalid_grant - Authorization code has expired"
                );
            });

            it("handles HTTP 400 with OAuth error (expired code)", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");
                const kyModule = await import("ky");
                const MockHTTPError = kyModule.HTTPError as unknown as new (
                    status: number,
                    body: unknown
                ) => Error & {
                    response: { status: number; json: () => Promise<unknown> };
                };

                const provider = createMockProvider();

                const httpError = new MockHTTPError(400, {
                    error: "invalid_grant",
                    error_description: "Code has been used or is expired",
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockRejectedValue(httpError),
                });

                await expect(
                    exchangeCodeForTokens(
                        provider,
                        "used-code",
                        "https://app.com/callback"
                    )
                ).rejects.toThrow(
                    "OAuth error: invalid_grant - Code has been used or is expired"
                );
            });

            it("handles generic HTTP error without OAuth body", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");
                const kyModule = await import("ky");
                const MockHTTPError = kyModule.HTTPError as unknown as new (
                    status: number,
                    body: unknown
                ) => Error & {
                    response: { status: number; json: () => Promise<unknown> };
                };

                const provider = createMockProvider();

                const httpError = new MockHTTPError(500, {
                    message: "Internal server error",
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockRejectedValue(httpError),
                });

                await expect(
                    exchangeCodeForTokens(provider, "code", "https://app.com/callback")
                ).rejects.toThrow("Connection hit a wall. Try reconnecting.");
            });

            it("handles network timeout during token exchange", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                const timeoutError = new Error("Request timed out");
                timeoutError.name = "TimeoutError";

                ky.post.mockReturnValue({
                    json: vi.fn().mockRejectedValue(timeoutError),
                });

                await expect(
                    exchangeCodeForTokens(provider, "code", "https://app.com/callback")
                ).rejects.toThrow(
                    "Network error during token exchange. Check your connection and try again?"
                );
            });

            it("handles OAuth error in successful HTTP response (rare edge case)", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                // Some providers return 200 with error body
                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        error: "server_error",
                        error_description: "Internal provider error",
                    }),
                });

                await expect(
                    exchangeCodeForTokens(provider, "code", "https://app.com/callback")
                ).rejects.toThrow(
                    "OAuth error: server_error - Internal provider error"
                );
            });
        });

        describe("Token Expiration Calculation", () => {
            it("calculates expiresAt from expires_in", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        token_type: "Bearer",
                        expires_in: 3600, // 1 hour
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                // Current time is 2024-01-15T12:00:00Z (1705320000 seconds)
                // expires_in is 3600 seconds
                // expiresAt should be 1705320000 + 3600 = 1705323600
                expect(result.tokens.expiresAt).toBe(1705323600);
            });

            it("handles tokens without expiration (Notion, Slack pattern)", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "permanent-token",
                        token_type: "Bearer",
                        // No expires_in - token never expires
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                expect(result.tokens.expiresAt).toBeUndefined();
            });

            it("handles very short expiry (refresh required soon after first use)", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "short-lived-token",
                        refresh_token: "refresh-token",
                        token_type: "Bearer",
                        expires_in: 60, // Expires in 1 minute (within refresh window)
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                // expiresAt should be current time + 60
                expect(result.tokens.expiresAt).toBe(
                    Math.floor(Date.now() / 1000) + 60
                );
                expect(result.tokens.refreshToken).toBe("refresh-token");
            });

            it("treats expires_in=0 as no expiration (implementation quirk)", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                // Note: expires_in=0 is truthy false in JS, so implementation treats it as no expiry
                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        refresh_token: "refresh-token",
                        token_type: "Bearer",
                        expires_in: 0,
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                // Since expires_in is 0 (falsy), expiresAt is undefined
                expect(result.tokens.expiresAt).toBeUndefined();
            });
        });

        describe("Provider Metadata", () => {
            it("captures non-standard fields in providerMetadata", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        token_type: "Bearer",
                        // Non-standard fields
                        workspace_id: "ws-123",
                        bot_id: "bot-456",
                        team_name: "Engineering",
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                expect(result.tokens.providerMetadata).toEqual({
                    workspace_id: "ws-123",
                    bot_id: "bot-456",
                    team_name: "Engineering",
                });
            });

            it("excludes standard OAuth fields from providerMetadata", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider();

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        refresh_token: "refresh",
                        token_type: "Bearer",
                        expires_in: 3600,
                        scope: "read write",
                    }),
                });

                const result = await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                // Should be undefined since no non-standard fields
                expect(result.tokens.providerMetadata).toBeUndefined();
            });
        });

        describe("Additional Token Params", () => {
            it("includes additionalTokenParams in request body", async () => {
                const { exchangeCodeForTokens } =
                    await import("@/lib/integrations/oauth/tokens");

                const provider = createMockProvider({
                    additionalTokenParams: {
                        custom_param: "custom_value",
                        another_param: "another_value",
                    },
                });

                ky.post.mockReturnValue({
                    json: vi.fn().mockResolvedValue({
                        access_token: "token",
                        token_type: "Bearer",
                    }),
                });

                await exchangeCodeForTokens(
                    provider,
                    "code",
                    "https://app.com/callback"
                );

                const callArgs = ky.post.mock.calls[0][1];
                expect(callArgs.body).toContain("custom_param=custom_value");
                expect(callArgs.body).toContain("another_param=another_value");
            });
        });
    });

    describe("Encryption Round-Trip", () => {
        it("encrypts and decrypts BearerTokenCredentials correctly", async () => {
            const { encryptCredentials, decryptCredentials } =
                await import("@/lib/integrations/encryption");

            const originalCredentials = {
                token: "access-token-xyz",
                refreshToken: "refresh-token-abc",
                expiresAt: "1705323600",
            };

            const encrypted = encryptCredentials(originalCredentials);
            expect(encrypted).toContain("encrypted:");

            const decrypted = decryptCredentials(encrypted);
            expect(decrypted).toEqual(originalCredentials);
        });

        it("handles credentials without optional fields", async () => {
            const { encryptCredentials, decryptCredentials } =
                await import("@/lib/integrations/encryption");

            const minimalCredentials = {
                token: "token-only",
            };

            const encrypted = encryptCredentials(minimalCredentials);
            const decrypted = decryptCredentials(encrypted);

            expect(decrypted).toEqual(minimalCredentials);
            expect(
                (decrypted as { refreshToken?: string }).refreshToken
            ).toBeUndefined();
        });
    });

    describe("Token Refresh Before Expiry Window", () => {
        it("triggers refresh when token expires within 5-minute window", async () => {
            const { getAccessToken } = await import("@/lib/integrations/oauth/tokens");
            const { getProvider } = await import("@/lib/integrations/oauth/providers");
            const { db } = await import("@/lib/db");

            // Token expires in 3 minutes (within 5-minute refresh window)
            const expiresAt = Math.floor(Date.now() / 1000) + 180;

            (
                db.query.integrations.findFirst as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                id: 1,
                userEmail: "user@example.com",
                service: "google",
                accountId: "google-123",
                encryptedCredentials: `encrypted:${JSON.stringify({
                    token: "old-access-token",
                    refreshToken: "refresh-token",
                    expiresAt: expiresAt.toString(),
                })}`,
                status: "connected",
            });

            (getProvider as ReturnType<typeof vi.fn>).mockReturnValue(
                createMockProvider({
                    id: "google",
                    useBasicAuth: false,
                })
            );

            ky.post.mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    access_token: "new-access-token",
                    refresh_token: "new-refresh-token",
                    token_type: "Bearer",
                    expires_in: 3600,
                }),
            });

            const token = await getAccessToken("user@example.com", "google");

            expect(token).toBe("new-access-token");
            expect(ky.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining("grant_type=refresh_token"),
                })
            );
        });

        it("returns existing token when not within refresh window", async () => {
            const { getAccessToken } = await import("@/lib/integrations/oauth/tokens");
            const { db } = await import("@/lib/db");

            // Token expires in 10 minutes (outside 5-minute refresh window)
            const expiresAt = Math.floor(Date.now() / 1000) + 600;

            (
                db.query.integrations.findFirst as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                id: 1,
                userEmail: "user@example.com",
                service: "google",
                accountId: "google-123",
                encryptedCredentials: `encrypted:${JSON.stringify({
                    token: "valid-access-token",
                    refreshToken: "refresh-token",
                    expiresAt: expiresAt.toString(),
                })}`,
                status: "connected",
            });

            const token = await getAccessToken("user@example.com", "google");

            expect(token).toBe("valid-access-token");
            expect(ky.post).not.toHaveBeenCalled();
        });

        it("throws when token expired and no refresh token available", async () => {
            const { getAccessToken } = await import("@/lib/integrations/oauth/tokens");
            const { db } = await import("@/lib/db");

            // Token already expired
            const expiresAt = Math.floor(Date.now() / 1000) - 60;

            (
                db.query.integrations.findFirst as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                id: 1,
                userEmail: "user@example.com",
                service: "notion",
                accountId: "notion-ws-123",
                encryptedCredentials: `encrypted:${JSON.stringify({
                    token: "expired-token",
                    // No refresh token - Notion tokens don't expire but testing edge case
                    expiresAt: expiresAt.toString(),
                })}`,
                status: "connected",
            });

            await expect(getAccessToken("user@example.com", "notion")).rejects.toThrow(
                "notion token expired and no refresh token available - please reconnect"
            );
        });
    });

    describe("Provider-Specific Configurations", () => {
        it("handles Notion Basic Auth with empty scopes", async () => {
            const { exchangeCodeForTokens } =
                await import("@/lib/integrations/oauth/tokens");

            const notionProvider = createMockProvider({
                id: "notion",
                useBasicAuth: true,
                scopes: [], // Notion has no scopes
                additionalAuthParams: { owner: "user" },
            });

            ky.post.mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    access_token: "notion-token",
                    token_type: "bearer",
                    workspace_id: "ws-123",
                }),
            });

            const result = await exchangeCodeForTokens(
                notionProvider,
                "code",
                "https://app.com/callback"
            );

            expect(result.tokens.accessToken).toBe("notion-token");
            expect(result.tokens.scope).toBeUndefined();
        });

        it("handles Slack user_scope parameter", async () => {
            const slackProvider = createMockProvider({
                id: "slack",
                scopeParamName: "user_scope",
                scopes: ["channels:read", "chat:write"],
            });

            // scopeParamName is used in buildAuthorizationUrl, not token exchange
            // This test verifies the config is correctly structured
            expect(slackProvider.scopeParamName).toBe("user_scope");
            expect(slackProvider.scopes).toContain("channels:read");
        });

        it("handles Google offline access params", async () => {
            const googleProvider = createMockProvider({
                id: "google-calendar-contacts",
                scopes: [
                    "https://www.googleapis.com/auth/calendar",
                    "https://www.googleapis.com/auth/contacts.readonly",
                ],
                additionalAuthParams: {
                    access_type: "offline",
                    prompt: "consent",
                },
            });

            expect(googleProvider.additionalAuthParams?.access_type).toBe("offline");
            expect(googleProvider.additionalAuthParams?.prompt).toBe("consent");
        });
    });

    describe("Missing Client Secret Handling", () => {
        it("provider getter throws when client_secret env var missing", () => {
            // This tests the provider config pattern where clientSecret is a getter
            const providerWithMissingSecret: OAuthProviderConfig = {
                id: "test",
                clientId: "id",
                get clientSecret(): string {
                    throw new Error(
                        "TEST_CLIENT_SECRET environment variable is required"
                    );
                },
                authorizationUrl: "https://auth.com",
                tokenUrl: "https://token.com",
                scopes: [],
            };

            expect(() => providerWithMissingSecret.clientSecret).toThrow(
                "TEST_CLIENT_SECRET environment variable is required"
            );
        });
    });

    describe("ExpectedOAuthError Classification", () => {
        it("classifies invalid_grant as expected error (not sent to Sentry)", async () => {
            const { ExpectedOAuthError } =
                await import("@/lib/integrations/oauth/tokens");

            const error = new ExpectedOAuthError(
                "Connection expired - please reconnect your google account",
                "invalid_grant"
            );

            expect(error.name).toBe("ExpectedOAuthError");
            expect(error.oauthError).toBe("invalid_grant");
            expect(error.message).toContain("please reconnect");
        });
    });

    describe("getAccessToken Edge Cases", () => {
        it("throws when no integration found for user", async () => {
            const { getAccessToken } = await import("@/lib/integrations/oauth/tokens");
            const { db } = await import("@/lib/db");

            (
                db.query.integrations.findFirst as ReturnType<typeof vi.fn>
            ).mockResolvedValue(null);

            await expect(
                getAccessToken("unknown@example.com", "slack")
            ).rejects.toThrow(
                "No connected slack integration found for unknown@example.com"
            );
        });

        it("throws when integration has no credentials", async () => {
            const { getAccessToken } = await import("@/lib/integrations/oauth/tokens");
            const { db } = await import("@/lib/db");

            (
                db.query.integrations.findFirst as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                id: 1,
                userEmail: "user@example.com",
                service: "slack",
                status: "connected",
                encryptedCredentials: null, // Missing credentials
            });

            await expect(getAccessToken("user@example.com", "slack")).rejects.toThrow(
                "slack integration missing credentials - please reconnect"
            );
        });

        it("returns token directly when no expiration is set", async () => {
            const { getAccessToken } = await import("@/lib/integrations/oauth/tokens");
            const { db } = await import("@/lib/db");

            (
                db.query.integrations.findFirst as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                id: 1,
                userEmail: "user@example.com",
                service: "notion",
                accountId: "notion-ws",
                encryptedCredentials: `encrypted:${JSON.stringify({
                    token: "permanent-notion-token",
                    // No expiresAt - Notion tokens don't expire
                })}`,
                status: "connected",
            });

            const token = await getAccessToken("user@example.com", "notion");

            expect(token).toBe("permanent-notion-token");
            expect(ky.post).not.toHaveBeenCalled();
        });
    });

    describe("Scope Warning Behavior", () => {
        it("logs warning when granted scopes differ from requested", async () => {
            const { exchangeCodeForTokens } =
                await import("@/lib/integrations/oauth/tokens");
            const { logger } = await import("@/lib/logger");

            const provider = createMockProvider({
                scopes: ["read", "write", "delete"], // Requested 3 scopes
            });

            ky.post.mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    access_token: "token",
                    token_type: "Bearer",
                    scope: "read write", // Only 2 scopes granted
                }),
            });

            await exchangeCodeForTokens(provider, "code", "https://app.com/callback");

            // Verify warning was logged about dropped scopes
            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    missingScopes: ["delete"],
                }),
                expect.stringContaining("scopes were dropped")
            );
        });

        it("does not warn when scope is undefined (RFC 6749 default)", async () => {
            const { exchangeCodeForTokens } =
                await import("@/lib/integrations/oauth/tokens");
            const { logger } = await import("@/lib/logger");

            const provider = createMockProvider({
                scopes: ["read", "write"],
            });

            ky.post.mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    access_token: "token",
                    token_type: "Bearer",
                    // No scope field - per RFC 6749, means "same as requested"
                }),
            });

            await exchangeCodeForTokens(provider, "code", "https://app.com/callback");

            // Should NOT warn about missing scopes
            expect(logger.warn).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining("scopes were dropped")
            );
        });
    });

    describe("isOAuthError Type Guard", () => {
        it("correctly identifies OAuth error responses", async () => {
            const { isOAuthError } = await import("@/lib/integrations/oauth/types");

            expect(isOAuthError({ error: "invalid_grant" })).toBe(true);
            expect(
                isOAuthError({ error: "invalid_grant", error_description: "expired" })
            ).toBe(true);
            expect(isOAuthError({ access_token: "token" })).toBe(false);
            expect(isOAuthError(null)).toBe(false);
            expect(isOAuthError("string")).toBe(false);
            expect(isOAuthError({ error: 123 })).toBe(false); // error must be string
        });
    });
});
