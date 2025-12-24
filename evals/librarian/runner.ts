/**
 * Configurable Librarian Runner for Evals
 *
 * Runs the Knowledge Librarian agent with a configurable model, allowing
 * comparison of different model candidates for the Librarian role.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";

import { librarianSystemPrompt } from "@/lib/ai-team/librarian/prompt";
import type { LibrarianTestInput, KBDocument } from "./cases";
import type { LibrarianOutput, LibrarianToolCall } from "./scorer";

export interface LibrarianRunnerOptions {
    /** The model to use for the Librarian (OpenRouter format) */
    librarianModel: string;
    /** OpenRouter API key */
    apiKey: string;
}

/**
 * Build the user prompt from test input
 */
function buildUserPrompt(input: LibrarianTestInput): string {
    const conversationBlock = input.conversation
        .map((msg) => `<${msg.role}>${msg.content}</${msg.role}>`)
        .join("\n");

    const kbBlock =
        input.existingKB.length > 0
            ? input.existingKB
                  .map(
                      (doc) =>
                          `- ${doc.path}: ${doc.name}${doc.description ? ` (${doc.description})` : ""}\n  Content: ${doc.content.slice(0, 200)}${doc.content.length > 200 ? "..." : ""}`
                  )
                  .join("\n")
            : "(empty)";

    return `<conversation>
${conversationBlock}
</conversation>

<current-kb>
${kbBlock}
</current-kb>

Analyze this conversation and decide what knowledge, if any, should be extracted and stored. Use the available tools to:
1. First, list the current knowledge base to understand existing content
2. Then, create, update, or append to documents as appropriate
3. Notify the user if you made significant changes

If nothing in the conversation is worth saving (greetings, transient info, already-known facts), simply explain that no action is needed.`;
}

/**
 * Create mock tools that capture calls without executing
 */
function createMockTools(existingKB: KBDocument[]) {
    const toolCalls: LibrarianToolCall[] = [];

    const listKnowledge = tool({
        description: "List all knowledge base documents for the user",
        inputSchema: z.object({
            userId: z.string().describe("User ID"),
        }),
        execute: async ({ userId }) => {
            toolCalls.push({
                tool: "listKnowledge",
                args: { userId },
                result: existingKB,
            });
            return {
                documents: existingKB.map((doc) => ({
                    path: doc.path,
                    name: doc.name,
                    description: doc.description,
                    content: doc.content,
                })),
            };
        },
    });

    const readDocument = tool({
        description: "Read a specific document",
        inputSchema: z.object({
            userId: z.string(),
            path: z.string(),
        }),
        execute: async ({ userId, path }) => {
            const doc = existingKB.find((d) => d.path === path);
            toolCalls.push({
                tool: "readDocument",
                args: { userId, path },
                result: doc ?? null,
            });
            return doc ? { found: true, document: doc } : { found: false };
        },
    });

    const createDocument = tool({
        description: "Create a new document",
        inputSchema: z.object({
            userId: z.string(),
            path: z.string(),
            name: z.string(),
            content: z.string(),
            description: z.string().optional(),
        }),
        execute: async (args) => {
            toolCalls.push({
                tool: "createDocument",
                args,
                result: { success: true, path: args.path },
            });
            return {
                success: true,
                path: args.path,
                message: `Created document at ${args.path}`,
            };
        },
    });

    const updateDocument = tool({
        description: "Update an existing document",
        inputSchema: z.object({
            userId: z.string(),
            path: z.string(),
            content: z.string(),
        }),
        execute: async (args) => {
            toolCalls.push({
                tool: "updateDocument",
                args,
                result: { success: true },
            });
            return { success: true, message: `Updated document at ${args.path}` };
        },
    });

    const appendToDocument = tool({
        description: "Append content to an existing document",
        inputSchema: z.object({
            userId: z.string(),
            path: z.string(),
            content: z.string(),
        }),
        execute: async (args) => {
            toolCalls.push({
                tool: "appendToDocument",
                args,
                result: { success: true },
            });
            return { success: true, message: `Appended to ${args.path}` };
        },
    });

    const notifyUser = tool({
        description: "Notify the user about a change",
        inputSchema: z.object({
            userId: z.string(),
            message: z.string(),
            documentPath: z.string().optional(),
        }),
        execute: async (args) => {
            toolCalls.push({
                tool: "notifyUser",
                args,
                result: { success: true },
            });
            return { success: true, message: "Notification queued" };
        },
    });

    return {
        tools: {
            listKnowledge,
            readDocument,
            createDocument,
            updateDocument,
            appendToDocument,
            notifyUser,
        },
        getToolCalls: () => toolCalls,
    };
}

/**
 * Runs the Librarian with a configurable model.
 * Returns the tool calls made plus metadata for evaluation.
 */
export async function runLibrarianEval(
    input: LibrarianTestInput,
    options: LibrarianRunnerOptions
): Promise<LibrarianOutput> {
    const startTime = performance.now();

    try {
        const openrouter = createOpenRouter({
            apiKey: options.apiKey,
        });

        const { tools, getToolCalls } = createMockTools(input.existingKB);
        const userPrompt = buildUserPrompt(input);

        // Create and run agent
        const agent = new ToolLoopAgent({
            model: openrouter(options.librarianModel),
            instructions: librarianSystemPrompt,
            tools,
            stopWhen: stepCountIs(5), // Limit steps for eval
        });

        const result = await agent.generate({ prompt: userPrompt });

        const latencyMs = Math.round(performance.now() - startTime);
        const toolCalls = getToolCalls();

        return {
            toolCalls,
            reasoning: result.text,
            isValid: true,
            latencyMs,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            toolCalls: [],
            isValid: false,
            error: errorMessage,
            latencyMs,
        };
    }
}

/**
 * Model candidates for Librarian evaluation.
 * Run evals to compare: pnpm braintrust eval evals/librarian/eval.ts
 */
export const LIBRARIAN_MODEL_CANDIDATES = [
    {
        id: "anthropic/claude-haiku-4",
        name: "Claude Haiku 4",
        description: "Fast and cheap - good for high-volume if quality holds",
        costPer1M: { input: 0.8, output: 4.0 },
    },
    {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        description: "Balanced - strong reasoning, reliable tool use",
        costPer1M: { input: 3.0, output: 15.0 },
    },
    {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        description: "OpenAI's flagship - good at structured extraction",
        costPer1M: { input: 2.5, output: 10.0 },
    },
    {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "OpenAI's efficient model - cheaper alternative",
        costPer1M: { input: 0.15, output: 0.6 },
    },
] as const;

export type LibrarianModelCandidate = (typeof LIBRARIAN_MODEL_CANDIDATES)[number];
