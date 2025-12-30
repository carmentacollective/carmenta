#!/usr/bin/env npx tsx
/**
 * Test script to verify Claude Code streaming events
 *
 * This script directly tests the ai-sdk-provider-claude-code streaming
 * to understand what events we receive and in what order.
 *
 * Run with: npx tsx scripts/test-claude-code-streaming.ts
 */

import { streamText } from "ai";
import { createClaudeCode } from "ai-sdk-provider-claude-code";

async function testStreaming() {
    console.log("🧪 Testing Claude Code Streaming Events\n");
    console.log("=".repeat(60));

    const claudeCode = createClaudeCode({
        defaultSettings: {
            cwd: process.cwd(),
            permissionMode: "bypassPermissions",
            settingSources: ["project", "user", "local"],
            systemPrompt: { type: "preset", preset: "claude_code" },
        },
    });

    const startTime = Date.now();
    const events: { time: number; type: string; data: unknown }[] = [];

    const log = (type: string, data: unknown) => {
        const elapsed = Date.now() - startTime;
        events.push({ time: elapsed, type, data });
        console.log(
            `[${elapsed.toString().padStart(6)}ms] ${type}:`,
            JSON.stringify(data, null, 2).slice(0, 200)
        );
    };

    console.log("\n📝 Query: 'List the files in the root directory'\n");
    console.log("-".repeat(60));

    try {
        const result = streamText({
            model: claudeCode("sonnet"),
            prompt: "List the files in the root directory. Be brief.",
            onChunk: ({ chunk }) => {
                if (chunk.type === "tool-call") {
                    log("TOOL-CALL", {
                        toolName: chunk.toolName,
                        toolCallId: chunk.toolCallId,
                        input: chunk.input,
                    });
                } else if (chunk.type === "tool-result") {
                    log("TOOL-RESULT", {
                        toolCallId: chunk.toolCallId,
                        // Truncate large outputs
                        output: JSON.stringify(chunk.output)?.slice(0, 100),
                    });
                } else if (chunk.type === "text-delta") {
                    log("TEXT-DELTA", { text: chunk.text?.slice(0, 50) });
                } else {
                    log(chunk.type.toUpperCase(), chunk);
                }
            },
        });

        // Consume the stream to trigger events
        console.log("\n📊 Consuming stream...\n");

        let fullText = "";
        for await (const chunk of result.textStream) {
            fullText += chunk;
        }

        console.log("\n" + "=".repeat(60));
        console.log("✅ Stream complete!\n");
        console.log(`📝 Final text length: ${fullText.length} chars`);
        console.log(`⏱️  Total time: ${Date.now() - startTime}ms`);
        console.log(`📈 Total events: ${events.length}`);

        // Summary
        console.log("\n📊 Event Summary:");
        const eventCounts = events.reduce(
            (acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );
        console.log(eventCounts);

        // Tool call timing analysis
        const toolCalls = events.filter((e) => e.type === "TOOL-CALL");
        const toolResults = events.filter((e) => e.type === "TOOL-RESULT");

        console.log("\n⏱️  Tool Call Timing:");
        toolCalls.forEach((call, i) => {
            const result = toolResults.find(
                (r) => (r.data as any)?.toolCallId === (call.data as any)?.toolCallId
            );
            const duration = result ? result.time - call.time : "N/A";
            console.log(
                `  ${i + 1}. ${(call.data as any)?.toolName}: ${call.time}ms → ${result?.time || "?"}ms (${duration}ms)`
            );
        });
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

testStreaming();
