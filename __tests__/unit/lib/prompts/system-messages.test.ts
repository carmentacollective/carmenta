import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemMessages, type UserContext } from "@/lib/prompts/system-messages";
import type { User } from "@clerk/nextjs/server";

// Mock the system prompt to keep tests focused
vi.mock("@/lib/prompts/system", () => ({
    SYSTEM_PROMPT: "Static system prompt content for testing",
}));

// Mock the KB profile module to avoid database calls in unit tests
vi.mock("@/lib/kb/profile", () => ({
    compileUserContext: vi.fn().mockResolvedValue(""),
}));

describe("buildSystemMessages", () => {
    // Fix Date to ensure consistent test results
    const fixedDate = new Date("2025-06-15T14:30:00Z");

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(fixedDate);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("message structure", () => {
        it("returns array with exactly two system messages (no profile)", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = await buildSystemMessages(context);

            expect(messages).toHaveLength(2);
            expect(messages[0].role).toBe("system");
            expect(messages[1].role).toBe("system");
        });

        it("first message contains static prompt with cache control", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = await buildSystemMessages(context);

            expect(messages[0].content).toBe(
                "Static system prompt content for testing"
            );
            expect(messages[0].providerOptions).toEqual({
                anthropic: {
                    cacheControl: { type: "ephemeral" },
                },
            });
        });

        it("second message contains session context without cache control", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = await buildSystemMessages(context);

            expect(messages[1].content).toContain("## Session Context");
            expect(messages[1].providerOptions).toBeUndefined();
        });
    });

    describe("profile context", () => {
        it("includes profile context as third message when userId is provided and profile exists", async () => {
            // Re-mock to return actual content
            const { compileUserContext } = await import("@/lib/kb/profile");
            vi.mocked(compileUserContext).mockResolvedValueOnce(
                "## About Who We're Working With\n\nName: Test User"
            );

            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                userId: "test-user-uuid",
            };

            const messages = await buildSystemMessages(context);

            expect(messages).toHaveLength(3);
            expect(messages[2].content).toContain("About Who We're Working With");
            expect(messages[2].providerOptions).toBeUndefined();
        });

        it("does not include profile message when userId is not provided", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                // userId not provided
            };

            const messages = await buildSystemMessages(context);

            expect(messages).toHaveLength(2);
        });

        it("does not include profile message when profile is empty", async () => {
            const { compileUserContext } = await import("@/lib/kb/profile");
            vi.mocked(compileUserContext).mockResolvedValueOnce("");

            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                userId: "test-user-uuid",
            };

            const messages = await buildSystemMessages(context);

            expect(messages).toHaveLength(2);
        });
    });

    describe("date formatting and guidance", () => {
        it("includes date in natural sentence format", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                timezone: undefined,
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("Today is");
            expect(dynamicContent).toContain("Sunday, June 15, 2025");
        });

        it("includes time when timezone is provided", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                timezone: "America/Los_Angeles",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            // 14:30 UTC = 7:30 AM Pacific (during daylight saving time in June)
            expect(dynamicContent).toContain("7:30 AM");
        });

        it("includes guidance on temporal awareness", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("knowledge cutoff");
            expect(dynamicContent).toContain("web search");
        });
    });

    describe("user name handling", () => {
        it("uses fullName when available", async () => {
            const context: UserContext = {
                user: {
                    fullName: "John Doe",
                    firstName: "John",
                    lastName: "Doe",
                    emailAddresses: [{ emailAddress: "john@example.com" }],
                } as unknown as User,
                userEmail: "john@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with John Doe.");
        });

        it("uses firstName + lastName when fullName is missing", async () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: "Jane",
                    lastName: "Smith",
                    emailAddresses: [{ emailAddress: "jane@example.com" }],
                } as unknown as User,
                userEmail: "jane@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with Jane Smith.");
        });

        it("omits name section when user has no name (not email fallback)", async () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: null,
                    lastName: null,
                    emailAddresses: [{ emailAddress: "anon@example.com" }],
                } as unknown as User,
                userEmail: "anon@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            // Should NOT include email as name - that's not genuine personalization
            expect(dynamicContent).not.toContain("We're working with");
            expect(dynamicContent).not.toContain("anon@example.com");
        });

        it("omits name section when user is null", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "anonymous@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).not.toContain("We're working with");
        });

        it("includes guidance on thoughtful name usage when name is present", async () => {
            const context: UserContext = {
                user: {
                    fullName: "Nick Sullivan",
                    firstName: "Nick",
                    lastName: "Sullivan",
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "nick@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("Use their name naturally");
            expect(dynamicContent).toContain("Avoid overusing");
            expect(dynamicContent).toContain("performative");
        });

        it("does not include name guidance when no name is available", async () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).not.toContain("Use their name");
        });
    });

    describe("edge cases", () => {
        it("handles firstName only (no lastName)", async () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: "Alice",
                    lastName: null,
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "alice@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with Alice.");
        });

        it("handles lastName only (no firstName)", async () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: null,
                    lastName: "Johnson",
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "johnson@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with Johnson.");
        });

        it("handles empty string names by omitting name section", async () => {
            const context: UserContext = {
                user: {
                    fullName: "",
                    firstName: "",
                    lastName: "",
                    emailAddresses: [{ emailAddress: "empty@example.com" }],
                } as unknown as User,
                userEmail: "empty@example.com",
            };

            const messages = await buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            // Empty strings should not result in name being shown
            expect(dynamicContent).not.toContain("We're working with");
        });
    });
});
