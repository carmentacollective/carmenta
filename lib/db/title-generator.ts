/**
 * LLM-powered connection title generator.
 *
 * Uses Haiku for fast, cheap title generation with optional emoji prefixes
 * inspired by gitmoji conventions.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import * as Sentry from "@sentry/nextjs";
import { generateText } from "ai";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Model used for title generation - fast and cheap.
 * Same as Concierge for consistency.
 */
const TITLE_GENERATOR_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Maximum title length including emoji.
 */
const MAX_TITLE_LENGTH = 60;

/**
 * System prompt for title generation.
 * Guides Haiku to create concise, meaningful titles with selective emoji use.
 */
const TITLE_SYSTEM_PROMPT = `You generate short connection titles.

Rules:
- Output ONLY the title, nothing else
- Maximum 50 characters (shorter is better)
- Capture the essence of what the user wants to accomplish
- Use present tense, active voice when possible

Emoji usage (inspired by gitmoji):
- Add ONE emoji at the start ONLY when it genuinely captures the intent
- Not every title needs an emoji - use sparingly
- Good examples:
  - "🔧 Fix authentication bug" (debugging/fixing)
  - "✨ Add dark mode toggle" (new feature)
  - "📝 Write API documentation" (docs)
  - "🚀 Deploy to production" (deployment)
  - "🐛 Debug memory leak" (bug hunting)
  - "🎨 Redesign landing page" (design/UI)
  - "🔍 Research caching strategies" (research)
  - "💡 Brainstorm product ideas" (ideation)
  - "Explain quantum computing" (no emoji - just informational)
  - "What's the weather today" (no emoji - simple question)

Skip emoji for:
- Simple questions or lookups
- Generic connections
- When no emoji feels right

Be concise. Be helpful. Nail the intent.`;

/**
 * Generates a connection title using Haiku.
 *
 * Falls back to simple truncation if LLM fails.
 *
 * @param firstMessage - The first user message text
 * @returns Generated title (max 60 chars)
 */
export async function generateTitle(firstMessage: string): Promise<string> {
    // Early return for empty messages
    if (!firstMessage.trim()) {
        return "New connection";
    }

    try {
        assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

        const openrouter = createOpenRouter({
            apiKey: env.OPENROUTER_API_KEY,
        });

        const result = await generateText({
            model: openrouter.chat(TITLE_GENERATOR_MODEL),
            system: TITLE_SYSTEM_PROMPT,
            prompt: firstMessage.slice(0, 500), // Limit input to save tokens
            temperature: 0.3, // Low temperature for consistent titles
            maxOutputTokens: 30, // Titles are short
            experimental_telemetry: {
                isEnabled: true,
                functionId: "title-generator",
            },
        });

        // Clean and validate the title
        let title = result.text.trim();

        // Remove quotes if the model wrapped the title
        if (
            (title.startsWith('"') && title.endsWith('"')) ||
            (title.startsWith("'") && title.endsWith("'"))
        ) {
            title = title.slice(1, -1);
        }

        // Enforce max length
        if (title.length > MAX_TITLE_LENGTH) {
            title = title.slice(0, MAX_TITLE_LENGTH - 3) + "...";
        }

        // Validate we got something useful
        if (title.length < 3) {
            throw new Error("Title too short");
        }

        logger.debug(
            { title, messagePreview: firstMessage.slice(0, 50) },
            "Generated title"
        );

        return title;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.warn(
            { error: errorMessage, messagePreview: firstMessage.slice(0, 50) },
            "Title generation failed, using fallback"
        );

        Sentry.captureException(error, {
            tags: { component: "title-generator" },
            level: "warning",
        });

        // Fallback to simple truncation
        return firstMessage.length > 47
            ? firstMessage.slice(0, 44) + "..."
            : firstMessage;
    }
}
