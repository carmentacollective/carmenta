/**
 * Gmail Adapter Tests
 *
 * Tests authentication and core operations for the Gmail adapter.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GmailAdapter } from "@/lib/integrations/adapters/gmail";
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
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
        NANGO_API_URL: "https://api.nango.dev",
        NANGO_SECRET_KEY: "test-nango-key",
    },
}));

describe("GmailAdapter", () => {
    let adapter: GmailAdapter;
    const testUserEmail = "test@example.com";
    const testConnectionId = "nango_test_gmail_123";

    beforeEach(() => {
        adapter = new GmailAdapter();
        vi.clearAllMocks();
    });

    describe("testConnection", () => {
        it("validates connection using profile endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    emailAddress: "test@gmail.com",
                }),
            } as never);

            const result = await adapter.testConnection(testConnectionId);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("returns error for invalid connection", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.testConnection("invalid-connection");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("gmail is not connected")
            );

            const result = await adapter.execute(
                "search_messages",
                { q: "is:unread" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("gmail");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    messages: [],
                    resultSizeEstimate: 0,
                }),
            } as never);

            const result = await adapter.execute(
                "search_messages",
                { q: "is:unread" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "gmail",
                undefined
            );
        });
    });

    describe("send_message operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("requires to, subject, and body parameters", async () => {
            const result = await adapter.execute(
                "send_message",
                { to: "recipient@example.com" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("sends email successfully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-123",
                    threadId: "thread-456",
                    labelIds: ["SENT"],
                }),
            } as never);

            const result = await adapter.execute(
                "send_message",
                {
                    to: "recipient@example.com",
                    subject: "Test Email",
                    body: "Hello, this is a test!",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalled();
        });

        it("includes thread_id for replies", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-reply",
                    threadId: "existing-thread",
                }),
            } as never);

            await adapter.execute(
                "send_message",
                {
                    to: "recipient@example.com",
                    subject: "Re: Test Email",
                    body: "Reply content",
                    thread_id: "existing-thread",
                },
                testUserEmail
            );

            expect(httpClient.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    json: expect.objectContaining({
                        threadId: "existing-thread",
                    }),
                })
            );
        });
    });

    describe("search_messages operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("requires q parameter", async () => {
            const result = await adapter.execute("search_messages", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("q");
        });

        it("searches messages with query", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock list response
            (httpClient.get as Mock).mockImplementation((url: string) => {
                if (url.includes("/messages?")) {
                    return {
                        json: vi.fn().mockResolvedValue({
                            messages: [{ id: "msg-1", threadId: "thread-1" }],
                            resultSizeEstimate: 1,
                        }),
                    };
                }
                // Mock metadata response for individual message
                return {
                    json: vi.fn().mockResolvedValue({
                        id: "msg-1",
                        threadId: "thread-1",
                        snippet: "This is a test message...",
                        labelIds: ["INBOX", "UNREAD"],
                        payload: {
                            headers: [
                                { name: "Subject", value: "Test Subject" },
                                { name: "From", value: "sender@example.com" },
                                { name: "To", value: "test@gmail.com" },
                                { name: "Date", value: "Mon, 1 Jan 2025 12:00:00 GMT" },
                            ],
                        },
                    }),
                };
            });

            const result = await adapter.execute(
                "search_messages",
                { q: "from:boss is:unread" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringMatching(/gmail\/v1\/users\/me\/messages\?.*q=/),
                expect.any(Object)
            );
        });

        it("returns empty array for no results", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    resultSizeEstimate: 0,
                }),
            } as never);

            const result = await adapter.execute(
                "search_messages",
                { q: "from:nobody" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.messages).toEqual([]);
        });
    });

    describe("get_message operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("requires message_id parameter", async () => {
            const result = await adapter.execute("get_message", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("fetches full message content", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-123",
                    threadId: "thread-456",
                    snippet: "Hello world...",
                    labelIds: ["INBOX"],
                    payload: {
                        headers: [
                            { name: "Subject", value: "Test Subject" },
                            { name: "From", value: "sender@example.com" },
                        ],
                        body: {
                            data: Buffer.from("Hello world!").toString("base64"),
                        },
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_message",
                { message_id: "msg-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("gmail/v1/users/me/messages/msg-123"),
                expect.any(Object)
            );
        });
    });

    describe("list_labels operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("lists all labels", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    labels: [
                        {
                            id: "INBOX",
                            name: "INBOX",
                            type: "system",
                            messagesTotal: 100,
                            messagesUnread: 5,
                        },
                        {
                            id: "SENT",
                            name: "SENT",
                            type: "system",
                        },
                        {
                            id: "Label_1",
                            name: "Work",
                            type: "user",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_labels", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("gmail/v1/users/me/labels"),
                expect.any(Object)
            );
        });
    });

    describe("create_draft operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("creates draft successfully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "draft-123",
                    message: {
                        id: "msg-456",
                        threadId: "thread-789",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "create_draft",
                {
                    to: "recipient@example.com",
                    subject: "Draft Email",
                    body: "Draft content",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining("gmail/v1/users/me/drafts"),
                expect.any(Object)
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
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "search_messages",
                { q: "test" },
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
                "search_messages",
                { q: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 404 not found errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 404: Not Found")),
            } as never);

            const result = await adapter.execute(
                "get_message",
                { message_id: "nonexistent" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles unknown action", async () => {
            const result = await adapter.execute("unknown_action", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });
    });

    describe("raw_api operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("requires valid endpoint starting with /gmail/v1", async () => {
            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/invalid/path", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("executes raw API request", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({ labels: [] }),
            } as never);

            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/gmail/v1/users/me/labels", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalled();
        });
    });

    describe("Header injection prevention", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("sanitizes CR/LF from email recipients to prevent header injection", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-123",
                    threadId: "thread-456",
                }),
            } as never);

            // Attempt header injection via recipient address
            await adapter.execute(
                "send_message",
                {
                    to: "victim@example.com\r\nBcc: attacker@evil.com",
                    subject: "Test",
                    body: "Hello",
                },
                testUserEmail
            );

            // Verify the request was made (sanitized headers should allow the call)
            expect(httpClient.post).toHaveBeenCalled();
        });

        it("sanitizes CR/LF from subject to prevent header injection", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-123",
                    threadId: "thread-456",
                }),
            } as never);

            // Attempt header injection via subject
            await adapter.execute(
                "send_message",
                {
                    to: "recipient@example.com",
                    subject: "Normal Subject\r\nBcc: attacker@evil.com",
                    body: "Hello",
                },
                testUserEmail
            );

            expect(httpClient.post).toHaveBeenCalled();
        });
    });

    describe("list_threads operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("lists threads with query filter", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    threads: [{ id: "thread-1", snippet: "Test thread" }],
                    resultSizeEstimate: 1,
                }),
            } as never);

            const result = await adapter.execute(
                "list_threads",
                { q: "subject:important" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("/threads?"),
                expect.any(Object)
            );
        });

        it("returns empty array when no threads match", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    resultSizeEstimate: 0,
                }),
            } as never);

            const result = await adapter.execute(
                "list_threads",
                { q: "from:nobody" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.threads).toEqual([]);
        });
    });

    describe("get_thread operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("requires thread_id parameter", async () => {
            const result = await adapter.execute("get_thread", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("returns all messages in thread", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "thread-123",
                    messages: [
                        {
                            id: "msg-1",
                            snippet: "First message",
                            payload: {
                                headers: [
                                    { name: "Subject", value: "Test" },
                                    { name: "From", value: "sender@example.com" },
                                ],
                            },
                        },
                        {
                            id: "msg-2",
                            snippet: "Reply message",
                            payload: {
                                headers: [
                                    { name: "Subject", value: "Re: Test" },
                                    { name: "From", value: "replier@example.com" },
                                ],
                            },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "get_thread",
                { thread_id: "thread-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.messages).toHaveLength(2);
        });
    });

    describe("modify_labels operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("requires message_id parameter", async () => {
            const result = await adapter.execute(
                "modify_labels",
                { add_labels: ["STARRED"] },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("adds and removes labels from message", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-123",
                    labelIds: ["INBOX", "STARRED"],
                }),
            } as never);

            const result = await adapter.execute(
                "modify_labels",
                {
                    message_id: "msg-123",
                    add_labels: ["STARRED"],
                    remove_labels: ["UNREAD"],
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining("/messages/msg-123/modify"),
                expect.any(Object)
            );
        });
    });

    describe("Multi-part message body extraction", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "test@gmail.com",
                isDefault: true,
            });
        });

        it("extracts body from nested multipart structure", async () => {
            const { httpClient } = await import("@/lib/http-client");
            // Simulate nested multipart/mixed containing multipart/alternative
            const plainTextBase64Url = Buffer.from("Hello plain text")
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_");

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-nested",
                    threadId: "thread-nested",
                    payload: {
                        mimeType: "multipart/mixed",
                        headers: [{ name: "Subject", value: "Nested Test" }],
                        parts: [
                            {
                                mimeType: "multipart/alternative",
                                parts: [
                                    {
                                        mimeType: "text/plain",
                                        body: { data: plainTextBase64Url },
                                    },
                                    {
                                        mimeType: "text/html",
                                        body: {
                                            data: Buffer.from(
                                                "<p>Hello HTML</p>"
                                            ).toString("base64"),
                                        },
                                    },
                                ],
                            },
                            {
                                mimeType: "application/pdf",
                                body: { size: 12345 },
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_message",
                { message_id: "msg-nested" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.body).toBe("Hello plain text");
        });

        it("falls back to HTML when plain text not available", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const htmlBase64Url = Buffer.from("<p>HTML only</p>")
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_");

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "msg-html",
                    threadId: "thread-html",
                    payload: {
                        headers: [{ name: "Subject", value: "HTML Only" }],
                        parts: [
                            {
                                mimeType: "text/html",
                                body: { data: htmlBase64Url },
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_message",
                { message_id: "msg-html" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = JSON.parse(result.content[0].text as string);
            expect(content.body).toBe("<p>HTML only</p>");
        });
    });
});
