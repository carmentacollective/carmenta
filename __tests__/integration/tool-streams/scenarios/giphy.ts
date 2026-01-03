/**
 * Giphy tool scenarios.
 *
 * Giphy requires API key, so we always mock results.
 */

import type { ToolScenario } from "../helpers/types";
import { buildToolCallChunks } from "../helpers/mock-stream";

const mockGifResult = {
    id: "abc123",
    title: "Celebration Dance",
    url: "https://giphy.com/gifs/abc123",
    rating: "pg",
    images: {
        original: {
            url: "https://media.giphy.com/media/abc123/giphy.gif",
            width: "480",
            height: "270",
        },
        fixed_height: {
            url: "https://media.giphy.com/media/abc123/200.gif",
            width: "356",
            height: "200",
        },
        fixed_width: {
            url: "https://media.giphy.com/media/abc123/200w.gif",
            width: "200",
            height: "113",
        },
    },
    attribution: "Powered by GIPHY",
};

export const scenarios: ToolScenario[] = [
    {
        name: "giphy-search",
        description: "Model searches for a celebratory GIF",
        toolName: "giphy",
        chunks: buildToolCallChunks({
            toolName: "giphy",
            input: { action: "search", query: "celebration", limit: 3 },
            output: {
                query: "celebration",
                totalCount: 1000,
                count: 3,
                results: [mockGifResult],
            },
        }),
        mockToolResult: {
            query: "celebration",
            totalCount: 1000,
            count: 3,
            results: [mockGifResult],
        },
        assertions: {
            hasText: ["Celebration", "GIPHY"],
            hasTestId: ["tool-giphy"],
            statusCompleted: true,
        },
    },

    {
        name: "giphy-random",
        description: "Model gets a random GIF with tag",
        toolName: "giphy",
        chunks: buildToolCallChunks({
            toolName: "giphy",
            input: { action: "get_random", tag: "happy" },
            output: {
                result: mockGifResult,
            },
        }),
        mockToolResult: {
            result: mockGifResult,
        },
        assertions: {
            hasText: ["Celebration"],
            statusCompleted: true,
        },
    },

    {
        name: "giphy-trending",
        description: "Model fetches trending GIFs",
        toolName: "giphy",
        chunks: buildToolCallChunks({
            toolName: "giphy",
            input: { action: "get_trending", limit: 5 },
            output: {
                totalCount: 50,
                count: 5,
                results: [mockGifResult],
            },
        }),
        mockToolResult: {
            totalCount: 50,
            count: 5,
            results: [mockGifResult],
        },
        assertions: {
            hasText: ["Celebration"],
            statusCompleted: true,
        },
    },

    {
        name: "giphy-no-api-key",
        description: "Giphy fails when API key is not configured",
        toolName: "giphy",
        chunks: buildToolCallChunks({
            toolName: "giphy",
            input: { action: "search", query: "test" },
            output: {
                error: true,
                message: "Giphy is not configured. Missing API key.",
            },
        }),
        mockToolResult: {
            error: true,
            message: "Giphy is not configured. Missing API key.",
        },
        assertions: {
            hasText: ["not configured", "API key"],
            statusError: true,
        },
    },

    {
        name: "giphy-search-no-query",
        description: "Giphy search fails without query parameter",
        toolName: "giphy",
        chunks: buildToolCallChunks({
            toolName: "giphy",
            input: { action: "search" },
            output: {
                error: true,
                message: "Search action requires a query parameter.",
            },
        }),
        mockToolResult: {
            error: true,
            message: "Search action requires a query parameter.",
        },
        assertions: {
            hasText: ["query parameter"],
            statusError: true,
        },
    },
];
