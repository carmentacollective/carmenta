/**
 * Image Generation Eval - Batch Ranking
 *
 * Tests image generation models using comparative batch ranking.
 * All models generate for the same prompt, then a judge ranks them together.
 * This forces differentiation and eliminates ceiling effects.
 *
 * Structure:
 * - 15 prompts (3 logos, 3 illustrations, 3 photos, 3 diagrams, 3 text)
 * - 13 models
 * - 15 judge calls (one per prompt, ranking all models)
 *
 * Run with: pnpm braintrust eval evals/image-generation/eval.ts
 */

import "dotenv/config";
import { Eval } from "braintrust";
import {
    IMAGE_MODEL_CATALOG,
    generateImageFromModel,
    type ImageModelConfig,
} from "@/lib/ai/image-generation";
import { batchRankImages, type RankingCandidate } from "./scorer";

// ============================================================================
// TEST PROMPTS - 15 total (3 per category)
// ============================================================================

interface TestPrompt {
    id: string;
    category: string;
    prompt: string;
    expectedStrengths: string[];
}

const testPrompts: TestPrompt[] = [
    // === LOGOS (3) ===
    {
        id: "logo-minimalist",
        category: "logos",
        prompt: "Minimalist logo for 'Morning Ritual' coffee shop. Earth tones, clean lines, professional. Simple icon with coffee cup silhouette.",
        expectedStrengths: ["clean design", "readable text", "professional"],
    },
    {
        id: "logo-bold",
        category: "logos",
        prompt: "Bold, modern logo for 'THUNDERBOLT' esports team. Electric blue and black, aggressive angular design, powerful typography.",
        expectedStrengths: ["bold impact", "readable text", "energetic feel"],
    },
    {
        id: "logo-vintage",
        category: "logos",
        prompt: "Vintage-style logo for 'Harbor & Sons' fishing supply company. Nautical theme, rope border, anchor motif, established 1952.",
        expectedStrengths: ["vintage aesthetic", "readable text", "nautical elements"],
    },

    // === ILLUSTRATIONS (3) ===
    {
        id: "illust-flat",
        category: "illustrations",
        prompt: "Flat design illustration of a diverse tech startup team brainstorming around a whiteboard. Modern, vibrant colors, friendly atmosphere.",
        expectedStrengths: [
            "flat style consistency",
            "diverse representation",
            "professional",
        ],
    },
    {
        id: "illust-character",
        category: "illustrations",
        prompt: "Cute cartoon character mascot: a friendly robot librarian with glasses, holding a stack of books, warm smile, approachable design.",
        expectedStrengths: [
            "appealing character",
            "consistent style",
            "friendly expression",
        ],
    },
    {
        id: "illust-detailed",
        category: "illustrations",
        prompt: "Detailed fantasy illustration of a cozy wizard's study. Floating books, bubbling potions, magical artifacts, warm candlelight, rich details.",
        expectedStrengths: ["rich detail", "atmospheric lighting", "fantasy elements"],
    },

    // === PHOTOREALISTIC (3) ===
    {
        id: "photo-portrait",
        category: "photorealistic",
        prompt: "Professional headshot of a confident businesswoman in her 40s, natural lighting, neutral background, warm but professional expression.",
        expectedStrengths: [
            "realistic skin",
            "natural lighting",
            "professional composition",
        ],
    },
    {
        id: "photo-landscape",
        category: "photorealistic",
        prompt: "Golden hour sunset over ocean with silhouette of palm trees. Warm orange and pink sky, photorealistic, professional photography quality.",
        expectedStrengths: [
            "realistic lighting",
            "atmospheric depth",
            "natural colors",
        ],
    },
    {
        id: "photo-product",
        category: "photorealistic",
        prompt: "Product photography of a sleek smartwatch on a marble surface. Dramatic side lighting, sharp focus, luxury feel, dark background.",
        expectedStrengths: [
            "sharp product detail",
            "professional lighting",
            "luxury aesthetic",
        ],
    },

    // === DIAGRAMS (3) ===
    {
        id: "diagram-flow",
        category: "diagrams",
        prompt: "Clean flowchart showing: User → API Gateway → Auth Service → Database. Technical style, clear arrows, labeled boxes, white background.",
        expectedStrengths: ["clear flow", "readable labels", "logical layout"],
    },
    {
        id: "diagram-arch",
        category: "diagrams",
        prompt: "Cloud architecture diagram with AWS-style icons: Load Balancer, EC2 instances, RDS database, S3 storage. Professional technical documentation style.",
        expectedStrengths: [
            "recognizable icons",
            "clear connections",
            "technical accuracy",
        ],
    },
    {
        id: "diagram-infographic",
        category: "diagrams",
        prompt: "Infographic showing '5 Steps to Better Sleep' with numbered sections, simple icons for each step, clean modern design, blue color scheme.",
        expectedStrengths: ["clear hierarchy", "readable numbers", "cohesive design"],
    },

    // === TEXT LAYOUTS (3) ===
    {
        id: "text-hero",
        category: "text",
        prompt: "Event poster with bold text 'TECH SUMMIT 2025' and subtext 'January 15-17, San Francisco'. Modern tech aesthetic, dark background with neon accents.",
        expectedStrengths: [
            "readable headline",
            "correct dates",
            "professional layout",
        ],
    },
    {
        id: "text-comic",
        category: "text",
        prompt: "Comic book panel with superhero shouting 'NEVER GIVE UP!' in a dramatic speech bubble. Dynamic action pose, bold comic style, motion lines.",
        expectedStrengths: [
            "readable speech bubble",
            "comic style text",
            "dynamic composition",
        ],
    },
    {
        id: "text-environmental",
        category: "text",
        prompt: "Cozy bookshop storefront with sign reading 'THE HIDDEN CHAPTER' above the door. Warm evening lighting, books visible in window display.",
        expectedStrengths: [
            "readable storefront sign",
            "integrated with scene",
            "atmospheric",
        ],
    },
];

// ============================================================================
// MODELS
// ============================================================================

// All models from catalog - round-robin batching handles any count
const imageModels = IMAGE_MODEL_CATALOG;

// ============================================================================
// TYPES
// ============================================================================

interface GeneratedImageResult {
    modelId: string;
    modelName: string;
    provider: string;
    success: boolean;
    imageBase64?: string;
    mimeType?: string;
    error?: string;
    durationMs: number;
}

interface PromptEvalOutput {
    promptId: string;
    category: string;
    rankings: {
        modelId: string;
        modelName: string;
        provider: string;
        rank: number;
        normalizedScore: number;
        notes?: string;
        generationSuccess: boolean;
        generationError?: string;
        durationMs: number;
    }[];
    judgeReasoning: string;
    successCount: number;
    totalCount: number;
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

async function generateImagesForPrompt(
    prompt: TestPrompt,
    models: ImageModelConfig[]
): Promise<GeneratedImageResult[]> {
    return Promise.all(
        models.map(async (model) => {
            const startTime = Date.now();
            try {
                const image = await generateImageFromModel({
                    modelId: model.id,
                    api: model.api,
                    prompt: prompt.prompt,
                    aspectRatio: "1:1",
                    provider: model.provider,
                });

                return {
                    modelId: model.id,
                    modelName: model.name,
                    provider: model.provider ?? "gateway",
                    success: true,
                    imageBase64: image.base64,
                    mimeType: image.mimeType,
                    durationMs: Date.now() - startTime,
                };
            } catch (error) {
                return {
                    modelId: model.id,
                    modelName: model.name,
                    provider: model.provider ?? "gateway",
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    durationMs: Date.now() - startTime,
                };
            }
        })
    );
}

// ============================================================================
// EVAL TASK
// ============================================================================

async function evaluatePrompt(prompt: TestPrompt): Promise<PromptEvalOutput> {
    console.log(`\n📸 Generating images for: ${prompt.id}`);

    // Generate images from all models
    const results = await generateImagesForPrompt(prompt, imageModels);

    // Filter successful generations for ranking
    const successfulImages: RankingCandidate[] = results
        .filter((r) => r.success && r.imageBase64)
        .map((r) => ({
            id: r.modelId,
            imageBase64: r.imageBase64!,
            mimeType: r.mimeType!,
        }));

    console.log(`   ✓ ${successfulImages.length}/${results.length} images generated`);

    // Batch rank successful images
    let rankingResult: Awaited<ReturnType<typeof batchRankImages>> | undefined;
    if (successfulImages.length > 0) {
        console.log(`   🏆 Ranking ${successfulImages.length} images...`);
        try {
            rankingResult = await batchRankImages(
                prompt.prompt,
                prompt.expectedStrengths,
                successfulImages
            );
            console.log(`   ✓ Ranking complete`);
        } catch (error) {
            console.error(
                `   ❌ Ranking failed: ${error instanceof Error ? error.message : error}`
            );
        }
    }

    // Build output with rankings mapped back to all models
    const rankings = results.map((r) => {
        const ranking = rankingResult?.rankings.find(
            (rank) => rank.modelId === r.modelId
        );

        return {
            modelId: r.modelId,
            modelName: r.modelName,
            provider: r.provider,
            rank: ranking?.rank ?? results.length, // Failed = last place
            normalizedScore: ranking?.normalizedScore ?? 0,
            notes: ranking?.notes,
            generationSuccess: r.success,
            generationError: r.error,
            durationMs: r.durationMs,
        };
    });

    // Sort by rank
    rankings.sort((a, b) => a.rank - b.rank);

    return {
        promptId: prompt.id,
        category: prompt.category,
        rankings,
        judgeReasoning: rankingResult?.judgeReasoning ?? "No successful generations",
        successCount: successfulImages.length,
        totalCount: results.length,
    };
}

// ============================================================================
// SCORING
// ============================================================================

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

function sanitizeKey(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

async function BatchRankingScorer({
    output,
}: {
    output: PromptEvalOutput;
}): Promise<Score[]> {
    const scores: Score[] = [];
    const category = output.category;

    // Generation success rate for this prompt
    scores.push({
        name: "generation_success",
        score: output.successCount / output.totalCount,
        metadata: {
            successCount: output.successCount,
            totalCount: output.totalCount,
            promptId: output.promptId,
        },
    });

    // Per-model scores
    for (const r of output.rankings) {
        const modelKey = sanitizeKey(r.modelName);

        // Normalized rank score (0-1)
        scores.push({
            name: `rank__${modelKey}`,
            score: r.normalizedScore / 100,
            metadata: {
                rank: r.rank,
                promptId: output.promptId,
                notes: r.notes,
            },
        });

        // Category × model (e.g., logos__flux_2_pro)
        scores.push({
            name: `${category}__${modelKey}`,
            score: r.normalizedScore / 100,
        });
    }

    // Average score for this category
    const avgScore =
        output.rankings.reduce((sum, r) => sum + r.normalizedScore, 0) /
        output.rankings.length /
        100;

    scores.push({
        name: `category__${category}`,
        score: avgScore,
    });

    return scores;
}

// ============================================================================
// BRAINTRUST EVAL
// ============================================================================

Eval("Image Generation", {
    experimentName: undefined, // Auto-generate

    data: async () => {
        return testPrompts.map((prompt) => ({
            input: prompt,
            tags: [prompt.category],
            metadata: {
                promptId: prompt.id,
                category: prompt.category,
                modelCount: imageModels.length,
            },
        }));
    },

    task: evaluatePrompt,

    scores: [BatchRankingScorer],

    metadata: {
        evalType: "batch-ranking",
        promptCount: testPrompts.length,
        modelCount: imageModels.length,
    },
});
