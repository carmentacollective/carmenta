/**
 * Approve All Extractions API
 *
 * POST - Approve all pending extractions at once
 */

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { approveAllExtractions } from "@/lib/import/extraction";
import { logger } from "@/lib/logger";

/**
 * POST /api/import/extract/approve-all
 *
 * Approve all pending extractions for the current user
 */
export async function POST() {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await approveAllExtractions();

        logger.info(
            { userId: user.id, approved: result.approved },
            "All extractions approved"
        );

        return NextResponse.json(result);
    } catch (error) {
        logger.error({ error }, "Failed to approve all extractions");
        return NextResponse.json(
            { error: "Failed to approve extractions" },
            { status: 500 }
        );
    }
}
