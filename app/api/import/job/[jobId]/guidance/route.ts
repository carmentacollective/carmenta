/**
 * API endpoint for managing user guidance on import jobs
 *
 * POST - Add a guidance note
 * DELETE - Remove a guidance note
 * GET - Get all guidance notes
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db, getOrCreateUser } from "@/lib/db";
import { extractionJobs } from "@/lib/db/schema";
import { logger } from "@/lib/client-logger";

interface RouteParams {
    params: Promise<{ jobId: string }>;
}

/**
 * Get the database user from Clerk auth
 */
async function getDbUser() {
    const clerkUser = await currentUser();
    if (!clerkUser?.primaryEmailAddress?.emailAddress) {
        return null;
    }

    return getOrCreateUser(clerkUser.id, clerkUser.primaryEmailAddress.emailAddress, {
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        displayName: clerkUser.fullName ?? null,
        imageUrl: clerkUser.imageUrl ?? null,
    });
}

/**
 * GET - Get all guidance notes for a job
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { jobId } = await params;
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await db.query.extractionJobs.findFirst({
        where: eq(extractionJobs.id, jobId),
        columns: { userId: true, userGuidance: true },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
        guidance: (job.userGuidance as string[]) ?? [],
    });
}

/**
 * POST - Add a guidance note to the job
 *
 * Body: { note: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { jobId } = await params;
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { note } = body as { note?: string };

    if (!note || typeof note !== "string" || note.trim().length === 0) {
        return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    // Verify job ownership
    const job = await db.query.extractionJobs.findFirst({
        where: eq(extractionJobs.id, jobId),
        columns: { userId: true, userGuidance: true },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Append the note to the guidance array
    const currentGuidance = (job.userGuidance as string[]) ?? [];
    const newGuidance = [...currentGuidance, note.trim()];

    await db
        .update(extractionJobs)
        .set({ userGuidance: newGuidance })
        .where(eq(extractionJobs.id, jobId));

    logger.info({ jobId, noteCount: newGuidance.length }, "Added guidance note");

    return NextResponse.json({
        success: true,
        guidance: newGuidance,
    });
}

/**
 * DELETE - Remove a guidance note by index
 *
 * Body: { index: number }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { jobId } = await params;
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { index } = body as { index?: number };

    if (typeof index !== "number" || index < 0) {
        return NextResponse.json({ error: "Valid index is required" }, { status: 400 });
    }

    // Verify job ownership
    const job = await db.query.extractionJobs.findFirst({
        where: eq(extractionJobs.id, jobId),
        columns: { userId: true, userGuidance: true },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Remove the note at the given index
    const currentGuidance = (job.userGuidance as string[]) ?? [];

    if (index >= currentGuidance.length) {
        return NextResponse.json({ error: "Index out of bounds" }, { status: 400 });
    }

    const newGuidance = currentGuidance.filter((_, i) => i !== index);

    await db
        .update(extractionJobs)
        .set({ userGuidance: newGuidance })
        .where(eq(extractionJobs.id, jobId));

    logger.info({ jobId, removedIndex: index }, "Removed guidance note");

    return NextResponse.json({
        success: true,
        guidance: newGuidance,
    });
}
