import { describe, it, expect } from "vitest";
import { generateConnectionId, generateSlug, extractIdFromSlug } from "@/lib/nanoid";

describe("generateConnectionId", () => {
    it("generates 12-character alphanumeric ID", () => {
        const id = generateConnectionId();
        expect(id).toHaveLength(12);
        expect(id).toMatch(/^[0-9a-z]{12}$/);
    });

    it("generates unique IDs", () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateConnectionId()));
        expect(ids.size).toBe(100);
    });
});

describe("generateSlug", () => {
    it("generates slug from title and ID", () => {
        const slug = generateSlug("Fix authentication bug", "a1b2c3d4e5f6");
        expect(slug).toBe("fix-authentication-bug-a1b2c3d4e5f6");
    });

    it("handles null title", () => {
        const slug = generateSlug(null, "a1b2c3d4e5f6");
        expect(slug).toBe("connection-a1b2c3d4e5f6");
    });

    it("handles undefined title", () => {
        const slug = generateSlug(undefined, "a1b2c3d4e5f6");
        expect(slug).toBe("connection-a1b2c3d4e5f6");
    });

    it("handles empty string title", () => {
        const slug = generateSlug("", "a1b2c3d4e5f6");
        expect(slug).toBe("connection-a1b2c3d4e5f6");
    });

    it("handles emoji-only title with fallback", () => {
        const slug = generateSlug("✨🎉🔥", "xyz789abc123");
        expect(slug).toBe("connection-xyz789abc123");
    });

    it("strips emojis but keeps text", () => {
        const slug = generateSlug("✨ Add dark mode", "xyz789abc123");
        expect(slug).toBe("add-dark-mode-xyz789abc123");
    });

    it("converts to lowercase", () => {
        const slug = generateSlug("FIX Auth BUG", "a1b2c3d4e5f6");
        expect(slug).toBe("fix-auth-bug-a1b2c3d4e5f6");
    });

    it("replaces spaces with hyphens", () => {
        const slug = generateSlug("multiple   spaces   here", "a1b2c3d4e5f6");
        expect(slug).toBe("multiple-spaces-here-a1b2c3d4e5f6");
    });

    it("removes special characters", () => {
        const slug = generateSlug("What's the bug? Fix it!", "a1b2c3d4e5f6");
        expect(slug).toBe("whats-the-bug-fix-it-a1b2c3d4e5f6");
    });

    it("truncates very long titles", () => {
        const longTitle = "a".repeat(100);
        const slug = generateSlug(longTitle, "a1b2c3d4e5f6");
        // 60 char max for title + hyphen + 12 char ID = 73 chars
        expect(slug.length).toBeLessThanOrEqual(73);
        expect(slug.endsWith("-a1b2c3d4e5f6")).toBe(true);
    });

    it("handles title with only special characters", () => {
        const slug = generateSlug("!@#$%^&*()", "a1b2c3d4e5f6");
        expect(slug).toBe("connection-a1b2c3d4e5f6");
    });
});

describe("extractIdFromSlug", () => {
    it("extracts ID from slug with title", () => {
        const id = extractIdFromSlug("fix-auth-bug-a1b2c3d4e5f6");
        expect(id).toBe("a1b2c3d4e5f6");
    });

    it("extracts ID from slug without title", () => {
        const id = extractIdFromSlug("connection-a1b2c3d4e5f6");
        expect(id).toBe("a1b2c3d4e5f6");
    });

    it("extracts ID from ID-only slug", () => {
        const id = extractIdFromSlug("a1b2c3d4e5f6");
        expect(id).toBe("a1b2c3d4e5f6");
    });

    it("throws on slug that is too short", () => {
        expect(() => extractIdFromSlug("abc")).toThrow("too short");
    });

    it("throws on empty slug", () => {
        expect(() => extractIdFromSlug("")).toThrow("too short");
    });

    it("throws on slug with invalid ID characters", () => {
        expect(() => extractIdFromSlug("title-ABCDEFGHIJKL")).toThrow(
            "lowercase alphanumeric"
        );
    });

    it("throws on slug with uppercase ID", () => {
        expect(() => extractIdFromSlug("title-A1B2C3D4E5F6")).toThrow(
            "lowercase alphanumeric"
        );
    });

    it("throws on slug with special characters in ID", () => {
        expect(() => extractIdFromSlug("title-a1b2c3d4e5f!")).toThrow(
            "lowercase alphanumeric"
        );
    });
});
