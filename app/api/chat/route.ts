import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";

import { assertEnv, env } from "@/lib/env";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

export async function POST(req: Request) {
    assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

    const openrouter = createOpenRouter({
        apiKey: env.OPENROUTER_API_KEY,
    });

    const { messages } = await req.json();

    const result = await streamText({
        model: openrouter.chat("anthropic/claude-sonnet-4.5"),
        system: SYSTEM_PROMPT,
        messages,
    });

    return result.toTextStreamResponse();
}
