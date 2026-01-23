/**
 * Knowledge Base Documents API
 *
 * GET - List all documents, optionally filtered by modification time
 * Used for live KB tree view during import
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq, and, gte } from "drizzle-orm";

import { db, getOrCreateUser } from "@/lib/db";
import { documents } from "@/lib/db/schema";

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
 * GET - List KB documents
 *
 * Query params:
 * - since: ISO timestamp - only return documents updated after this time
 */
export async function GET(request: NextRequest) {
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sinceParam = searchParams.get("since");

    let whereCondition = eq(documents.userId, user.id);

    if (sinceParam) {
        const sinceDate = new Date(sinceParam);
        if (!isNaN(sinceDate.getTime())) {
            whereCondition = and(
                eq(documents.userId, user.id),
                gte(documents.updatedAt, sinceDate)
            )!;
        }
    }

    const docs = await db.query.documents.findMany({
        where: whereCondition,
        orderBy: (docs, { asc }) => [asc(docs.path)],
        columns: {
            id: true,
            path: true,
            name: true,
            content: true,
            description: true,
            sourceType: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return NextResponse.json({
        documents: docs,
        timestamp: new Date().toISOString(),
    });
}
