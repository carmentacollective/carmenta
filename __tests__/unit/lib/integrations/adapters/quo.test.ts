/**
 * Quo Adapter Tests
 *
 * Tests authentication and core operations for the Quo (formerly OpenPhone) adapter.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { QuoAdapter } from "@/lib/integrations/adapters/quo";
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
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("QuoAdapter", () => {
    let adapter: QuoAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new QuoAdapter();
        vi.clearAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("quo");
            expect(adapter.serviceDisplayName).toBe("Quo");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();
            expect(help.service).toBe("Quo");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(5);
            expect(help.docsUrl).toBe(
                "https://www.quo.com/docs/mdx/api-reference/introduction"
            );
            expect(help.commonOperations).toEqual([
                "list_messages",
                "send_message",
                "list_phone_numbers",
            ]);
        });
    });

    describe("Connection Testing", () => {
        it("validates API key using phone-numbers endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [],
                }),
            } as never);

            const result = await adapter.testConnection("test-api-key");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/phone-numbers"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-api-key",
                    }),
                })
            );
        });

        it("returns error for invalid API key (401)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.testConnection("invalid-key");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns error for rate limit (429)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.testConnection("rate-limited-key");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("quo is not connected")
            );

            const result = await adapter.execute(
                "list_messages",
                { phoneNumberId: "PN123", participants: ["+14155551234"] },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringMatching(/connect.*quo/i),
            });
        });
    });

    describe("list_messages operation", () => {
        it("requires phoneNumberId parameter", async () => {
            const result = await adapter.execute(
                "list_messages",
                { participants: ["+14155551234"] },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("phoneNumberId"),
            });
        });

        it("requires participants parameter", async () => {
            const result = await adapter.execute(
                "list_messages",
                { phoneNumberId: "PN123" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("participants"),
            });
        });

        it("lists messages with correct parameters", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: "msg-123",
                            from: "+14155550100",
                            to: ["+14155551234"],
                            text: "Hello!",
                            direction: "outgoing",
                            status: "delivered",
                            createdAt: "2024-01-15T10:00:00Z",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_messages",
                { phoneNumberId: "PN123", participants: ["+14155551234"] },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/messages"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-key",
                    }),
                    searchParams: expect.objectContaining({
                        phoneNumberId: "PN123",
                        participants: "+14155551234",
                    }),
                })
            );
        });

        it("applies limit parameter", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [],
                }),
            } as never);

            await adapter.execute(
                "list_messages",
                {
                    phoneNumberId: "PN123",
                    participants: ["+14155551234"],
                    limit: 20,
                },
                testUserEmail
            );

            expect(httpClient.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        maxResults: "20",
                    }),
                })
            );
        });
    });

    describe("send_message operation", () => {
        it("requires from parameter", async () => {
            const result = await adapter.execute(
                "send_message",
                { to: ["+14155551234"], content: "Hello" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("from"),
            });
        });

        it("requires to parameter", async () => {
            const result = await adapter.execute(
                "send_message",
                { from: "+14155550100", content: "Hello" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("to"),
            });
        });

        it("requires content parameter", async () => {
            const result = await adapter.execute(
                "send_message",
                { from: "+14155550100", to: ["+14155551234"] },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("content"),
            });
        });

        it("sends message with correct payload", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-456",
                    from: "+14155550100",
                    to: ["+14155551234"],
                    status: "queued",
                    createdAt: "2024-01-15T10:00:00Z",
                }),
            } as never);

            const result = await adapter.execute(
                "send_message",
                {
                    from: "+14155550100",
                    to: ["+14155551234"],
                    content: "Hello from Carmenta!",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/messages"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-key",
                    }),
                    json: {
                        from: "+14155550100",
                        to: ["+14155551234"],
                        content: "Hello from Carmenta!",
                    },
                })
            );
        });
    });

    describe("list_phone_numbers operation", () => {
        it("lists phone numbers", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: "PN123",
                            phoneNumber: "+14155550100",
                            name: "Main Line",
                            users: [{ userId: "user-1", role: "owner" }],
                            createdAt: "2024-01-01T00:00:00Z",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_phone_numbers",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/phone-numbers"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-key",
                    }),
                })
            );
        });
    });

    describe("list_contacts operation", () => {
        it("lists contacts", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: "contact-123",
                            firstName: "John",
                            lastName: "Doe",
                            phoneNumbers: [{ name: "mobile", value: "+14155551234" }],
                            createdAt: "2024-01-01T00:00:00Z",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_contacts", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/contacts"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-key",
                    }),
                })
            );
        });
    });

    describe("create_contact operation", () => {
        it("creates a contact", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "contact-456",
                    firstName: "Jane",
                    lastName: "Smith",
                    createdAt: "2024-01-15T10:00:00Z",
                }),
            } as never);

            const result = await adapter.execute(
                "create_contact",
                {
                    firstName: "Jane",
                    lastName: "Smith",
                    phoneNumbers: [{ name: "mobile", value: "+14155559999" }],
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/contacts"),
                expect.objectContaining({
                    json: expect.objectContaining({
                        firstName: "Jane",
                        lastName: "Smith",
                    }),
                })
            );
        });
    });

    describe("delete_contact operation", () => {
        it("requires contactId parameter", async () => {
            const result = await adapter.execute("delete_contact", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("contactId"),
            });
        });

        it("deletes a contact", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.delete as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({}),
            } as never);

            const result = await adapter.execute(
                "delete_contact",
                { contactId: "contact-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.delete).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/contacts/contact-123"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-key",
                    }),
                })
            );
        });
    });

    describe("list_calls operation", () => {
        it("requires phoneNumberId parameter", async () => {
            const result = await adapter.execute("list_calls", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("phoneNumberId"),
            });
        });

        it("lists calls for a phone number", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: "call-123",
                            from: "+14155550100",
                            to: "+14155551234",
                            direction: "outgoing",
                            status: "completed",
                            duration: 120,
                            createdAt: "2024-01-15T10:00:00Z",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_calls",
                { phoneNumberId: "PN123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/calls"),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        phoneNumberId: "PN123",
                    }),
                })
            );
        });
    });

    describe("raw_api operation", () => {
        it("requires endpoint parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                { method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("endpoint"),
            });
        });

        it("requires method parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/v1/messages" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("method"),
            });
        });

        it("validates endpoint starts with /v1/", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/invalid/path", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("/v1/"),
            });
        });

        it("executes raw API request", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [{ id: "user-1", email: "test@example.com" }],
                }),
            } as never);

            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/v1/users", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.openphone.com/v1/users"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "test-key",
                    }),
                })
            );
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-api-key" },
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "list_phone_numbers",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute(
                "list_phone_numbers",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles unknown action", async () => {
            const result = await adapter.execute("unknown_action", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("unknown_action"),
            });
        });
    });
});
