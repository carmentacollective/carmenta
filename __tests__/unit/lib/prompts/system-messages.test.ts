import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemMessages, type UserContext } from "@/lib/prompts/system-messages";
import type { User } from "@clerk/nextjs/server";

// Mock the system prompt to keep tests focused
vi.mock("@/lib/prompts/system", () => ({
    SYSTEM_PROMPT: "Static system prompt content for testing",
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
        it("returns array with exactly two system messages", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = buildSystemMessages(context);

            expect(messages).toHaveLength(2);
            expect(messages[0].role).toBe("system");
            expect(messages[1].role).toBe("system");
        });

        it("first message contains static prompt with cache control", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = buildSystemMessages(context);

            expect(messages[0].content).toBe(
                "Static system prompt content for testing"
            );
            expect(messages[0].providerOptions).toEqual({
                anthropic: {
                    cacheControl: { type: "ephemeral" },
                },
            });
        });

        it("second message contains session context without cache control", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = buildSystemMessages(context);

            expect(messages[1].content).toContain("## Session Context");
            expect(messages[1].providerOptions).toBeUndefined();
        });
    });

    describe("date formatting and guidance", () => {
        it("includes date in natural sentence format", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                timezone: undefined,
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("Today is");
            expect(dynamicContent).toContain("Sunday, June 15, 2025");
        });

        it("includes time when timezone is provided", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                timezone: "America/Los_Angeles",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            // 14:30 UTC = 7:30 AM Pacific (during daylight saving time in June)
            expect(dynamicContent).toContain("7:30 AM");
        });

        it("includes guidance on temporal awareness", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("knowledge cutoff");
            expect(dynamicContent).toContain("web search");
        });
    });

    describe("user name handling", () => {
        it("uses fullName when available", () => {
            const context: UserContext = {
                user: {
                    fullName: "John Doe",
                    firstName: "John",
                    lastName: "Doe",
                    emailAddresses: [{ emailAddress: "john@example.com" }],
                } as unknown as User,
                userEmail: "john@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with John Doe.");
        });

        it("uses firstName + lastName when fullName is missing", () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: "Jane",
                    lastName: "Smith",
                    emailAddresses: [{ emailAddress: "jane@example.com" }],
                } as unknown as User,
                userEmail: "jane@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with Jane Smith.");
        });

        it("omits name section when user has no name (not email fallback)", () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: null,
                    lastName: null,
                    emailAddresses: [{ emailAddress: "anon@example.com" }],
                } as unknown as User,
                userEmail: "anon@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            // Should NOT include email as name - that's not genuine personalization
            expect(dynamicContent).not.toContain("We're working with");
            expect(dynamicContent).not.toContain("anon@example.com");
        });

        it("omits name section when user is null", () => {
            const context: UserContext = {
                user: null,
                userEmail: "anonymous@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).not.toContain("We're working with");
        });

        it("includes guidance on thoughtful name usage when name is present", () => {
            const context: UserContext = {
                user: {
                    fullName: "Nick Sullivan",
                    firstName: "Nick",
                    lastName: "Sullivan",
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "nick@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("Use their name naturally");
            expect(dynamicContent).toContain("Avoid overusing");
            expect(dynamicContent).toContain("performative");
        });

        it("does not include name guidance when no name is available", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).not.toContain("Use their name");
        });
    });

    describe("edge cases", () => {
        it("handles firstName only (no lastName)", () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: "Alice",
                    lastName: null,
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "alice@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with Alice.");
        });

        it("handles lastName only (no firstName)", () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: null,
                    lastName: "Johnson",
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "johnson@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("We're working with Johnson.");
        });

        it("handles empty string names by omitting name section", () => {
            const context: UserContext = {
                user: {
                    fullName: "",
                    firstName: "",
                    lastName: "",
                    emailAddresses: [{ emailAddress: "empty@example.com" }],
                } as unknown as User,
                userEmail: "empty@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            // Empty strings should not result in name being shown
            expect(dynamicContent).not.toContain("We're working with");
        });
    });
});
