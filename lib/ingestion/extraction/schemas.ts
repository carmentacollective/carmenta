/**
 * Zod schemas for LLM structured output
 */

import { z } from "zod";

export const preExtractionSchema = z.object({
    people: z
        .array(z.string())
        .describe("Names of people mentioned (proper names, not roles)"),
    projects: z.array(z.string()).describe("Project names or product names mentioned"),
    topics: z
        .array(z.string())
        .describe(
            "Technical topics, technologies, or concepts mentioned (e.g., PostgreSQL, JWT, authentication)"
        ),
});

export const extractedEntitiesSchema = z.object({
    people: z.array(z.string()),
    projects: z.array(z.string()),
    organizations: z.array(z.string()),
    technologies: z.array(z.string()),
    locations: z.array(z.string()),
    dates: z.array(z.string()),
    primaryEntity: z.string().describe("The main subject of this content"),
    primaryEntityType: z.enum([
        "person",
        "project",
        "organization",
        "technology",
        "topic",
    ]),
});

export const criteriaEvaluationSchema = z.object({
    durability: z.object({
        met: z.boolean(),
        reason: z.string(),
    }),
    uniqueness: z.object({
        met: z.boolean(),
        reason: z.string(),
    }),
    retrievability: z.object({
        met: z.boolean(),
        reason: z.string(),
    }),
    authority: z.object({
        met: z.boolean(),
        reason: z.string(),
    }),
    criteriaMet: z
        .number()
        .min(0)
        .max(4)
        .describe("Count of criteria that were met (0-4)"),
    shouldIngest: z.boolean().describe("Whether content meets threshold for ingestion"),
});

export const ingestableItemSchema = z.object({
    content: z.string().describe("The atomic fact to store (transformed from raw)"),
    summary: z
        .string()
        .describe("One-line description for search results and quick scanning"),
    category: z.enum([
        "preference",
        "identity",
        "relationship",
        "project",
        "decision",
        "reference",
        "meeting",
        "insight",
    ]),
    entities: extractedEntitiesSchema,
    confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Confidence that this should be stored (0-1)"),
});

export const conflictDetectionSchema = z.object({
    newFact: z.string(),
    existingPath: z.string(),
    existingFact: z.string(),
    recommendation: z.enum(["update", "merge", "flag", "skip"]),
    reasoning: z.string(),
});

export const ingestionResultSchema = z.object({
    shouldIngest: z.boolean().describe("Whether any content should be stored"),
    reasoning: z.string().describe("Overall reasoning for ingestion decision"),

    criteria: criteriaEvaluationSchema,

    items: z
        .array(ingestableItemSchema)
        .describe("Items to ingest if shouldIngest is true"),

    conflicts: z
        .array(conflictDetectionSchema)
        .describe("Detected conflicts with existing knowledge"),
});
