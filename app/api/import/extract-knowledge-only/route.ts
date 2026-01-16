/**
 * Knowledge-Only Extraction API
 *
 * Extracts knowledge from conversations WITHOUT importing them as permanent connections.
 * This creates temporary imports, runs extraction, then marks them for cleanup.
 *
 * POST - Start knowledge-only extraction
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getOrCreateUser } from "@/lib/db";
import { commitImport } from "@/lib/actions/import";
import { createExtractionJob } from "@/lib/import/extraction";
import { logger } from "@/lib/logger";
import {
    isBackgroundModeEnabled,
    startImportLibrarianWorkflow,
} from "@/lib/temporal/client";

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

// Message schema matching ConversationForImport
const messageSchema = z.object({
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string(),
    createdAt: z.string().nullable(), // Some exports have null timestamps
});

const conversationSchema = z.object({
    id: z.string(),
    title: z.string(),
    messageCount: z.number(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    model: z.string().nullable().optional(),
    messages: z.array(messageSchema),
});

/**
 * POST /api/import/extract-knowledge-only
 *
 * Extracts knowledge from conversations without creating permanent connections.
 * The conversations are temporarily imported, extracted, then can be cleaned up.
 */
export async function POST(request: NextRequest) {
    // Check if background mode is available
    if (!isBackgroundModeEnabled()) {
        return NextResponse.json(
            { error: "Extraction service is temporarily unavailable" },
            { status: 503 }
        );
    }

    const dbUser = await getDbUser();

    if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();

        // Validate request body
        const bodySchema = z.object({
            conversations: z.array(conversationSchema),
            provider: z.enum(["chatgpt", "anthropic"]),
        });

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            logger.warn(
                { errors: parsed.error.errors },
                "Invalid knowledge-only extraction request"
            );
            return NextResponse.json(
                { error: "Invalid request body" },
                { status: 400 }
            );
        }

        const { conversations, provider } = parsed.data;

        if (conversations.length === 0) {
            return NextResponse.json(
                { error: "No conversations provided" },
                { status: 400 }
            );
        }

        // Import conversations (creates connections)
        // TODO (see issue #804): Add knowledgeOnly flag to connections schema to mark
        // these as temporary. For now, connections remain after extraction completes.
        // Proper fix requires:
        // 1. Migration adding `knowledgeOnly: boolean` to connections table
        // 2. Filter knowledgeOnly connections from /connections page
        // 3. Optional: Cleanup job to delete knowledgeOnly connections after N days
        const importResult = await commitImport(
            conversations as Parameters<typeof commitImport>[0],
            provider,
            null // no user settings for knowledge-only
        );

        if (!importResult.success || importResult.connectionIds.length === 0) {
            return NextResponse.json(
                { error: importResult.errors[0] || "Failed to process conversations" },
                { status: 500 }
            );
        }

        // Create the extraction job
        const jobId = await createExtractionJob(dbUser.id, importResult.connectionIds);

        // Start Temporal workflow for extraction
        try {
            await startImportLibrarianWorkflow({
                jobId,
                userId: dbUser.id,
                connectionIds: importResult.connectionIds,
            });
        } catch (temporalError) {
            logger.error(
                { error: temporalError, jobId },
                "Failed to dispatch knowledge extraction workflow"
            );
            return NextResponse.json(
                { error: "Failed to start extraction" },
                { status: 503 }
            );
        }

        logger.info(
            {
                jobId,
                conversationCount: importResult.connectionsCreated,
                provider,
                mode: "knowledge-only",
            },
            "Knowledge-only extraction started"
        );

        return NextResponse.json({
            jobId,
            message: "Knowledge extraction started",
            conversationCount: importResult.connectionsCreated,
            connectionIds: importResult.connectionIds, // For potential cleanup
        });
    } catch (error) {
        logger.error({ error }, "Failed to start knowledge-only extraction");
        return NextResponse.json(
            { error: "Failed to start extraction" },
            { status: 500 }
        );
    }
}
