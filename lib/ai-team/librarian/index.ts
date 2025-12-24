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
 * The Knowledge Librarian model
 *
 * Configurable via LIBRARIAN_MODEL env var. Default chosen based on
 * eval performance (run: pnpm braintrust eval evals/librarian/eval.ts)
 */
const LIBRARIAN_MODEL = process.env.LIBRARIAN_MODEL ?? "anthropic/claude-sonnet-4";

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

    const agent = new ToolLoopAgent({
        model: openrouter(LIBRARIAN_MODEL),
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
        { model: LIBRARIAN_MODEL, maxSteps: MAX_STEPS },
        "📚 Created Knowledge Librarian agent"
    );

    return agent;
}

/**
 * Re-export types for consumers
 */
export type * from "./types";
