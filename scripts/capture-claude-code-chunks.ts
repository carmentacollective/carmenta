#!/usr/bin/env npx tsx
/**
 * Capture Claude Code SDK Chunks
 *
 * Standalone script to capture every chunk from the Claude Agent SDK.
 * Runs a sample task that exercises multiple tools and logs everything.
 *
 * Usage:
 *   npx tsx scripts/capture-claude-code-chunks.ts
 *
 * Output:
 *   - Console: formatted chunk summaries
 *   - File: scripts/claude-code-chunks-capture.json (full data)
 */

import { createClaudeCode } from "ai-sdk-provider-claude-code";
import { streamText, convertToModelMessages } from "ai";
import { writeFileSync } from "fs";
import { join } from "path";

// Capture all chunks
interface CapturedChunk {
    timestamp: number;
    elapsed: number;
    type: string;
    data: unknown;
}

const chunks: CapturedChunk[] = [];
const startTime = Date.now();

function capture(type: string, data: unknown) {
    const now = Date.now();
    chunks.push({
        timestamp: now,
        elapsed: now - startTime,
        type,
        data,
    });

    // Pretty print to console
    const elapsed = `${now - startTime}ms`.padStart(6);
    console.log(`[${elapsed}] 📦 ${type}`);

    // Safely extract and display key details
    const d = data as Record<string, unknown>;

    try {
        if (type === "tool-input-start") {
            console.log(`         → Tool: ${d.toolName} (${d.id})`);
        } else if (type === "tool-input-delta") {
            // inputDelta might be undefined or a string
            const delta = String(d.inputDelta ?? d.delta ?? "");
            if (delta) {
                const preview = delta.slice(0, 100).replace(/\n/g, "\\n");
                console.log(
                    `         → Delta: ${preview}${delta.length > 100 ? "..." : ""}`
                );
            } else {
                // Log all keys to understand the structure
                console.log(`         → Keys: ${Object.keys(d).join(", ")}`);
            }
        } else if (type === "tool-call") {
            const input = JSON.stringify(d.input ?? {}).slice(0, 100);
            console.log(`         → ${d.toolName}: ${input}...`);
        } else if (type === "tool-result") {
            const output = String(d.output ?? d.result ?? "");
            console.log(
                `         → Result: ${output.slice(0, 100)}${output.length > 100 ? "..." : ""}`
            );
        } else if (type === "text-delta") {
            const text = String(d.text ?? d.textDelta ?? "");
            if (text) {
                const preview = text.slice(0, 80).replace(/\n/g, "\\n");
                console.log(`         → "${preview}${text.length > 80 ? "..." : ""}"`);
            }
        } else {
            // For unknown types, show all keys
            const keys = Object.keys(d);
            if (keys.length > 0 && keys[0] !== "type") {
                console.log(`         → Keys: ${keys.join(", ")}`);
            }
        }
    } catch (err) {
        console.log(`         → (parse error: ${err})`);
    }
}

async function main() {
    console.log("🚀 Starting Claude Code SDK capture...\n");
    console.log("Project:", process.cwd());
    console.log("");

    // Create Claude Code provider
    const claudeCode = createClaudeCode({
        defaultSettings: {
            cwd: process.cwd(),
            permissionMode: "bypassPermissions",
            settingSources: ["project", "user", "local"],
            systemPrompt: { type: "preset", preset: "claude_code" },
        },
    });

    // Sample task that should trigger multiple tool types:
    // - Read (file reading)
    // - Glob (file finding)
    // - Grep (searching)
    // - Task (agent spawning) if we ask for research
    // - WebSearch if we ask about something current
    const userMessage = `
Do a quick analysis:
1. Read the package.json to see what dependencies we have
2. Search for any TODO comments in the lib/ directory
3. Give me a one-sentence summary
Keep it brief.
`.trim();

    console.log("📝 User message:");
    console.log(`   "${userMessage.replace(/\n/g, "\\n   ")}"`);
    console.log("");
    console.log("─".repeat(60));
    console.log("");

    // Convert to model messages
    const messages = await convertToModelMessages([
        {
            role: "user" as const,
            parts: [{ type: "text" as const, text: userMessage }],
        },
    ]);

    capture("setup-complete", { messageCount: messages.length });

    try {
        const result = streamText({
            model: claudeCode("sonnet"),
            messages,
            onChunk: ({ chunk }) => {
                capture(chunk.type, chunk);
            },
            onFinish: (event) => {
                capture("finish", {
                    finishReason: event.finishReason,
                    usage: event.usage,
                });
            },
        });

        // Consume the stream
        console.log("\n📥 Streaming response...\n");

        let fullText = "";
        for await (const textPart of result.textStream) {
            fullText += textPart;
        }

        capture("stream-complete", { textLength: fullText.length });

        console.log("\n" + "─".repeat(60));
        console.log("\n📊 Capture Summary:");
        console.log(`   Total chunks: ${chunks.length}`);
        console.log(`   Total time: ${Date.now() - startTime}ms`);

        // Count by type
        const typeCounts = chunks.reduce(
            (acc, c) => {
                acc[c.type] = (acc[c.type] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );
        console.log("\n   Chunk types:");
        Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                console.log(`     ${type}: ${count}`);
            });

        // Save full capture to file
        const outputPath = join(
            process.cwd(),
            "scripts/claude-code-chunks-capture.json"
        );
        writeFileSync(outputPath, JSON.stringify(chunks, null, 2));
        console.log(`\n💾 Full capture saved to: ${outputPath}`);

        console.log("\n✅ Done!\n");
    } catch (error) {
        capture("error", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        console.error("\n❌ Error:", error);
        process.exit(1);
    }
}

main();
