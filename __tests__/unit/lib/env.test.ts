import { describe, it, expect } from "vitest";
import { assertEnv } from "@/lib/env";

describe("assertEnv", () => {
    it("passes when value is defined", () => {
        expect(() => assertEnv("value", "TEST_VAR")).not.toThrow();
    });

    it("throws when value is undefined", () => {
        expect(() => assertEnv(undefined, "MISSING_VAR")).toThrow(
            "Missing required environment variable: MISSING_VAR"
        );
    });

    it("throws when value is null", () => {
        expect(() => assertEnv(null, "NULL_VAR")).toThrow(
            "Missing required environment variable: NULL_VAR"
        );
    });

    it("throws when value is empty string", () => {
        expect(() => assertEnv("", "EMPTY_VAR")).toThrow(
            "Missing required environment variable: EMPTY_VAR"
        );
    });
});
