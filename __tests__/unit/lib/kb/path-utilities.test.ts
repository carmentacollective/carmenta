import { describe, it, expect } from "vitest";
import { toPath, toDisplayPath, getParentPath, getNameFromPath } from "@/lib/kb/index";

describe("KB Path Utilities", () => {
    describe("toPath", () => {
        it("converts filesystem path with leading slash to dot notation", () => {
            expect(toPath("/profile/identity.txt")).toBe("profile.identity");
        });

        it("converts filesystem path without leading slash", () => {
            expect(toPath("profile/identity.txt")).toBe("profile.identity");
        });

        it("converts path without .txt extension", () => {
            expect(toPath("profile/identity")).toBe("profile.identity");
        });

        it("handles already-normalized dot notation path", () => {
            expect(toPath("profile.identity")).toBe("profile.identity");
        });

        it("handles deeply nested paths", () => {
            expect(toPath("/profile/people/colleagues/sarah.txt")).toBe(
                "profile.people.colleagues.sarah"
            );
        });

        it("handles root-level paths", () => {
            expect(toPath("/profile.txt")).toBe("profile");
            expect(toPath("profile")).toBe("profile");
        });

        it("handles paths with multiple slashes", () => {
            expect(toPath("profile/people/sarah")).toBe("profile.people.sarah");
        });

        it("removes .txt extension only at the end", () => {
            // Edge case: .txt in middle of path (shouldn't happen but let's be safe)
            expect(toPath("profile/txt-files/notes")).toBe("profile.txt-files.notes");
        });
    });

    describe("toDisplayPath", () => {
        it("converts dot notation to filesystem display path", () => {
            expect(toDisplayPath("profile.identity")).toBe("/profile/identity.txt");
        });

        it("handles single-level paths", () => {
            expect(toDisplayPath("profile")).toBe("/profile.txt");
        });

        it("handles deeply nested paths", () => {
            expect(toDisplayPath("profile.people.colleagues.sarah")).toBe(
                "/profile/people/colleagues/sarah.txt"
            );
        });

        it("always adds leading slash and .txt suffix", () => {
            const result = toDisplayPath("notes");
            expect(result.startsWith("/")).toBe(true);
            expect(result.endsWith(".txt")).toBe(true);
        });
    });

    describe("getParentPath", () => {
        it("returns parent path for nested path", () => {
            expect(getParentPath("profile.people.sarah")).toBe("profile.people");
        });

        it("returns parent for two-level path", () => {
            expect(getParentPath("profile.identity")).toBe("profile");
        });

        it("returns null for root-level path", () => {
            expect(getParentPath("profile")).toBeNull();
        });

        it("handles deeply nested paths", () => {
            expect(getParentPath("a.b.c.d.e")).toBe("a.b.c.d");
        });
    });

    describe("getNameFromPath", () => {
        it("extracts name from nested path", () => {
            expect(getNameFromPath("profile.people.sarah")).toBe("sarah");
        });

        it("extracts name from two-level path", () => {
            expect(getNameFromPath("profile.identity")).toBe("identity");
        });

        it("returns full path for root-level path", () => {
            expect(getNameFromPath("profile")).toBe("profile");
        });

        it("handles deeply nested paths", () => {
            expect(getNameFromPath("a.b.c.d.e")).toBe("e");
        });
    });

    describe("path utility round-trip", () => {
        it("toPath and toDisplayPath are inverses for standard paths", () => {
            const original = "/profile/identity.txt";
            const normalized = toPath(original);
            const displayed = toDisplayPath(normalized);
            expect(displayed).toBe(original);
        });

        it("handles round-trip for nested paths", () => {
            const original = "/profile/people/sarah.txt";
            const normalized = toPath(original);
            const displayed = toDisplayPath(normalized);
            expect(displayed).toBe(original);
        });
    });
});
