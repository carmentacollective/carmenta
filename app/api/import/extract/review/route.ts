/**
 * Extraction Review API
 *
 * POST - Review extractions (approve, reject, edit)
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getOrCreateUser } from "@/lib/db";
import { reviewExtractions } from "@/lib/import/extraction";
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
 * POST /api/import/extract/review
 *
 * Review extractions - approve, reject, or edit
 */
export async function POST(request: NextRequest) {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();

        // Validate request body
        const actionSchema = z.object({
            id: z.string().uuid(),
            action: z.enum(["approve", "reject", "edit"]),
            editedContent: z.string().optional(),
        });

        const bodySchema = z.object({
            actions: z.array(actionSchema).min(1),
        });

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const result = await reviewExtractions(parsed.data.actions);

        return NextResponse.json(result);
    } catch (error) {
        logger.error({ error }, "Failed to review extractions");
        return NextResponse.json(
            { error: "Failed to review extractions" },
            { status: 500 }
        );
    }
}
