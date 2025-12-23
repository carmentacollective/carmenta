import { describe, it, expect } from "vitest";
import {
    encodeConnectionId,
    decodeConnectionId,
    generateSlug,
    isValidConnectionId,
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
    it("generates slug from title only (no ID appended)", () => {
        const slug = generateSlug("Fix authentication bug");
        expect(slug).toBe("fix-authentication-bug");
    });

    it("handles null title", () => {
        const slug = generateSlug(null);
        expect(slug).toBe("connection");
    });

    it("handles undefined title", () => {
        const slug = generateSlug(undefined);
        expect(slug).toBe("connection");
    });

    it("handles empty string title", () => {
        const slug = generateSlug("");
        expect(slug).toBe("connection");
    });

    it("handles emoji-only title with fallback", () => {
        const slug = generateSlug("✨🎉🔥");
        expect(slug).toBe("connection");
    });

    it("strips emojis but keeps text", () => {
        const slug = generateSlug("✨ Add dark mode");
        expect(slug).toBe("add-dark-mode");
    });

    it("converts to lowercase", () => {
        const slug = generateSlug("FIX Auth BUG");
        expect(slug).toBe("fix-auth-bug");
    });

    it("replaces spaces with hyphens", () => {
        const slug = generateSlug("multiple   spaces   here");
        expect(slug).toBe("multiple-spaces-here");
    });

    it("removes special characters", () => {
        const slug = generateSlug("What's the bug? Fix it!");
        expect(slug).toBe("whats-the-bug-fix-it");
    });

    it("truncates very long titles", () => {
        const longTitle = "a".repeat(100);
        const slug = generateSlug(longTitle);
        // 60 char max for title
        expect(slug.length).toBeLessThanOrEqual(60);
    });

    it("handles title with only special characters", () => {
        const slug = generateSlug("!@#$%^&*()");
        expect(slug).toBe("connection");
    });
});

describe("isValidConnectionId", () => {
    it("returns true for valid Sqid format", () => {
        expect(isValidConnectionId("2ot9ib")).toBe(true);
        expect(isValidConnectionId("abc123")).toBe(true);
        expect(isValidConnectionId("a1b2c3d4e5f6")).toBe(true);
    });

    it("returns false for IDs that are too short", () => {
        expect(isValidConnectionId("abc")).toBe(false);
        expect(isValidConnectionId("12345")).toBe(false);
    });

    it("returns false for uppercase characters", () => {
        expect(isValidConnectionId("ABCDEF")).toBe(false);
        expect(isValidConnectionId("Abc123")).toBe(false);
    });

    it("returns false for special characters", () => {
        expect(isValidConnectionId("abc-123")).toBe(false);
        expect(isValidConnectionId("abc_123")).toBe(false);
        expect(isValidConnectionId("abc!123")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isValidConnectionId("")).toBe(false);
    });
});

describe("encode/decode integration", () => {
    it("works with generateSlug and isValidConnectionId", () => {
        // Simulate the full flow: DB ID → Sqid → validate → decode
        const dbId = 123;
        const sqid = encodeConnectionId(dbId);
        const slug = generateSlug("Test Connection");

        // URL would be /connection/{slug}/{sqid}
        expect(isValidConnectionId(sqid)).toBe(true);
        expect(slug).toBe("test-connection");

        const decodedId = decodeConnectionId(sqid);
        expect(decodedId).toBe(dbId);
    });
});
