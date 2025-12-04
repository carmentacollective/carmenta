import { describe, it, expect } from "vitest";
import {
    generateConnectionId,
    generateSlug,
    extractIdFromSlug,
    decodeSqid,
} from "@/lib/sqids";

describe("generateConnectionId", () => {
    it("generates 6+ character alphanumeric ID", () => {
        const id = generateConnectionId();
        expect(id.length).toBeGreaterThanOrEqual(6);
        expect(id).toMatch(/^[0-9a-z]+$/);
    });

    it("generates unique IDs", () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateConnectionId()));
        expect(ids.size).toBe(100);
    });

    it("generates IDs that can be decoded", () => {
        const id = generateConnectionId();
        const decoded = decodeSqid(id);
        expect(decoded).toHaveLength(1); // We encode one 24-bit number
        expect(decoded[0]).toBeGreaterThanOrEqual(0);
        expect(decoded[0]).toBeLessThan(16777216); // 2^24
    });
});

describe("generateSlug", () => {
    it("generates slug from title and ID", () => {
        const slug = generateSlug("Fix authentication bug", "2ot9ib");
        expect(slug).toBe("fix-authentication-bug-2ot9ib");
    });

    it("handles null title", () => {
        const slug = generateSlug(null, "2ot9ib");
        expect(slug).toBe("connection-2ot9ib");
    });

    it("handles undefined title", () => {
        const slug = generateSlug(undefined, "2ot9ib");
        expect(slug).toBe("connection-2ot9ib");
    });

    it("handles empty string title", () => {
        const slug = generateSlug("", "2ot9ib");
        expect(slug).toBe("connection-2ot9ib");
    });

    it("handles emoji-only title with fallback", () => {
        const slug = generateSlug("✨🎉🔥", "xyz789");
        expect(slug).toBe("connection-xyz789");
    });

    it("strips emojis but keeps text", () => {
        const slug = generateSlug("✨ Add dark mode", "xyz789");
        expect(slug).toBe("add-dark-mode-xyz789");
    });

    it("converts to lowercase", () => {
        const slug = generateSlug("FIX Auth BUG", "2ot9ib");
        expect(slug).toBe("fix-auth-bug-2ot9ib");
    });

    it("replaces spaces with hyphens", () => {
        const slug = generateSlug("multiple   spaces   here", "2ot9ib");
        expect(slug).toBe("multiple-spaces-here-2ot9ib");
    });

    it("removes special characters", () => {
        const slug = generateSlug("What's the bug? Fix it!", "2ot9ib");
        expect(slug).toBe("whats-the-bug-fix-it-2ot9ib");
    });

    it("truncates very long titles", () => {
        const longTitle = "a".repeat(100);
        const slug = generateSlug(longTitle, "2ot9ib");
        // 60 char max for title + hyphen + 6+ char ID
        expect(slug.length).toBeLessThanOrEqual(67);
        expect(slug.endsWith("-2ot9ib")).toBe(true);
    });

    it("handles title with only special characters", () => {
        const slug = generateSlug("!@#$%^&*()", "2ot9ib");
        expect(slug).toBe("connection-2ot9ib");
    });
});

describe("extractIdFromSlug", () => {
    it("extracts ID from slug with title", () => {
        const id = extractIdFromSlug("fix-auth-bug-2ot9ib");
        expect(id).toBe("2ot9ib");
    });

    it("extracts ID from slug without title", () => {
        const id = extractIdFromSlug("connection-2ot9ib");
        expect(id).toBe("2ot9ib");
    });

    it("extracts ID from ID-only slug", () => {
        const id = extractIdFromSlug("2ot9ib");
        expect(id).toBe("2ot9ib");
    });

    it("extracts longer Sqids (variable length)", () => {
        // Sqids can generate IDs longer than minLength
        const id = extractIdFromSlug("fix-bug-2ot9ib12ab");
        expect(id).toBe("2ot9ib12ab");
    });

    it("throws on slug that is too short", () => {
        expect(() => extractIdFromSlug("abc")).toThrow("too short");
    });

    it("throws on empty slug", () => {
        expect(() => extractIdFromSlug("")).toThrow("too short");
    });

    it("throws on slug with invalid ID characters", () => {
        expect(() => extractIdFromSlug("title-ABCDEF")).toThrow(
            "lowercase alphanumeric"
        );
    });

    it("throws on slug with uppercase ID", () => {
        expect(() => extractIdFromSlug("title-A1B2C3")).toThrow(
            "lowercase alphanumeric"
        );
    });

    it("throws on slug with special characters in ID", () => {
        expect(() => extractIdFromSlug("title-a1b2c!")).toThrow(
            "lowercase alphanumeric"
        );
    });
});

describe("decodeSqid", () => {
    it("decodes Sqid back to numbers", () => {
        const id = generateConnectionId();
        const decoded = decodeSqid(id);
        expect(Array.isArray(decoded)).toBe(true);
        expect(decoded.length).toBe(1);
    });
});
