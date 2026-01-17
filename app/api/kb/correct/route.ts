/**
 * KB Correction API
 *
 * POST - Send a correction to the librarian for a specific document
 * The librarian will process the correction and update the KB
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { getOrCreateUser } from "@/lib/db";
import { kb } from "@/lib/kb";
import { createLibrarianAgent } from "@/lib/ai-team/librarian";
import { logger } from "@/lib/client-logger";

interface CorrectionRequest {
    path: string;
    correction: string;
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
 * POST - Send a correction to the librarian
 *
 * Body: { path: string, correction: string }
 *
 * The librarian will read the current document and apply the correction.
 */
export async function POST(request: NextRequest) {
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { path, correction } = body as CorrectionRequest;

    if (!path || typeof path !== "string") {
        return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    if (
        !correction ||
        typeof correction !== "string" ||
        correction.trim().length === 0
    ) {
        return NextResponse.json({ error: "Correction is required" }, { status: 400 });
    }

    // Get the current document
    const doc = await kb.read(user.id, path);

    if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    logger.info({ path, userId: user.id }, "Processing KB correction");

    try {
        // Call the librarian to process the correction
        const agent = createLibrarianAgent();

        const result = await agent.generate({
            prompt: `<user-id>${user.id}</user-id>

<correction-context>
The user is viewing their knowledge base and has provided a correction for an existing document.
</correction-context>

<document path="${path}">
${doc.content}
</document>

<user-correction>
${correction.trim()}
</user-correction>

The user has provided a correction for the document above. Please:
1. Read the current document at "${path}"
2. Apply the user's correction appropriately - this might mean updating the content, deleting incorrect information, or making other changes
3. Use updateDocument to save the corrected version

If the correction suggests deleting the document entirely, explain that to the user via notifyUser instead of deleting it (let them confirm first).`,
        });

        logger.info(
            { path, userId: user.id, stepsUsed: result.steps.length },
            "KB correction processed"
        );

        // Fetch the updated document
        const updatedDoc = await kb.read(user.id, path);

        return NextResponse.json({
            success: true,
            document: updatedDoc,
            summary: result.text,
        });
    } catch (error) {
        logger.error({ error, path, userId: user.id }, "Failed to process correction");
        return NextResponse.json(
            { error: "Failed to process correction" },
            { status: 500 }
        );
    }
}
