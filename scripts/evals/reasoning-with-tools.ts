#!/usr/bin/env bun
/**
 * Thinking Blocks Bug Regression Test
 *
 * Reproduces and validates fix for the thinking blocks bug where queries that:
 * 1. Trigger high-effort reasoning
 * 2. Use tools (webSearch, deepResearch, etc.)
 *
 * Would fail with Anthropic API error:
 * "messages.1.content.2: `thinking` or `redacted_thinking` blocks in the
 *  latest assistant message cannot be modified."
 *
 * The bug was that originalMessages (with thinking blocks) were passed to
 * toUIMessageStreamResponse instead of messagesWithoutReasoning (filtered).
 *
 * This test uses the git worktrees query as a trigger because it:
 * - Activates high-effort reasoning (complex technical problem)
 * - Calls webSearch tool (creates multi-turn conversation)
 * - Exposes the bug reliably
 *
 * BEFORE FIX: Test fails with 200 status but streaming error
 * AFTER FIX: Test passes with successful response
 *
 * Usage:
 *   bun scripts/evals/worktree-drift-query-bug.ts [--base-url=X]
 */

// Parse CLI args
const args = process.argv.slice(2);
const baseUrl =
    args.find((a) => a.startsWith("--base-url="))?.substring("--base-url=".length) ??
    "http://localhost:3000";

// Load JWT from environment
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set in environment");
    console.error(
        "Create a long-lived JWT in Clerk Dashboard and add it to .env.local"
    );
    process.exit(1);
}

/**
 * Build UIMessage format required by the API
 */
function buildMessage(content: string) {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

/**
 * Consume streaming response and extract content
 */
async function consumeStream(
    response: Response
): Promise<{ text: string; error?: string }> {
    const reader = response.body?.getReader();
    if (!reader) {
        return { text: "" };
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let extractedText = "";
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "text-delta" && data.delta) {
                            extractedText += data.delta;
                        }
                        if (data.type === "error") {
                            return { text: extractedText, error: data.error };
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }

                if (line.startsWith("0:")) {
                    const match = line.match(/^0:"([^"\\]*(?:\\.[^"\\]*)*)"/);
                    if (match) {
                        try {
                            extractedText += JSON.parse(`"${match[1]}"`);
                        } catch {
                            extractedText += match[1];
                        }
                    }
                }
            }
        }

        if (buffer.trim() && buffer.startsWith("data: ")) {
            try {
                const data = JSON.parse(buffer.slice(6));
                if (data.type === "text-delta" && data.delta) {
                    extractedText += data.delta;
                }
                if (data.type === "error") {
                    return { text: extractedText, error: data.error };
                }
            } catch {
                // Ignore parse errors
            }
        }
    } catch (error) {
        return {
            text: extractedText,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    return { text: extractedText || fullText.slice(0, 1000) };
}

/**
 * Run the test
 */
async function main() {
    console.log("=".repeat(60));
    console.log("WORKTREE DRIFT QUERY BUG TEST");
    console.log("=".repeat(60));
    console.log(`Base URL: ${baseUrl}`);
    console.log(`JWT Token: ${JWT_TOKEN!.slice(0, 20)}...`);

    const query = `I have a fairly sophisticated clod code set up and I'm noticing that in order to work in parallel, I've gotten used to using git work trees. Overall, I've been happy with this.

But the problem I'm having is that clod code, when it does its compaction, tends to forget that it's working in the git work tree, and then it'll commit to main. I'm realizing some more separation would probably be healthy, so I'm trying to understand what's the best way to handle this.

Give me some ideas, do some research, how are other people solving this in particular with Claude Code? I'd love to understand best practices here.`;

    console.log("\nQuery:");
    console.log(query.slice(0, 200) + "...");
    console.log("\nSending request...");

    const startTime = Date.now();

    try {
        const response = await fetch(`${baseUrl}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [buildMessage(query)],
            }),
        });

        const duration = Date.now() - startTime;

        console.log(`\nStatus: ${response.status}`);
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

        if (!response.ok) {
            const responseClone = response.clone();
            let errorText = "";
            try {
                const errorBody = await response.json();
                errorText = errorBody.error || JSON.stringify(errorBody);
            } catch {
                errorText = await responseClone.text();
            }

            console.log("\n\x1b[31m FAIL \x1b[0m Request failed");
            console.log(`Error: ${errorText}`);
            process.exit(1);
        }

        // Consume streaming response
        const { text, error } = await consumeStream(response);

        if (error) {
            console.log("\n\x1b[31m FAIL \x1b[0m Stream error");
            console.log(`Error: ${error}`);
            console.log(
                `Partial response: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`
            );
            process.exit(1);
        }

        console.log("\n\x1b[32m PASS \x1b[0m Query completed successfully");
        console.log(`Response length: ${text.length} characters`);
        console.log("\nFirst 500 characters:");
        console.log(text.slice(0, 500));
        console.log(text.length > 500 ? "..." : "");

        process.exit(0);
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`\nDuration: ${(duration / 1000).toFixed(1)}s`);
        console.log("\n\x1b[31m FAIL \x1b[0m Exception thrown");
        console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
            console.log("\nStack trace:");
            console.log(error.stack);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
