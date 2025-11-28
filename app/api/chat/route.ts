import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

export async function POST(req: Request) {
    assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

    const openrouter = createOpenRouter({
        apiKey: env.OPENROUTER_API_KEY,
    });

    const { messages } = (await req.json()) as { messages: UIMessage[] };

    logger.info(
        { messageCount: messages?.length ?? 0, model: "anthropic/claude-sonnet-4.5" },
        "Starting chat stream"
    );

    const result = await streamText({
        model: openrouter.chat("anthropic/claude-sonnet-4.5"),
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages),
    });

    logger.debug({ messageCount: messages?.length ?? 0 }, "Chat stream initiated");

    return result.toTextStreamResponse();
}
