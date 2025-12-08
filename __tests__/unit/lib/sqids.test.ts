import { describe, it, expect } from "vitest";
import {
    encodeConnectionId,
    decodeConnectionId,
    generateSlug,
    extractIdFromSlug,
} from "@/lib/sqids";

describe("encodeConnectionId", () => {
    it("encodes sequential ID to 6+ character alphanumeric string", () => {
        const encoded = encodeConnectionId(1);
        expect(encoded.length).toBeGreaterThanOrEqual(6);
        expect(encoded).toMatch(/^[0-9a-z]+$/);
    });

    it("encodes different IDs to different strings", () => {
        const id1 = encodeConnectionId(1);
        const id2 = encodeConnectionId(2);
        const id3 = encodeConnectionId(100);
        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
        expect(id1).not.toBe(id3);
    });

    it("produces consistent encoding for the same ID", () => {
        const encoded1 = encodeConnectionId(42);
        const encoded2 = encodeConnectionId(42);
        expect(encoded1).toBe(encoded2);
    });

    it("grows length for larger numbers", () => {
        const small = encodeConnectionId(1);
        const large = encodeConnectionId(1000000000);
        // Large numbers need more characters
        expect(large.length).toBeGreaterThanOrEqual(small.length);
    });
});

describe("decodeConnectionId", () => {
    it("decodes Sqid back to original sequential ID", () => {
        const original = 42;
        const encoded = encodeConnectionId(original);
        const decoded = decodeConnectionId(encoded);
        expect(decoded).toBe(original);
    });

    it("round-trips various IDs correctly", () => {
        const testIds = [1, 2, 100, 1000, 10000, 1000000];
        for (const id of testIds) {
            const encoded = encodeConnectionId(id);
            const decoded = decodeConnectionId(encoded);
            expect(decoded).toBe(id);
        }
    });

    it("returns null on invalid Sqid format", () => {
        expect(decodeConnectionId("")).toBeNull();
        expect(decodeConnectionId("invalid!")).toBeNull();
        expect(decodeConnectionId("UPPERCASE")).toBeNull();
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

describe("encode/decode integration", () => {
    it("works with generateSlug and extractIdFromSlug", () => {
        // Simulate the full flow: DB ID → Sqid → Slug → Extract → Decode
        const dbId = 123;
        const sqid = encodeConnectionId(dbId);
        const slug = generateSlug("Test Connection", sqid);
        const extractedSqid = extractIdFromSlug(slug);
        const decodedId = decodeConnectionId(extractedSqid);

        expect(decodedId).toBe(dbId);
    });
});
