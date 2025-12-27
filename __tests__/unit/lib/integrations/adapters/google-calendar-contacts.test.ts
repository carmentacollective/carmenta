/**
 * Google Calendar & Contacts Adapter Tests
 *
 * Tests authentication and core operations for the Google Calendar & Contacts adapter.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GoogleCalendarContactsAdapter } from "@/lib/integrations/adapters/google-calendar-contacts";
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

describe("GoogleCalendarContactsAdapter", () => {
    let adapter: GoogleCalendarContactsAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new GoogleCalendarContactsAdapter();
        vi.clearAllMocks();
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("google-calendar-contacts is not connected")
            );

            const result = await adapter.execute("list_calendars", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("google-calendar-contacts");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: "primary",
                            summary: "Test Calendar",
                            accessRole: "owner",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_calendars", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "google-calendar-contacts",
                undefined
            );
        });
    });

    describe("Operation Execution", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("executes list_calendars operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: "primary",
                            summary: "Test Calendar",
                            accessRole: "owner",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_calendars", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalled();
        });

        it("executes list_events operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: "event-123",
                            summary: "Test Event",
                            start: { dateTime: "2024-01-01T10:00:00Z" },
                            end: { dateTime: "2024-01-01T11:00:00Z" },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_events",
                { calendar_id: "primary" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalled();
        });

        it("executes search_contacts operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    results: [
                        {
                            person: {
                                resourceName: "people/456",
                                names: [{ displayName: "Contact Name" }],
                                emailAddresses: [{ value: "contact@example.com" }],
                            },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "search_contacts",
                { query: "contact" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
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
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute("list_calendars", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute("list_calendars", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("handles 403 permission errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute("list_calendars", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });
    });
});
