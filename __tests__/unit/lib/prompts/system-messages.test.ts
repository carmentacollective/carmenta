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

        it("second message contains dynamic content without cache control", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
            };

            const messages = buildSystemMessages(context);

            expect(messages[1].content).toContain("## Current Context");
            expect(messages[1].providerOptions).toBeUndefined();
        });
    });

    describe("date and time formatting", () => {
        it("shows only date when timezone is not provided", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                timezone: undefined,
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("Date:");
            expect(dynamicContent).not.toContain("Time:");
            expect(dynamicContent).not.toContain("Timezone:");
        });

        it("shows date, time, and timezone when timezone is provided", () => {
            const context: UserContext = {
                user: null,
                userEmail: "test@example.com",
                timezone: "America/New_York",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain("Date and time:");
            expect(dynamicContent).toContain("Timezone: America/New_York");
        });

        it("formats date and time in user timezone when provided", () => {
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
    });

    describe("user identification", () => {
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

        it("uses email from user object when name is missing", () => {
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

            expect(dynamicContent).toContain("We're working with anon@example.com.");
        });

        it("uses userEmail when user is null", () => {
            const context: UserContext = {
                user: null,
                userEmail: "fallback@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain(
                "We're working with fallback@example.com."
            );
        });

        it("skips user greeting for dev-user@local", () => {
            const context: UserContext = {
                user: null,
                userEmail: "dev-user@local",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).not.toContain("We're working with");
        });

        it("uses userEmail as final fallback when user has no identifiable info", () => {
            const context: UserContext = {
                user: {
                    fullName: null,
                    firstName: null,
                    lastName: null,
                    emailAddresses: [],
                } as unknown as User,
                userEmail: "context-email@example.com",
            };

            const messages = buildSystemMessages(context);
            const dynamicContent = messages[1].content;

            expect(dynamicContent).toContain(
                "We're working with context-email@example.com."
            );
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

        it("handles empty string names gracefully", () => {
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

            expect(dynamicContent).toContain("We're working with empty@example.com.");
        });
    });
});
