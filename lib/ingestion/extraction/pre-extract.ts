/**
 * Quick entity/keyword extraction for KB search
 * Uses smallest/fastest model (Haiku) to identify what to search for
 */

import { generateText, Output, type LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { preExtractionSchema } from "./schemas";
import type { PreExtractionResult } from "../types";

// Lazy initialization to avoid assertEnv at module load time (breaks tests)
let _haiku: LanguageModel | null = null;

function getHaiku(): LanguageModel {
    if (!_haiku) {
        assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");
        const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
        _haiku = openrouter("anthropic/claude-haiku-4.5");
    }
    return _haiku;
}

/**
 * Extract entities and topics from raw content
 * This is a quick pass to identify search targets before main ingestion
 */
export async function preExtract(content: string): Promise<PreExtractionResult> {
    // Validate input type
    if (typeof content !== "string") {
        logger.error(
            { contentType: typeof content },
            "Invalid content type for pre-extraction"
        );
        return { people: [], projects: [], topics: [] };
    }

    try {
        const { output } = await generateText({
            model: getHaiku(),
            output: Output.object({ schema: preExtractionSchema }),
            prompt: `List entities and topics mentioned in this content for knowledge base search:

${content.slice(0, 2000)}

Extract:
- People: Proper names of individuals (not roles like "the user" or "someone")
- Projects: Names of projects, products, or systems
- Topics: Technical concepts, technologies, or important subjects mentioned`,
        });

        logger.debug(
            { people: output.people, projects: output.projects, topics: output.topics },
            "Pre-extraction completed"
        );

        return output;
    } catch (error) {
        logger.error({ error }, "Pre-extraction failed");
        // Return empty arrays rather than failing - we can still try ingestion
        return { people: [], projects: [], topics: [] };
    }
}
