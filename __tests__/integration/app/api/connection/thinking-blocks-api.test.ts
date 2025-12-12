/**
 * Integration test for thinking blocks fix via actual API endpoint
 *
 * This test verifies that reasoning + tools works without errors.
 *
 * Background: Anthropic's thinking/redacted_thinking blocks cannot be modified
 * in subsequent API requests. When multi-step tool calling was enabled with
 * reasoning, step 2+ would fail with "thinking blocks cannot be modified".
 *
 * Fix: Multi-step is disabled when reasoning is enabled, allowing single-step
 * tool use to work correctly with reasoning.
 */

import { describe, test, expect } from "vitest";

// Skip if no API key or not running against local server
const API_URL = process.env.TEST_API_URL || "http://localhost:3000";
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;
const describeWithApi = TEST_USER_TOKEN ? describe : describe.skip;

describeWithApi("Thinking blocks fix", () => {
    test("Reasoning + tools completes without thinking blocks error", async () => {
        // This test uses high reasoning + a query that triggers tool calls
        // Before the fix, this would fail at step 2 with "thinking blocks cannot be modified"
        // After the fix, multi-step is disabled with reasoning, so it completes in step 1
        const requestBody = {
            messages: [
                {
                    id: "user-1",
                    role: "user",
                    parts: [
                        {
                            type: "text",
                            text: "Compare Claude, GPT-4, and Gemini API pricing. Search the web for current 2025 prices for all three.",
                        },
                    ],
                },
            ],
            reasoningOverride: "high",
        };

        let responseText = "";
        let hasToolCall = false;
        let hasError = false;

        const response = await fetch(`${API_URL}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${TEST_USER_TOKEN}`,
            },
            body: JSON.stringify(requestBody),
        });

        // Read the streaming response
        const reader = response.body?.getReader();
        if (reader) {
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                responseText += chunk;

                // Check for tool call (webSearch, etc)
                if (
                    chunk.includes("tool-call") ||
                    chunk.includes("webSearch") ||
                    chunk.includes("tool_use")
                ) {
                    hasToolCall = true;
                }

                // Check for any error in stream
                if (chunk.includes('"type":"error"') || chunk.includes('"errorText"')) {
                    hasError = true;
                }
            }
        }

        console.log("=== Test Results ===");
        console.log("Response status:", response.status);
        console.log("Response length:", responseText.length);
        console.log("Has tool call:", hasToolCall);
        console.log("Has error:", hasError);

        // Verify the fix works:
        // - Tool calls should still work (reasoning doesn't break tools)
        // - No error should occur (the thinking blocks error is prevented)
        expect(hasToolCall).toBe(true); // Tools still work with reasoning
        expect(hasError).toBe(false); // No thinking blocks error
        expect(response.status).toBe(200); // Request completes successfully
    }, 120000);
});
