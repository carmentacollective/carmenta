import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
    it("merges class names correctly", () => {
        expect(cn("px-2", "py-1")).toBe("px-2 py-1");
    });

    it("handles conditional classes", () => {
        expect(cn("base", true && "active", false && "inactive")).toBe("base active");
    });

    it("resolves Tailwind conflicts correctly", () => {
        // Later classes should win
        expect(cn("p-2", "p-4")).toBe("p-4");
        expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("handles undefined and null values", () => {
        expect(cn("base", undefined, null, "end")).toBe("base end");
    });

    it("handles array inputs", () => {
        expect(cn(["px-2", "py-1"])).toBe("px-2 py-1");
    });
});
