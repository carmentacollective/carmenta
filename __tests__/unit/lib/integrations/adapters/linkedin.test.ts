/**
 * LinkedIn Adapter Tests
 *
 * Tests authentication and core operations for the LinkedIn adapter.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { LinkedInAdapter } from "@/lib/integrations/adapters/linkedin";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("LinkedInAdapter", () => {
    let adapter: LinkedInAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new LinkedInAdapter();
        vi.clearAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("linkedin");
            expect(adapter.serviceDisplayName).toBe("LinkedIn");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation with all operations", () => {
            const help = adapter.getHelp();
            expect(help.service).toBe("LinkedIn");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBe(4); // get_profile, create_post, get_organization, raw_api
            expect(help.docsUrl).toBe("https://learn.microsoft.com/en-us/linkedin/");
            expect(help.commonOperations).toContain("get_profile");
            expect(help.commonOperations).toContain("create_post");
            expect(help.commonOperations).toContain("get_organization");
        });

        it("includes correct operation names", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);
            expect(operationNames).toContain("get_profile");
            expect(operationNames).toContain("create_post");
            expect(operationNames).toContain("get_organization");
            expect(operationNames).toContain("raw_api");
        });
    });

    describe("Connection Testing", () => {
        it("validates connection using /v2/userinfo endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                    name: "Test User",
                }),
            } as never);

            const result = await adapter.testConnection("test-access-token");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalledWith(
                "https://api.linkedin.com/v2/userinfo",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-access-token",
                    }),
                })
            );
        });

        it("returns error for connection failure", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.testConnection("invalid-token");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("Authentication", () => {
        it("returns error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("linkedin is not connected")
            );

            const result = await adapter.execute("get_profile", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("linkedin is not connected"),
            });
        });

        it("returns error when accessToken is missing", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: null, // Missing accessToken
            });

            const result = await adapter.execute("get_profile", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });
    });

    describe("get_profile operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "linkedin-12345",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("successfully fetches user profile", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                    name: "Test User",
                    given_name: "Test",
                    family_name: "User",
                    email: "test@example.com",
                    email_verified: true,
                    picture: "https://media.linkedin.com/photo.jpg",
                }),
            } as never);

            const result = await adapter.execute("get_profile", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"id": "linkedin-12345"');
            expect(result.content[0].text).toContain('"name": "Test User"');
            expect(result.content[0].text).toContain('"email": "test@example.com"');
        });
    });

    describe("create_post operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "linkedin-12345",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires text parameter", async () => {
            const result = await adapter.execute("create_post", {}, testUserEmail);

            expect(result.isError).toBe(true);
            const textContent = result.content[0] as { text: string };
            expect(textContent.text.toLowerCase()).toContain("text");
        });

        it("returns error when post is too long", async () => {
            const longText = "a".repeat(3001);
            const result = await adapter.execute(
                "create_post",
                { text: longText },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("too long");
        });

        it("validates visibility parameter", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                }),
            } as never);

            const result = await adapter.execute(
                "create_post",
                { text: "Test post", visibility: "INVALID" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("visibility");
        });

        it("successfully creates a post", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                }),
            } as never);

            // Mock creating post
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "urn:li:ugcPost:1234567890",
                }),
            } as never);

            const result = await adapter.execute(
                "create_post",
                { text: "Excited to share my new project!" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"success": true');
            expect(result.content[0].text).toContain(
                '"postId": "urn:li:ugcPost:1234567890"'
            );
        });

        it("uses PUBLIC visibility by default", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                }),
            } as never);

            // Mock creating post
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "urn:li:ugcPost:1234567890",
                }),
            } as never);

            const result = await adapter.execute(
                "create_post",
                { text: "Test post" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"visibility": "PUBLIC"');
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    json: expect.objectContaining({
                        visibility: {
                            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
                        },
                    }),
                })
            );
        });

        it("supports CONNECTIONS visibility", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                }),
            } as never);

            // Mock creating post
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "urn:li:ugcPost:1234567890",
                }),
            } as never);

            const result = await adapter.execute(
                "create_post",
                { text: "Test post", visibility: "CONNECTIONS" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"visibility": "CONNECTIONS"');
        });
    });

    describe("get_organization operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "linkedin-12345",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires organizationId or vanityName", async () => {
            const result = await adapter.execute("get_organization", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("organizationId");
            expect(result.content[0].text).toContain("vanityName");
        });

        it("successfully gets organization by ID", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: 1441,
                    localizedName: "Microsoft",
                    localizedDescription: "Empower every person and organization",
                    vanityName: "microsoft",
                    websiteUrl: "https://www.microsoft.com",
                }),
            } as never);

            const result = await adapter.execute(
                "get_organization",
                { organizationId: "1441" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"name": "Microsoft"');
            expect(httpClient.get).toHaveBeenCalledWith(
                "https://api.linkedin.com/v2/organizations/1441",
                expect.any(Object)
            );
        });

        it("successfully gets organization by vanity name", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    elements: [
                        {
                            id: 1441,
                            localizedName: "Microsoft",
                            localizedDescription:
                                "Empower every person and organization",
                            vanityName: "microsoft",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "get_organization",
                { vanityName: "microsoft" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"name": "Microsoft"');
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("q=vanityName"),
                expect.any(Object)
            );
        });
    });

    describe("raw_api operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "linkedin-12345",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires endpoint parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                { method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("endpoint");
        });

        it("requires method parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/v2/me" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("method");
        });

        it("validates endpoint starts with /v2", async () => {
            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/invalid/endpoint", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("/v2");
        });

        it("successfully executes raw API call", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    sub: "linkedin-12345",
                    name: "Test User",
                }),
            } as never);

            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/v2/userinfo", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"sub": "linkedin-12345"');
        });

        it("handles POST requests with body", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "urn:li:ugcPost:123",
                }),
            } as never);

            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v2/ugcPosts",
                    method: "POST",
                    body: { author: "urn:li:person:123" },
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                "https://api.linkedin.com/v2/ugcPosts",
                expect.objectContaining({
                    json: { author: "urn:li:person:123" },
                })
            );
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "linkedin-12345",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute("get_profile", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute("get_profile", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("returns error for unknown action", async () => {
            const result = await adapter.execute("unknown_action", {}, testUserEmail);

            expect(result.isError).toBe(true);
            // The base adapter validates actions and returns "We don't recognize" error
            expect(result.content[0].text).toContain("don't recognize");
        });
    });

    describe("Validation", () => {
        it("validates required parameters for create_post", () => {
            const validation = adapter.validate("create_post", {});

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        it("accepts valid parameters for create_post", () => {
            const validation = adapter.validate("create_post", {
                text: "Hello LinkedIn!",
            });

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it("allows get_profile without parameters", () => {
            const validation = adapter.validate("get_profile", {});

            expect(validation.valid).toBe(true);
        });
    });
});
