/**
 * Knowledge Librarian Agent
 *
 * The Knowledge Librarian is Carmenta's first AI team member. It watches
 * conversations and intelligently extracts worth-preserving knowledge into
 * the knowledge base, organizing it according to established conventions.
 *
 * This agent uses the Vercel AI SDK 6.0 Experimental_Agent framework.
 */

import { ToolLoopAgent, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { logger } from "@/lib/logger";
import { assertEnv } from "@/lib/env";
import { LIBRARIAN_FALLBACK_CHAIN } from "@/lib/model-config";
import { librarianSystemPrompt } from "./prompt";
import {
    listKnowledgeTool,
    readDocumentTool,
    createDocumentTool,
    updateDocumentTool,
    appendToDocumentTool,
    moveDocumentTool,
    notifyUserTool,
} from "./tools";

/**
 * Maximum agentic steps before stopping
 *
 * The librarian typically needs:
 * - 1 step to list knowledge (understand structure)
 * - 1-3 steps to read relevant documents
 * - 1-2 steps to create/update documents
 *
 * 10 steps provides enough room without runaway behavior
 */
const MAX_STEPS = 10;

/**
 * Create the Knowledge Librarian agent
 */
export function createLibrarianAgent() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    assertEnv(apiKey, "OPENROUTER_API_KEY");

    const openrouter = createOpenRouter({
        apiKey,
    });

    // Use first model with fallback chain for automatic failover
    const primaryModel = LIBRARIAN_FALLBACK_CHAIN[0];

    const agent = new ToolLoopAgent({
        model: openrouter(primaryModel, {
            models: [...LIBRARIAN_FALLBACK_CHAIN],
        }),
        instructions: librarianSystemPrompt,
        tools: {
            listKnowledge: listKnowledgeTool,
            readDocument: readDocumentTool,
            createDocument: createDocumentTool,
            updateDocument: updateDocumentTool,
            appendToDocument: appendToDocumentTool,
            moveDocument: moveDocumentTool,
            notifyUser: notifyUserTool,
        },
        stopWhen: stepCountIs(MAX_STEPS),
    });

    logger.info(
        {
            model: primaryModel,
            fallbacks: LIBRARIAN_FALLBACK_CHAIN,
            maxSteps: MAX_STEPS,
        },
        "📚 Created Knowledge Librarian agent"
    );

    return agent;
}

/**
 * Re-export types for consumers
 */
export type * from "./types";
