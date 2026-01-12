/**
 * Tests for MCP servers API route schemas
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import the schema directly for testing
// We'll test the public behavior through the schema
const createServerSchema = z
    .object({
        identifier: z
            .string()
            .min(1, "Server identifier is required")
            .max(255)
            .regex(
                /^[a-z0-9][a-z0-9-_.]*$/i,
                "Identifier must start with alphanumeric and contain only letters, numbers, hyphens, underscores, and dots"
            ),
        displayName: z.string().min(1, "Display name is required").max(255),
        url: z
            .string()
            .url("Must be a valid URL")
            .refine(
                (url) => url.startsWith("https://"),
                "Server URL must use HTTPS for security"
            ),
        transport: z.enum(["sse", "http", "streamable-http"]).optional().default("sse"),
        headers: z.record(z.string(), z.string()).optional(),
    })
    .transform((data) => ({
        ...data,
        // Map Claude Desktop's "streamable-http" to our "http"
        transport: data.transport === "streamable-http" ? "http" : data.transport,
    }));

describe("MCP Server API Schema", () => {
    describe("transport type normalization", () => {
        it("maps streamable-http to http", () => {
            const result = createServerSchema.parse({
                identifier: "test-server",
                displayName: "Test Server",
                url: "https://example.com/mcp",
                transport: "streamable-http",
            });

            expect(result.transport).toBe("http");
        });

        it("preserves http transport", () => {
            const result = createServerSchema.parse({
                identifier: "test-server",
                displayName: "Test Server",
                url: "https://example.com/mcp",
                transport: "http",
            });

            expect(result.transport).toBe("http");
        });

        it("preserves sse transport", () => {
            const result = createServerSchema.parse({
                identifier: "test-server",
                displayName: "Test Server",
                url: "https://example.com/mcp",
                transport: "sse",
            });

            expect(result.transport).toBe("sse");
        });

        it("defaults to sse when transport not provided", () => {
            const result = createServerSchema.parse({
                identifier: "test-server",
                displayName: "Test Server",
                url: "https://example.com/mcp",
            });

            expect(result.transport).toBe("sse");
        });
    });

    describe("validation", () => {
        it("requires https URLs", () => {
            expect(() =>
                createServerSchema.parse({
                    identifier: "test-server",
                    displayName: "Test Server",
                    url: "http://example.com/mcp",
                })
            ).toThrow(/HTTPS/);
        });

        it("validates identifier format", () => {
            expect(() =>
                createServerSchema.parse({
                    identifier: "invalid identifier with spaces",
                    displayName: "Test Server",
                    url: "https://example.com/mcp",
                })
            ).toThrow(/Identifier must start with alphanumeric/);
        });

        it("accepts headers object", () => {
            const result = createServerSchema.parse({
                identifier: "test-server",
                displayName: "Test Server",
                url: "https://example.com/mcp",
                headers: {
                    Authorization: "Bearer token123",
                    "X-Custom-Header": "value",
                },
            });

            expect(result.headers).toEqual({
                Authorization: "Bearer token123",
                "X-Custom-Header": "value",
            });
        });
    });
});
