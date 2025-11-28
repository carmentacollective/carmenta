import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

import { assertEnv, env } from "@/lib/env";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

export async function POST(req: Request) {
    assertEnv(env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");

    const { messages } = await req.json();

    const result = await streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system: SYSTEM_PROMPT,
        messages,
    });

    return result.toTextStreamResponse();
}
