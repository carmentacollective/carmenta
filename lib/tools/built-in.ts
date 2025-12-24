import { tool } from "ai";
import { z } from "zod";

import { getWebIntelligenceProvider } from "@/lib/web-intelligence";
import { searchKnowledge } from "@/lib/kb/search";

/**
 * Built-in tools available to all connections.
 * These tools provide core capabilities like web search, comparison tables, and research.
 */
export const builtInTools = {
    compareOptions: tool({
        description:
            "Compare multiple options in a table format. Use this when the user wants to compare products, services, or alternatives.",
        inputSchema: z.object({
            title: z.string().describe("Title for the comparison"),
            options: z
                .array(
                    z.object({
                        name: z.string().describe("Name of the option"),
                        attributes: z
                            .record(z.string(), z.string())
                            .describe("Key-value pairs of attributes"),
                    })
                )
                .min(2)
                .describe("Options to compare (minimum 2)"),
        }),
        execute: async ({ title, options }) => {
            return { title, options };
        },
    }),

    webSearch: tool({
        description:
            "Search the web for current information. Use when you need fresh data, recent news, or to verify facts. Returns concise results with snippets and URLs.",
        inputSchema: z.object({
            query: z
                .string()
                .describe("The search query. Be specific and include key terms."),
            maxResults: z
                .number()
                .min(1)
                .max(20)
                .optional()
                .describe("Maximum number of results to return (default: 5)."),
        }),
        execute: async ({ query, maxResults }) => {
            const provider = getWebIntelligenceProvider();
            const result = await provider.search(query, { maxResults });

            if (!result) {
                return {
                    error: true,
                    message: "Search came up empty. The robots are on it. 🤖",
                    results: [],
                };
            }

            return {
                error: false,
                results: result.results,
                query: result.query,
            };
        },
    }),

    fetchPage: tool({
        description:
            "Fetch and extract the main content from a web page. Returns clean, readable text without ads or navigation. Use when you have a specific URL to read. If warning is present, the extraction was partial - inform the user and work with other sources.",
        inputSchema: z.object({
            url: z.string().url().describe("The URL to fetch content from."),
            maxLength: z
                .number()
                .optional()
                .describe(
                    "Maximum characters to return. Use for long pages where you only need the beginning."
                ),
        }),
        execute: async ({ url, maxLength }) => {
            const provider = getWebIntelligenceProvider();
            const result = await provider.extract(url, { maxLength });

            if (!result) {
                return {
                    error: true,
                    message:
                        "That page isn't loading. It might be down or blocking access.",
                    title: "",
                    content: "",
                    url,
                };
            }

            // Surface warnings about partial/problematic extractions
            // so the AI can respond appropriately to the user
            if (result.warning) {
                return {
                    error: false,
                    warning: result.warning,
                    title: result.title,
                    content: result.content,
                    url: result.url,
                };
            }

            return {
                error: false,
                title: result.title,
                content: result.content,
                url: result.url,
            };
        },
    }),

    deepResearch: tool({
        description:
            "Conduct comprehensive research on a topic. Searches multiple sources, reads relevant pages, and synthesizes findings. Use for complex questions requiring thorough analysis. Takes 30-60 seconds.",
        inputSchema: z.object({
            objective: z
                .string()
                .describe(
                    "What you want to research. Be specific about the question or topic."
                ),
            depth: z
                .enum(["quick", "standard", "deep"])
                .optional()
                .describe(
                    '"quick" for basic overview, "standard" for solid analysis, "deep" for comprehensive investigation.'
                ),
            focusAreas: z
                .array(z.string())
                .optional()
                .describe("Specific aspects to focus on."),
        }),
        execute: async ({ objective, depth, focusAreas }) => {
            const provider = getWebIntelligenceProvider();
            const result = await provider.research(objective, { depth, focusAreas });

            if (!result) {
                return {
                    error: true,
                    message:
                        "Research didn't find much. The robots are investigating. 🤖",
                    summary: "",
                    findings: [],
                    sources: [],
                };
            }

            return {
                error: false,
                summary: result.summary,
                findings: result.findings,
                sources: result.sources,
            };
        },
    }),
};

/**
 * Create the searchKnowledge tool with user context.
 * This tool allows the AI to explicitly query the knowledge base mid-conversation.
 */
export function createSearchKnowledgeTool(userId: string) {
    return tool({
        description:
            "Search our knowledge base for relevant information about preferences, projects, decisions, or anything we've stored together. Use when context wasn't provided upfront or when the conversation evolves.",
        inputSchema: z.object({
            query: z.string().describe("What to search for in natural language"),
            entities: z
                .array(z.string())
                .optional()
                .describe(
                    "Specific names to match with high precision (people, projects, integrations)"
                ),
        }),
        execute: async ({ query, entities }) => {
            const { results } = await searchKnowledge(userId, query, {
                entities,
                maxResults: 5,
                tokenBudget: 2000,
            });

            if (results.length === 0) {
                return {
                    found: false,
                    message: "Nothing in our knowledge base matches that query.",
                };
            }

            return {
                found: true,
                count: results.length,
                documents: results.map((r) => ({
                    path: r.path,
                    name: r.name,
                    content: r.content,
                    relevance: r.relevance,
                    reason: r.reason,
                })),
            };
        },
    });
}
