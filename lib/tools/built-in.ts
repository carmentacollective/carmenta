import { generateImage, tool } from "ai";
import { all, create } from "mathjs";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { env } from "@/lib/env";
import { getGatewayClient } from "@/lib/ai/gateway";
import { httpClient } from "@/lib/http-client";
import { logger } from "@/lib/logger";
import { getWebIntelligenceProvider } from "@/lib/web-intelligence";
import { searchKnowledge } from "@/lib/kb/search";

const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs";

// Create mathjs instance for safe user input evaluation
// Security: expressions are evaluated with an empty scope to prevent
// function definitions and variable assignments
const math = create(all);

// Add common aliases for mathematical functions
// These allow more natural notation that models often use
// Note: Some names like C and P may conflict with math.js constants, so we use override
math.import(
    {
        // Combination notation: C(n,k) or nCr(n,k) → combinations(n,k)
        C: math.combinations,
        nCr: math.combinations,
        // Permutation notation: P(n,k) or nPr(n,k) → permutations(n,k)
        P: math.permutations,
        nPr: math.permutations,
        // Natural log: ln(x) → log(x) (math.js uses log for natural log)
        ln: math.log,
        // Base-10 log alias
        lg: math.log10,
    },
    { override: true }
);

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

    calculate: tool({
        description:
            "Evaluate mathematical expressions. Use this to verify calculations, compute formulas, or solve math problems. Supports arithmetic, algebra, trigonometry, statistics, unit conversions, combinations/permutations, and financial calculations.",
        inputSchema: z.object({
            expression: z
                .string()
                .describe(
                    "Mathematical expression to evaluate. Examples: '2 + 2', 'sqrt(16)', 'sin(45 deg)', '5!', 'C(10,5)', 'ln(e)', '10 km to miles'"
                ),
        }),
        execute: async ({ expression }) => {
            try {
                // Evaluate with empty scope to prevent function definitions and assignments
                // This allows standard math operations while blocking security risks
                const result = math.evaluate(expression, {});
                // Format the result nicely
                const formatted =
                    typeof result === "number"
                        ? math.format(result, { precision: 14 })
                        : String(result);

                return {
                    expression,
                    result: formatted,
                    numeric: typeof result === "number" ? result : null,
                };
            } catch (error) {
                logger.warn(
                    { error, expression },
                    "Failed to evaluate mathematical expression"
                );
                return {
                    expression,
                    error: true,
                    message:
                        error instanceof Error
                            ? error.message
                            : "Could not evaluate expression",
                };
            }
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
                // Capture at tool level as backup - the provider should also capture
                Sentry.captureMessage("Deep research returned no results", {
                    level: "warning",
                    tags: { component: "tools", tool: "deepResearch" },
                    extra: { objective, depth, focusAreas },
                });
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

    giphy: tool({
        description:
            "Search for GIFs and stickers. Use for reactions, celebrations, or when visual expression adds to communication. Actions: search (find GIFs by query), get_random (random GIF, optionally by tag), get_trending (popular GIFs).",
        inputSchema: z.object({
            action: z
                .enum(["search", "get_random", "get_trending"])
                .describe("The action to perform"),
            query: z
                .string()
                .optional()
                .describe("Search term for finding GIFs (required for search action)"),
            tag: z
                .string()
                .optional()
                .describe("Tag to filter random GIFs (optional for get_random action)"),
            limit: z
                .number()
                .min(1)
                .max(50)
                .optional()
                .describe("Maximum number of GIFs to return (default: 10, max: 50)"),
        }),
        execute: async ({ action, query, tag, limit = 10 }) => {
            const apiKey = env.GIPHY_API_KEY;
            if (!apiKey) {
                logger.error(
                    { tool: "giphy" },
                    "GIPHY_API_KEY environment variable not configured"
                );
                return {
                    error: true,
                    message: "Giphy is not configured. Missing API key.",
                };
            }

            const DEFAULT_RATING = "pg";

            try {
                switch (action) {
                    case "search": {
                        if (!query) {
                            return {
                                error: true,
                                message: "Search action requires a query parameter.",
                            };
                        }

                        logger.info({ query, limit }, "Searching Giphy");

                        const response = await httpClient
                            .get(`${GIPHY_API_BASE}/search`, {
                                searchParams: {
                                    api_key: apiKey,
                                    q: query,
                                    limit: Math.min(limit, 50).toString(),
                                    rating: DEFAULT_RATING,
                                    lang: "en",
                                },
                            })
                            .json<GiphySearchResponse>();

                        if (response.data.length === 0) {
                            return {
                                query,
                                totalCount: 0,
                                results: [],
                                message: "No GIFs found matching your query.",
                            };
                        }

                        return {
                            query,
                            totalCount: response.pagination.total_count,
                            count: response.pagination.count,
                            results: response.data.map(formatGif),
                        };
                    }

                    case "get_random": {
                        logger.info({ tag }, "Getting random Giphy GIF");

                        const searchParams: Record<string, string> = {
                            api_key: apiKey,
                            rating: DEFAULT_RATING,
                        };
                        if (tag) searchParams.tag = tag;

                        const response = await httpClient
                            .get(`${GIPHY_API_BASE}/random`, { searchParams })
                            .json<GiphyRandomResponse>();

                        return {
                            result: formatGif(response.data),
                        };
                    }

                    case "get_trending": {
                        logger.info({ limit }, "Getting trending Giphy GIFs");

                        const response = await httpClient
                            .get(`${GIPHY_API_BASE}/trending`, {
                                searchParams: {
                                    api_key: apiKey,
                                    limit: Math.min(limit, 50).toString(),
                                    rating: DEFAULT_RATING,
                                },
                            })
                            .json<GiphySearchResponse>();

                        return {
                            totalCount: response.pagination.total_count,
                            count: response.pagination.count,
                            results: response.data.map(formatGif),
                        };
                    }
                }
            } catch (error) {
                logger.error({ error, action }, "Giphy API request failed");
                Sentry.captureException(error, {
                    tags: { component: "tool", tool: "giphy", action },
                });
                return {
                    error: true,
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to fetch GIFs from Giphy",
                };
            }
        },
    }),

    imgflip: tool({
        description:
            "Create custom memes by adding text to popular meme templates. Use for witty responses, humor, or when a meme would perfectly capture the moment. Actions: list_templates (get available meme templates), create_meme (generate a meme with custom text).",
        inputSchema: z.object({
            action: z
                .enum(["list_templates", "create_meme"])
                .describe("The action to perform"),
            templateId: z
                .string()
                .optional()
                .describe(
                    "Meme template ID (required for create_meme). Use list_templates to find IDs."
                ),
            topText: z
                .string()
                .optional()
                .describe("Text for the top of the meme (for create_meme)"),
            bottomText: z
                .string()
                .optional()
                .describe("Text for the bottom of the meme (for create_meme)"),
        }),
        execute: async ({ action, templateId, topText, bottomText }) => {
            const IMGFLIP_API_BASE = "https://api.imgflip.com";

            try {
                switch (action) {
                    case "list_templates": {
                        logger.info({ tool: "imgflip" }, "Fetching meme templates");

                        const response = await httpClient
                            .get(`${IMGFLIP_API_BASE}/get_memes`)
                            .json<ImgflipGetMemesResponse>();

                        if (!response.success) {
                            return {
                                error: true,
                                message: "Failed to fetch meme templates",
                            };
                        }

                        // Return top 50 most popular templates
                        return {
                            count: Math.min(response.data.memes.length, 50),
                            templates: response.data.memes.slice(0, 50).map((m) => ({
                                id: m.id,
                                name: m.name,
                                url: m.url,
                                boxCount: m.box_count,
                            })),
                        };
                    }

                    case "create_meme": {
                        const username = env.IMGFLIP_USERNAME;
                        const password = env.IMGFLIP_PASSWORD;

                        if (!username || !password) {
                            logger.error(
                                { tool: "imgflip" },
                                "IMGFLIP_USERNAME or IMGFLIP_PASSWORD not configured"
                            );
                            return {
                                error: true,
                                message:
                                    "Imgflip meme creation is not configured. Missing credentials.",
                            };
                        }

                        if (!templateId) {
                            return {
                                error: true,
                                message:
                                    "templateId is required for create_meme. Use list_templates to find template IDs.",
                            };
                        }

                        logger.info(
                            { templateId, topText, bottomText },
                            "Creating Imgflip meme"
                        );

                        const formData = new URLSearchParams();
                        formData.append("template_id", templateId);
                        formData.append("username", username);
                        formData.append("password", password);
                        if (topText) formData.append("text0", topText);
                        if (bottomText) formData.append("text1", bottomText);

                        const response = await httpClient
                            .post(`${IMGFLIP_API_BASE}/caption_image`, {
                                body: formData.toString(),
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded",
                                },
                            })
                            .json<ImgflipCaptionResponse>();

                        if (!response.success) {
                            return {
                                error: true,
                                message:
                                    response.error_message || "Failed to create meme",
                            };
                        }

                        return {
                            url: response.data.url,
                            pageUrl: response.data.page_url,
                            attribution: "Powered by Imgflip",
                        };
                    }
                }
            } catch (error) {
                logger.error({ error, action }, "Imgflip API request failed");
                Sentry.captureException(error, {
                    tags: { component: "tool", tool: "imgflip", action },
                });
                return {
                    error: true,
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to communicate with Imgflip",
                };
            }
        },
    }),

    createImage: tool({
        description:
            "Generate an AI image from a text description. Use this when the user wants to create custom images, logos, illustrations, or visualize ideas. Takes 5-30 seconds to generate.",
        inputSchema: z.object({
            prompt: z
                .string()
                .min(1, "Prompt cannot be empty")
                .max(4000, "Prompt is too long")
                .transform((s) => s.trim())
                .refine((s) => s.length > 0, "Prompt cannot be just whitespace")
                .describe(
                    "Detailed description of the image to generate. Be specific about style, colors, composition, and mood."
                ),
            aspectRatio: z
                .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
                .optional()
                .describe(
                    "Aspect ratio for the generated image. Default is 1:1 (square). Use 16:9 for landscape, 9:16 for portrait."
                ),
        }),
        execute: async ({ prompt, aspectRatio = "1:1" }) => {
            const MODEL_ID = "google/imagen-4.0-generate";
            logger.info({ prompt, aspectRatio, model: MODEL_ID }, "Generating image");

            try {
                const gateway = getGatewayClient();
                const startTime = Date.now();

                const { image } = await generateImage({
                    model: gateway.imageModel(MODEL_ID),
                    prompt,
                    aspectRatio,
                });

                // Validate response has actual image data
                if (!image?.base64 || image.base64.length < 100) {
                    throw new Error("Generated image data is empty or invalid");
                }

                const durationMs = Date.now() - startTime;
                const imageSizeKb = Math.round((image.base64.length * 0.75) / 1024);
                logger.info(
                    { durationMs, aspectRatio, model: MODEL_ID, imageSizeKb },
                    "Image generated successfully"
                );

                return {
                    success: true,
                    image: {
                        base64: image.base64,
                        mimeType: "image/png",
                    },
                    prompt,
                    aspectRatio,
                    durationMs,
                };
            } catch (error) {
                logger.error(
                    { error, prompt, model: MODEL_ID },
                    "Image generation failed"
                );
                Sentry.captureException(error, {
                    tags: { component: "tool", tool: "createImage", model: MODEL_ID },
                    extra: { prompt, aspectRatio },
                });

                // Sanitize error messages to avoid leaking internal details
                const message = getUserFriendlyImageError(error);

                return {
                    error: true,
                    message,
                    prompt,
                };
            }
        },
    }),
};

/**
 * Convert internal errors to user-friendly messages for image generation.
 * Avoids leaking API details, URLs, or internal error codes.
 */
function getUserFriendlyImageError(error: unknown): string {
    if (!(error instanceof Error)) {
        return "We couldn't create that image right now";
    }

    const msg = error.message.toLowerCase();

    // Content policy violations
    if (
        msg.includes("content policy") ||
        msg.includes("safety") ||
        msg.includes("blocked")
    ) {
        return "This prompt doesn't meet content guidelines. Try describing it differently.";
    }

    // Rate limiting
    if (msg.includes("rate limit") || msg.includes("429") || msg.includes("quota")) {
        return "We're generating a lot of images right now. Try again in a moment.";
    }

    // Timeouts
    if (
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("deadline")
    ) {
        return "Image generation took too long. Try a simpler prompt.";
    }

    // Invalid/empty response
    if (msg.includes("empty") || msg.includes("invalid")) {
        return "Something went wrong with the image. Let's try again.";
    }

    // Generic fallback - don't leak internal details
    return "We couldn't create that image right now";
}

// Giphy API types
interface GiphyGif {
    id: string;
    title: string;
    url: string;
    rating: string;
    images: {
        original: { url: string; width: string; height: string };
        fixed_height: { url: string; width: string; height: string };
        fixed_width: { url: string; width: string; height: string };
    };
}

interface GiphySearchResponse {
    data: GiphyGif[];
    pagination: { total_count: number; count: number; offset: number };
    meta: { status: number; msg: string };
}

interface GiphyRandomResponse {
    data: GiphyGif;
    meta: { status: number; msg: string };
}

// Imgflip API types
interface ImgflipMeme {
    id: string;
    name: string;
    url: string;
    width: number;
    height: number;
    box_count: number;
}

interface ImgflipGetMemesResponse {
    success: boolean;
    data: { memes: ImgflipMeme[] };
}

interface ImgflipCaptionResponse {
    success: boolean;
    data: { url: string; page_url: string };
    error_message?: string;
}

function formatGif(gif: GiphyGif) {
    return {
        id: gif.id,
        title: gif.title,
        url: gif.url,
        rating: gif.rating,
        images: {
            original: {
                url: gif.images.original.url,
                width: gif.images.original.width,
                height: gif.images.original.height,
            },
            fixed_height: {
                url: gif.images.fixed_height.url,
                width: gif.images.fixed_height.width,
                height: gif.images.fixed_height.height,
            },
            fixed_width: {
                url: gif.images.fixed_width.url,
                width: gif.images.fixed_width.width,
                height: gif.images.fixed_width.height,
            },
        },
        attribution: "Powered by GIPHY",
    };
}

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
