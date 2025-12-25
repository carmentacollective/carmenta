/**
 * Sample diverse conversations from PersonaMem for Librarian evaluation.
 *
 * Extracts 50 conversation snippets across different topics and personas
 * that contain extractable personal information (preferences, facts, relationships).
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");

interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

interface QuestionRow {
    persona_id: string;
    question_id: string;
    question_type: string;
    topic: string;
    shared_context_id: string;
    end_index_in_shared_context: string;
}

interface SampledConversation {
    id: string;
    topic: string;
    persona_id: string;
    persona_context: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
}

// Parse CSV (simple parser for this format)
function parseCSV(content: string): QuestionRow[] {
    const lines = content.trim().split("\n");
    const headers = lines[0].split(",");

    return lines.slice(1).map((line) => {
        // Handle quoted fields with commas
        const values: string[] = [];
        let current = "";
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
                values.push(current);
                current = "";
            } else {
                current += char;
            }
        }
        values.push(current);

        return {
            persona_id: values[0],
            question_id: values[1],
            question_type: values[2],
            topic: values[3],
            shared_context_id: values[13],
            end_index_in_shared_context: values[14],
        };
    });
}

// Load contexts from JSONL
function loadContexts(path: string): Record<string, Message[]> {
    const content = readFileSync(path, "utf-8");
    const contexts: Record<string, Message[]> = {};

    for (const line of content.trim().split("\n")) {
        if (!line) continue;
        const parsed = JSON.parse(line);
        // Each line is {context_id: [...messages]}
        for (const [id, messages] of Object.entries(parsed)) {
            contexts[id] = messages as Message[];
        }
    }

    return contexts;
}

// Extract a conversation segment (limit to reasonable length)
function extractSegment(
    messages: Message[],
    endIndex: number
): SampledConversation["messages"] {
    // Get system message for persona context
    const systemMsg = messages.find((m) => m.role === "system");

    // Get conversation turns (skip system)
    const turns = messages
        .filter((m) => m.role !== "system")
        .slice(0, Math.min(endIndex, 10)); // Limit to 10 turns max

    return turns.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.replace(/^(User|Assistant): ?/i, "").trim(),
    }));
}

// Sample conversations across topics
function sampleConversations(
    questions: QuestionRow[],
    contexts: Record<string, Message[]>,
    targetCount: number
): SampledConversation[] {
    // Group by topic
    const byTopic = new Map<string, QuestionRow[]>();
    for (const q of questions) {
        if (!byTopic.has(q.topic)) {
            byTopic.set(q.topic, []);
        }
        byTopic.get(q.topic)!.push(q);
    }

    const topics = Array.from(byTopic.keys()).filter((t) => t !== "topic");
    const samplesPerTopic = Math.ceil(targetCount / topics.length);

    const samples: SampledConversation[] = [];
    const seenContexts = new Set<string>();

    for (const topic of topics) {
        const topicQuestions = byTopic.get(topic) || [];
        let added = 0;

        for (const q of topicQuestions) {
            if (added >= samplesPerTopic) break;
            if (seenContexts.has(q.shared_context_id)) continue;

            const context = contexts[q.shared_context_id];
            if (!context) continue;

            const systemMsg = context.find((m) => m.role === "system");
            const endIdx = parseInt(q.end_index_in_shared_context) || 10;
            const messages = extractSegment(context, endIdx);

            if (messages.length < 2) continue;

            samples.push({
                id: `${topic}-${q.persona_id}-${added}`,
                topic,
                persona_id: q.persona_id,
                persona_context: systemMsg?.content || "",
                messages,
            });

            seenContexts.add(q.shared_context_id);
            added++;
        }
    }

    // Shuffle and take target count
    return samples.sort(() => Math.random() - 0.5).slice(0, targetCount);
}

// Main
async function main() {
    console.log("Loading PersonaMem data...");

    const questionsPath = join(DATA_DIR, "questions_32k.csv");
    const contextsPath = join(DATA_DIR, "shared_contexts_32k.jsonl");

    const questionsContent = readFileSync(questionsPath, "utf-8");
    const questions = parseCSV(questionsContent);
    console.log(`Loaded ${questions.length} questions`);

    const contexts = loadContexts(contextsPath);
    console.log(`Loaded ${Object.keys(contexts).length} contexts`);

    const samples = sampleConversations(questions, contexts, 50);
    console.log(`Sampled ${samples.length} conversations`);

    // Topic distribution
    const topicCounts = new Map<string, number>();
    for (const s of samples) {
        topicCounts.set(s.topic, (topicCounts.get(s.topic) || 0) + 1);
    }
    console.log("\nTopic distribution:");
    for (const [topic, count] of topicCounts) {
        console.log(`  ${topic}: ${count}`);
    }

    // Write samples
    const outputPath = join(DATA_DIR, "sampled_conversations.json");
    writeFileSync(outputPath, JSON.stringify(samples, null, 2));
    console.log(`\nWritten to ${outputPath}`);
}

main().catch(console.error);
