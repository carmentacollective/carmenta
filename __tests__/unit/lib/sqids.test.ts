import { describe, it, expect } from "vitest";
import {
    generateConnectionId,
    generateSlug,
    extractIdFromSlug,
    decodeSqid,
} from "@/lib/sqids";

describe("generateConnectionId", () => {
    it("generates 8+ character alphanumeric ID", () => {
        const id = generateConnectionId();
        expect(id.length).toBeGreaterThanOrEqual(8);
        expect(id).toMatch(/^[0-9a-z]+$/);
    });

    it("generates unique IDs", () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateConnectionId()));
        expect(ids.size).toBe(100);
    });

    it("generates IDs that can be decoded", () => {
        const id = generateConnectionId();
        const decoded = decodeSqid(id);
        expect(decoded).toHaveLength(2); // We encode two random numbers
        expect(decoded.every((n) => typeof n === "number")).toBe(true);
    });
});

describe("generateSlug", () => {
    it("generates slug from title and ID", () => {
        const slug = generateSlug("Fix authentication bug", "k6wm9zdx");
        expect(slug).toBe("fix-authentication-bug-k6wm9zdx");
    });

    it("handles null title", () => {
        const slug = generateSlug(null, "k6wm9zdx");
        expect(slug).toBe("connection-k6wm9zdx");
    });

    it("handles undefined title", () => {
        const slug = generateSlug(undefined, "k6wm9zdx");
        expect(slug).toBe("connection-k6wm9zdx");
    });

    it("handles empty string title", () => {
        const slug = generateSlug("", "k6wm9zdx");
        expect(slug).toBe("connection-k6wm9zdx");
    });

    it("handles emoji-only title with fallback", () => {
        const slug = generateSlug("✨🎉🔥", "xyz789ab");
        expect(slug).toBe("connection-xyz789ab");
    });

    it("strips emojis but keeps text", () => {
        const slug = generateSlug("✨ Add dark mode", "xyz789ab");
        expect(slug).toBe("add-dark-mode-xyz789ab");
    });

    it("converts to lowercase", () => {
        const slug = generateSlug("FIX Auth BUG", "k6wm9zdx");
        expect(slug).toBe("fix-auth-bug-k6wm9zdx");
    });

    it("replaces spaces with hyphens", () => {
        const slug = generateSlug("multiple   spaces   here", "k6wm9zdx");
        expect(slug).toBe("multiple-spaces-here-k6wm9zdx");
    });

    it("removes special characters", () => {
        const slug = generateSlug("What's the bug? Fix it!", "k6wm9zdx");
        expect(slug).toBe("whats-the-bug-fix-it-k6wm9zdx");
    });

    it("truncates very long titles", () => {
        const longTitle = "a".repeat(100);
        const slug = generateSlug(longTitle, "k6wm9zdx");
        // 60 char max for title + hyphen + 8 char ID = 69 chars
        expect(slug.length).toBeLessThanOrEqual(69);
        expect(slug.endsWith("-k6wm9zdx")).toBe(true);
    });

    it("handles title with only special characters", () => {
        const slug = generateSlug("!@#$%^&*()", "k6wm9zdx");
        expect(slug).toBe("connection-k6wm9zdx");
    });
});

describe("extractIdFromSlug", () => {
    it("extracts ID from slug with title", () => {
        const id = extractIdFromSlug("fix-auth-bug-k6wm9zdx");
        expect(id).toBe("k6wm9zdx");
    });

    it("extracts ID from slug without title", () => {
        const id = extractIdFromSlug("connection-k6wm9zdx");
        expect(id).toBe("k6wm9zdx");
    });

    it("extracts ID from ID-only slug", () => {
        const id = extractIdFromSlug("k6wm9zdx");
        expect(id).toBe("k6wm9zdx");
    });

    it("extracts longer Sqids (variable length)", () => {
        // Sqids can generate IDs longer than minLength
        const id = extractIdFromSlug("fix-bug-k6wm9zdx12ab");
        expect(id).toBe("k6wm9zdx12ab");
    });

    it("throws on slug that is too short", () => {
        expect(() => extractIdFromSlug("abc")).toThrow("too short");
    });

    it("throws on empty slug", () => {
        expect(() => extractIdFromSlug("")).toThrow("too short");
    });

    it("throws on slug with invalid ID characters", () => {
        expect(() => extractIdFromSlug("title-ABCDEFGH")).toThrow(
            "lowercase alphanumeric"
        );
    });

    it("throws on slug with uppercase ID", () => {
        expect(() => extractIdFromSlug("title-A1B2C3D4")).toThrow(
            "lowercase alphanumeric"
        );
    });

    it("throws on slug with special characters in ID", () => {
        expect(() => extractIdFromSlug("title-a1b2c3d!")).toThrow(
            "lowercase alphanumeric"
        );
    });
});

describe("decodeSqid", () => {
    it("decodes Sqid back to numbers", () => {
        const id = generateConnectionId();
        const decoded = decodeSqid(id);
        expect(Array.isArray(decoded)).toBe(true);
        expect(decoded.length).toBe(2);
    });
});
