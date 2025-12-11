#!/usr/bin/env bun
/**
 * Multi-turn conversation test that reliably triggers thinking blocks bug
 *
 * Creates a conversation where:
 * 1. First message triggers reasoning + tool call
 * 2. Second message continues the conversation
 * 3. Bug manifests when assistant's message with thinking blocks is reused
 */

const baseUrl = "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;

if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set");
    process.exit(1);
}

function buildMessage(content: string) {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

async function consumeStream(
    response: Response
): Promise<{ text: string; error?: string }> {
    const reader = response.body?.getReader();
    if (!reader) return { text: "" };

    const decoder = new TextDecoder();
    let extractedText = "";
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
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
                    } catch {}
                }
            }
        }
    } catch (error) {
        return {
            text: extractedText,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    return { text: extractedText };
}

async function main() {
    console.log("=".repeat(60));
    console.log("MULTI-TURN THINKING BLOCKS TEST");
    console.log("=".repeat(60));

    // First message: triggers reasoning + tool call
    const message1 = buildMessage(
        "Solve this complex problem: What are the key differences between quantum entanglement and quantum superposition? Do deep research."
    );

    console.log("\n[1/2] Sending first message (triggers reasoning + deepResearch)...");
    const startTime1 = Date.now();

    let response1;
    try {
        response1 = await fetch(`${baseUrl}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [message1],
            }),
        });
    } catch (error) {
        console.log(
            `\n\x1b[31m FAIL \x1b[0m Request 1 failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
    }

    if (!response1.ok) {
        console.log(
            `\n\x1b[31m FAIL \x1b[0m Request 1 failed with status ${response1.status}`
        );
        process.exit(1);
    }

    const connectionId = response1.headers.get("X-Connection-Id");
    if (!connectionId) {
        console.log("\n\x1b[31m FAIL \x1b[0m No connection ID in response");
        process.exit(1);
    }

    const { text: text1, error: error1 } = await consumeStream(response1);
    const duration1 = Date.now() - startTime1;

    if (error1) {
        console.log(`\n\x1b[31m FAIL \x1b[0m Request 1 stream error: ${error1}`);
        process.exit(1);
    }

    console.log(`   ✓ Completed in ${(duration1 / 1000).toFixed(1)}s`);
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Response: ${text1.slice(0, 100)}...`);

    // Build the conversation history for second message
    // This simulates what the client does - it includes the assistant's response
    const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text", text: text1 }],
    };

    // Second message: continues the conversation
    // This is where the bug manifests - when we send the conversation history
    // that includes the assistant's message with thinking blocks
    const message2 = buildMessage("Now explain it in simpler terms for a beginner.");

    console.log("\n[2/2] Sending follow-up message (triggers multi-turn bug)...");
    const startTime2 = Date.now();

    let response2;
    try {
        response2 = await fetch(`${baseUrl}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [message1, assistantMessage, message2],
                connectionId,
            }),
        });
    } catch (error) {
        console.log(
            `\n\x1b[31m FAIL \x1b[0m Request 2 failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
    }

    if (!response2.ok) {
        const errorBody = await response2.text();
        console.log(
            `\n\x1b[31m FAIL \x1b[0m Request 2 failed with status ${response2.status}`
        );
        console.log(`Error: ${errorBody}`);
        process.exit(1);
    }

    const { text: text2, error: error2 } = await consumeStream(response2);
    const duration2 = Date.now() - startTime2;

    if (error2) {
        console.log(`\n\x1b[31m FAIL \x1b[0m Request 2 stream error: ${error2}`);
        process.exit(1);
    }

    console.log(`   ✓ Completed in ${(duration2 / 1000).toFixed(1)}s`);
    console.log(`   Response: ${text2.slice(0, 100)}...`);

    console.log(
        "\n\x1b[32m PASS \x1b[0m Multi-turn conversation completed successfully"
    );
    console.log("\nThis test would FAIL without the fix because the assistant message");
    console.log("would contain thinking blocks that cannot be modified.");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
