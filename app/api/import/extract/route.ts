/**
 * Import Knowledge Extraction API
 *
 * POST - Start extraction job
 * GET - Get extraction stats and pending extractions
 */

import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getOrCreateUser } from "@/lib/db";
import {
    createExtractionJob,
    processExtractionJob,
    getUnprocessedImports,
    getPendingExtractions,
    getExtractionStats,
} from "@/lib/import/extraction";
import { logger } from "@/lib/logger";

/**
 * Get the database user for the current request
 */
async function getDbUser() {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
        return null;
    }

    return getOrCreateUser(user.id, email, {
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
    });
}

/**
 * GET /api/import/extract
 *
 * Returns extraction stats and pending extractions
 */
export async function GET(request: NextRequest) {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Validate query parameters
    const querySchema = z.object({
        status: z.enum(["pending", "approved", "rejected", "edited"]).optional(),
        category: z
            .enum([
                "identity",
                "preference",
                "person",
                "project",
                "decision",
                "expertise",
            ])
            .optional(),
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0),
    });

    const parsed = querySchema.safeParse({
        status: searchParams.get("status") ?? undefined,
        category: searchParams.get("category") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
        offset: searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid query parameters" },
            { status: 400 }
        );
    }

    const { status, category, limit, offset } = parsed.data;

    try {
        const [extractions, stats, unprocessed] = await Promise.all([
            getPendingExtractions(dbUser.id, {
                status,
                category,
                limit,
                offset,
            }),
            getExtractionStats(dbUser.id),
            getUnprocessedImports(dbUser.id, 1),
        ]);

        return NextResponse.json({
            extractions: extractions.extractions,
            total: extractions.total,
            stats,
            hasUnprocessedImports: unprocessed.length > 0,
        });
    } catch (error) {
        logger.error({ error }, "Failed to get extractions");
        return NextResponse.json(
            { error: "Failed to get extractions" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/import/extract
 *
 * Starts a new extraction job
 */
export async function POST(request: NextRequest) {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));

        // Validate request body
        const bodySchema = z.object({
            connectionIds: z.array(z.number()).optional(),
        });

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request body" },
                { status: 400 }
            );
        }

        const { connectionIds } = parsed.data;

        // Check if there are imports to process
        const unprocessed = await getUnprocessedImports(dbUser.id, 1000);

        if (unprocessed.length === 0 && !connectionIds) {
            return NextResponse.json({
                jobId: null,
                message: "No unprocessed imports to extract from",
                conversationCount: 0,
            });
        }

        // Create the job
        const jobId = await createExtractionJob(dbUser.id, connectionIds);

        // Start processing in background (fire-and-forget)
        // In production, this would be a queue/worker
        processExtractionJob(jobId).catch((error) => {
            logger.error({ error, jobId }, "Background extraction job failed");
            Sentry.captureException(error, {
                tags: { category: "extraction", phase: "background-spawn" },
                extra: { jobId },
            });
        });

        return NextResponse.json({
            jobId,
            message: "Extraction started",
            conversationCount: connectionIds?.length ?? unprocessed.length,
        });
    } catch (error) {
        logger.error({ error }, "Failed to start extraction");
        return NextResponse.json(
            { error: "Failed to start extraction" },
            { status: 500 }
        );
    }
}
