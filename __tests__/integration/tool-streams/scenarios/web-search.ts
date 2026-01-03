/**
 * Web Search tool scenarios.
 *
 * WebSearch has external dependencies, so we mock the results.
 */

import type { ToolScenario } from "../helpers/types";
import {
    buildToolCallChunks,
    buildReasoningWithToolChunks,
} from "../helpers/mock-stream";

export const scenarios: ToolScenario[] = [
    {
        name: "web-search-basic",
        description: "Model performs a simple web search",
        toolName: "webSearch",
        chunks: buildToolCallChunks({
            toolName: "webSearch",
            input: { query: "TypeScript 5.4 new features" },
            output: {
                error: false,
                query: "TypeScript 5.4 new features",
                results: [
                    {
                        title: "Announcing TypeScript 5.4",
                        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/",
                        snippet:
                            "TypeScript 5.4 brings new features including NoInfer utility type...",
                    },
                    {
                        title: "TypeScript 5.4 Release Notes",
                        url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html",
                        snippet:
                            "Complete release notes for TypeScript 5.4 with examples...",
                    },
                ],
            },
        }),
        mockToolResult: {
            error: false,
            query: "TypeScript 5.4 new features",
            results: [
                {
                    title: "Announcing TypeScript 5.4",
                    url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/",
                    snippet:
                        "TypeScript 5.4 brings new features including NoInfer utility type...",
                },
                {
                    title: "TypeScript 5.4 Release Notes",
                    url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html",
                    snippet:
                        "Complete release notes for TypeScript 5.4 with examples...",
                },
            ],
        },
        assertions: {
            hasText: ["TypeScript 5.4", "NoInfer"],
            hasTestId: ["tool-webSearch"],
            statusCompleted: true,
        },
    },

    {
        name: "web-search-with-reasoning",
        description: "Model reasons about what to search, then searches",
        toolName: "webSearch",
        chunks: buildReasoningWithToolChunks({
            reasoning:
                "The user is asking about React 19 features. I should search for the latest information since my training data may be outdated.",
            toolName: "webSearch",
            input: { query: "React 19 new features 2024", maxResults: 5 },
            output: {
                error: false,
                query: "React 19 new features 2024",
                results: [
                    {
                        title: "React 19 Beta - React Blog",
                        url: "https://react.dev/blog/2024/04/25/react-19",
                        snippet: "React 19 introduces Actions, use hook, and more...",
                    },
                ],
            },
        }),
        mockToolResult: {
            error: false,
            query: "React 19 new features 2024",
            results: [
                {
                    title: "React 19 Beta - React Blog",
                    url: "https://react.dev/blog/2024/04/25/react-19",
                    snippet: "React 19 introduces Actions, use hook, and more...",
                },
            ],
        },
        assertions: {
            hasText: ["React 19", "Actions"],
            statusCompleted: true,
        },
    },

    {
        name: "web-search-no-results",
        description: "Model searches but gets no results",
        toolName: "webSearch",
        chunks: buildToolCallChunks({
            toolName: "webSearch",
            input: { query: "xyzzy123nonexistent456" },
            output: {
                error: true,
                message: "Search came up empty. The robots are on it. 🤖",
                results: [],
            },
        }),
        mockToolResult: {
            error: true,
            message: "Search came up empty. The robots are on it. 🤖",
            results: [],
        },
        assertions: {
            hasText: ["empty", "robots"],
            statusError: true,
        },
    },
];
