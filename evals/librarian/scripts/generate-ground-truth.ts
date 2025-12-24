/**
 * Generate ground truth for Librarian evaluation using Claude.
 *
 * Analyzes each sampled conversation and determines:
 * - Should anything be saved?
 * - What path(s)?
 * - Create, update, or append?
 * - What content patterns should be present?
 */

import "dotenv/config";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");

interface SampledConversation {
    id: string;
    topic: string;
    persona_id: string;
    persona_context: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
}

interface GroundTruth {
    conversationId: string;
    shouldSave: boolean;
    extractions: Array<{
        path: string;
        pathPattern: string; // regex pattern
        action: "create" | "update" | "append";
        contentPatterns: string[]; // regex patterns for content
        reasoning: string;
    }>;
    reasoning: string;
}

const ANALYSIS_PROMPT = `You are evaluating what a Knowledge Librarian should extract from a conversation.

The Librarian's job is to identify DURABLE, PERSONAL knowledge worth remembering:
- Identity facts (profession, location, background)
- Preferences (likes/dislikes, styles, habits)
- People (relationships, names, facts about them)
- Projects (work, hobbies, ongoing efforts)
- Life events (milestones, changes)

The Librarian should NOT save:
- Transient information (current mood, today's plans)
- Generic facts (capital of France)
- Already-known information
- Greetings and small talk
- Hypothetical or uncertain statements

Given this conversation, analyze what should be extracted.

<persona_context>
{{PERSONA_CONTEXT}}
</persona_context>

<conversation>
{{CONVERSATION}}
</conversation>

Respond with a JSON object:
{
  "shouldSave": boolean,
  "extractions": [
    {
      "path": "knowledge.identity" | "knowledge.people.{Name}" | "knowledge.projects.{name}" | "knowledge.preferences.{category}",
      "pathPattern": "regex pattern to match the path",
      "action": "create" | "update" | "append",
      "contentPatterns": ["regex patterns that should appear in saved content"],
      "reasoning": "why this should be saved"
    }
  ],
  "reasoning": "overall reasoning for the decision"
}

If nothing should be saved, return:
{
  "shouldSave": false,
  "extractions": [],
  "reasoning": "explanation of why nothing is worth saving"
}

Be conservative - only extract genuinely durable personal knowledge. Preferences revealed in context (like enjoying classic films) ARE worth saving if they represent lasting interests.`;

async function analyzeConversation(
    openrouter: ReturnType<typeof createOpenRouter>,
    conversation: SampledConversation
): Promise<GroundTruth> {
    const conversationText = conversation.messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

    const prompt = ANALYSIS_PROMPT.replace(
        "{{PERSONA_CONTEXT}}",
        conversation.persona_context
    ).replace("{{CONVERSATION}}", conversationText);

    const response = await generateText({
        model: openrouter("anthropic/claude-sonnet-4"),
        prompt,
        maxOutputTokens: 1024,
    });

    const text = response.text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error(`Failed to parse response for ${conversation.id}:`, text);
        return {
            conversationId: conversation.id,
            shouldSave: false,
            extractions: [],
            reasoning: "Failed to parse response",
        };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            conversationId: conversation.id,
            shouldSave: parsed.shouldSave,
            extractions: parsed.extractions || [],
            reasoning: parsed.reasoning,
        };
    } catch (e) {
        console.error(`JSON parse error for ${conversation.id}:`, e);
        return {
            conversationId: conversation.id,
            shouldSave: false,
            extractions: [],
            reasoning: "JSON parse error",
        };
    }
}

async function main() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("Missing OPENROUTER_API_KEY");
        process.exit(1);
    }

    console.log("Loading sampled conversations...");

    const samplesPath = join(DATA_DIR, "sampled_conversations.json");
    const samples: SampledConversation[] = JSON.parse(
        readFileSync(samplesPath, "utf-8")
    );
    console.log(`Loaded ${samples.length} conversations`);

    const openrouter = createOpenRouter({ apiKey });
    const groundTruths: GroundTruth[] = [];

    console.log("\nAnalyzing conversations with Claude...\n");

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        console.log(
            `[${i + 1}/${samples.length}] Analyzing ${sample.id} (${sample.topic})...`
        );

        try {
            const result = await analyzeConversation(openrouter, sample);
            groundTruths.push(result);

            const status = result.shouldSave
                ? `✓ Save (${result.extractions.length} extraction${result.extractions.length !== 1 ? "s" : ""})`
                : "✗ No save";
            console.log(`  ${status}`);

            // Rate limit: ~50 requests/minute for Claude
            if (i < samples.length - 1) {
                await new Promise((r) => setTimeout(r, 1200));
            }
        } catch (error) {
            console.error(`  Error: ${error}`);
            groundTruths.push({
                conversationId: sample.id,
                shouldSave: false,
                extractions: [],
                reasoning: `Error: ${error}`,
            });
        }
    }

    // Summary
    const saveCount = groundTruths.filter((g) => g.shouldSave).length;
    const noSaveCount = groundTruths.filter((g) => !g.shouldSave).length;
    console.log(`\n--- Summary ---`);
    console.log(`Should save: ${saveCount}`);
    console.log(`No save: ${noSaveCount}`);

    // Write results
    const outputPath = join(DATA_DIR, "ground_truth.json");
    writeFileSync(outputPath, JSON.stringify(groundTruths, null, 2));
    console.log(`\nWritten to ${outputPath}`);
}

main().catch(console.error);
