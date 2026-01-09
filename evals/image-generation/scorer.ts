/**
 * Image Quality Scorer - Round-Robin Batch Ranking
 *
 * Uses LLM-as-judge (Claude with vision) to comparatively rank
 * model outputs in small batches (3 at a time), then combines
 * results using round-robin scoring.
 *
 * This approach:
 * - Stays within context limits (3 images per call)
 * - Ensures fair comparison via round-robin batching
 * - Forces differentiation within each batch
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getGatewayClient } from "@/lib/ai/gateway";

const BATCH_SIZE = 3;

/**
 * Single image entry for batch ranking
 */
export interface RankingCandidate {
    id: string; // Model ID for tracking
    imageBase64: string;
    mimeType: string;
}

/**
 * Result of batch ranking for one prompt
 */
export interface BatchRankingResult {
    rankings: {
        modelId: string;
        rank: number; // 1 = best
        normalizedScore: number; // 0-100
        wins: number;
        losses: number;
        notes?: string;
    }[];
    batchCount: number;
    judgeReasoning: string;
}

const RankingResponseSchema = z.object({
    rankings: z.array(
        z.object({
            imageLabel: z.string().describe("The label (A, B, C) of the image"),
            rank: z.number().min(1).max(3).describe("Rank: 1 (best), 2, or 3 (worst)"),
            notes: z.string().optional().describe("Brief note on strengths/weaknesses"),
        })
    ),
    reasoning: z.string().describe("1-2 sentences explaining why the winner is best"),
});

/**
 * Generate round-robin batches where each model faces each other model at least once.
 * For n models, generates batches of 3 ensuring fair matchups.
 */
function generateRoundRobinBatches(modelIds: string[]): string[][] {
    const n = modelIds.length;
    if (n <= 3) {
        return [modelIds];
    }

    const batches: string[][] = [];
    const matchups = new Set<string>();

    // Track which pairs have been matched
    const getPairKey = (a: string, b: string) => [a, b].sort().join("|");

    // Generate all needed pairs
    const neededPairs: [string, string][] = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            neededPairs.push([modelIds[i], modelIds[j]]);
        }
    }

    // Greedy batching: pick 3 models that maximize new matchups
    const shuffledModels = [...modelIds].sort(() => Math.random() - 0.5);

    while (matchups.size < neededPairs.length) {
        let bestBatch: string[] = [];
        let bestNewMatchups = 0;

        // Try random combinations to find good batches
        for (let attempt = 0; attempt < 50; attempt++) {
            const batch: string[] = [];
            const available = [...shuffledModels].sort(() => Math.random() - 0.5);

            for (const model of available) {
                if (batch.length < 3) {
                    batch.push(model);
                }
            }

            // Count new matchups this batch would create
            let newMatchups = 0;
            for (let i = 0; i < batch.length; i++) {
                for (let j = i + 1; j < batch.length; j++) {
                    const key = getPairKey(batch[i], batch[j]);
                    if (!matchups.has(key)) {
                        newMatchups++;
                    }
                }
            }

            if (newMatchups > bestNewMatchups) {
                bestNewMatchups = newMatchups;
                bestBatch = batch;
            }
        }

        if (bestNewMatchups === 0) {
            // All pairs covered, but ensure each model appears similar number of times
            break;
        }

        // Add batch and record matchups
        batches.push(bestBatch);
        for (let i = 0; i < bestBatch.length; i++) {
            for (let j = i + 1; j < bestBatch.length; j++) {
                matchups.add(getPairKey(bestBatch[i], bestBatch[j]));
            }
        }
    }

    return batches;
}

/**
 * Rank a single batch of 3 images
 */
async function rankBatch(
    prompt: string,
    expectedStrengths: string[],
    batch: RankingCandidate[]
): Promise<{
    rankings: { modelId: string; rank: number; notes?: string }[];
    reasoning: string;
}> {
    // Shuffle to prevent position bias
    const shuffled = [...batch].sort(() => Math.random() - 0.5);
    const idToLabel = new Map<string, string>();
    shuffled.forEach((c, i) => {
        idToLabel.set(c.id, String.fromCharCode(65 + i)); // A, B, C
    });

    const labelToId = new Map<string, string>();
    shuffled.forEach((c, i) => {
        labelToId.set(String.fromCharCode(65 + i), c.id);
    });

    const imageContent = shuffled.map((candidate) => ({
        type: "image" as const,
        image: `data:${candidate.mimeType};base64,${candidate.imageBase64}`,
    }));

    const gateway = getGatewayClient();

    const response = await generateObject({
        model: gateway("anthropic/claude-sonnet-4"),
        schema: RankingResponseSchema,
        messages: [
            {
                role: "user",
                content: [
                    ...imageContent,
                    {
                        type: "text",
                        text: `Rank these 3 AI-generated images for the prompt: "${prompt}"

Expected strengths: ${expectedStrengths.join(", ")}

Images are labeled A, B, C (in order shown above).

Rank all 3 from best (1) to worst (3). Consider:
- Prompt adherence
- Technical quality
- Text accuracy (if applicable)
- Professional usability

Be decisive - pick clear winners. Return rankings for A, B, and C.`,
                    },
                ],
            },
        ],
    });

    const rankings = response.object.rankings
        .map((r) => {
            const modelId = labelToId.get(r.imageLabel);
            if (!modelId) {
                console.warn(`Unknown label: ${r.imageLabel}`);
                return null;
            }
            return {
                modelId,
                rank: r.rank,
                notes: r.notes,
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    return {
        rankings,
        reasoning: response.object.reasoning,
    };
}

/**
 * Batch rank images using round-robin tournament.
 *
 * Each model competes in multiple batches of 3.
 * Final score is based on win/loss record across all batches.
 */
export async function batchRankImages(
    prompt: string,
    expectedStrengths: string[],
    candidates: RankingCandidate[]
): Promise<BatchRankingResult> {
    if (candidates.length === 0) {
        throw new Error("No candidates to rank");
    }

    if (candidates.length === 1) {
        return {
            rankings: [
                {
                    modelId: candidates[0].id,
                    rank: 1,
                    normalizedScore: 100,
                    wins: 0,
                    losses: 0,
                },
            ],
            batchCount: 0,
            judgeReasoning: "Single candidate - no comparison possible",
        };
    }

    if (candidates.length === 2) {
        // Direct comparison
        const result = await rankBatch(prompt, expectedStrengths, candidates);
        const winner = result.rankings.find((r) => r.rank === 1);
        const loser = result.rankings.find((r) => r.rank === 2);
        return {
            rankings: [
                {
                    modelId: winner?.modelId ?? candidates[0].id,
                    rank: 1,
                    normalizedScore: 100,
                    wins: 1,
                    losses: 0,
                    notes: winner?.notes,
                },
                {
                    modelId: loser?.modelId ?? candidates[1].id,
                    rank: 2,
                    normalizedScore: 0,
                    wins: 0,
                    losses: 1,
                    notes: loser?.notes,
                },
            ],
            batchCount: 1,
            judgeReasoning: result.reasoning,
        };
    }

    // Generate round-robin batches
    const modelIds = candidates.map((c) => c.id);
    const batches = generateRoundRobinBatches(modelIds);

    // Track wins/losses for each model
    const stats = new Map<string, { wins: number; losses: number; notes: string[] }>();
    for (const c of candidates) {
        stats.set(c.id, { wins: 0, losses: 0, notes: [] });
    }

    const reasonings: string[] = [];

    // Run all batches
    for (const batchIds of batches) {
        const batchCandidates = batchIds
            .map((id) => candidates.find((c) => c.id === id))
            .filter((c): c is RankingCandidate => c !== undefined);

        if (batchCandidates.length < 2) continue;

        try {
            const result = await rankBatch(prompt, expectedStrengths, batchCandidates);
            reasonings.push(result.reasoning);

            // Update stats based on rankings
            for (const r of result.rankings) {
                const s = stats.get(r.modelId);
                if (s) {
                    // 1st place: 2 wins, 2nd: 1 win 1 loss, 3rd: 2 losses
                    if (r.rank === 1) {
                        s.wins += 2;
                    } else if (r.rank === 2) {
                        s.wins += 1;
                        s.losses += 1;
                    } else {
                        s.losses += 2;
                    }
                    if (r.notes) s.notes.push(r.notes);
                }
            }
        } catch (error) {
            console.error(`Batch ranking failed: ${error}`);
        }
    }

    // Convert stats to rankings
    const modelScores = Array.from(stats.entries()).map(([modelId, s]) => ({
        modelId,
        wins: s.wins,
        losses: s.losses,
        winRate: s.wins / (s.wins + s.losses || 1),
        notes: s.notes.join("; "),
    }));

    // Sort by win rate
    modelScores.sort((a, b) => b.winRate - a.winRate);

    // Assign ranks and normalized scores
    const rankings = modelScores.map((m, i) => ({
        modelId: m.modelId,
        rank: i + 1,
        normalizedScore: Math.round(m.winRate * 100),
        wins: m.wins,
        losses: m.losses,
        notes: m.notes || undefined,
    }));

    return {
        rankings,
        batchCount: batches.length,
        judgeReasoning: reasonings[0] ?? "No successful rankings",
    };
}
