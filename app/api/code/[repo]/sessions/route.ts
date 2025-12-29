/**
 * Code Sessions API
 *
 * GET /api/code/[repo]/sessions - List sessions for a project
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { eq, and, desc, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections, messages } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/db/users";
import { encodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";

interface SessionWithPreview {
    id: string;
    slug: string;
    title: string | null;
    lastActivityAt: Date;
    messageCount: number;
    lastMessagePreview: string | null;
    isStreaming: boolean;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ repo: string }> }
) {
    const { repo } = await params;

    // Validate authentication
    const user = await currentUser();
    if (!user && process.env.NODE_ENV === "production") {
        return unauthorizedResponse();
    }

    try {
        const userEmail = user?.emailAddresses[0]?.emailAddress ?? "dev-user@local";
        const dbUser = await getOrCreateUser(user?.id ?? "dev-user-id", userEmail, {
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            displayName: user?.fullName ?? "Dev User",
            imageUrl: user?.imageUrl ?? null,
        });

        // Find all sessions for this project (connections with matching projectPath ending)
        // The repo slug is derived from the project path basename
        const allConnections = await db.query.connections.findMany({
            where: and(
                eq(connections.userId, dbUser.id),
                isNotNull(connections.projectPath)
            ),
            orderBy: [desc(connections.lastActivityAt)],
            columns: {
                id: true,
                slug: true,
                title: true,
                lastActivityAt: true,
                streamingStatus: true,
                projectPath: true,
            },
        });

        // Filter to connections whose project path ends with the repo slug
        const projectConnections = allConnections.filter((conn) => {
            if (!conn.projectPath) return false;
            const pathBasename = conn.projectPath.split("/").pop();
            return pathBasename === repo;
        });

        // Get message counts and previews for each connection
        const sessions: SessionWithPreview[] = await Promise.all(
            projectConnections.map(async (conn) => {
                // Get message count
                const messageList = await db.query.messages.findMany({
                    where: eq(messages.connectionId, conn.id),
                    orderBy: [desc(messages.createdAt)],
                    limit: 1,
                    columns: {
                        id: true,
                    },
                });

                // Get total count
                const allMessages = await db.query.messages.findMany({
                    where: eq(messages.connectionId, conn.id),
                    columns: { id: true },
                });

                // Get last user message for preview
                const lastUserMessage = await db.query.messages.findFirst({
                    where: and(
                        eq(messages.connectionId, conn.id),
                        eq(messages.role, "user")
                    ),
                    orderBy: [desc(messages.createdAt)],
                    with: {
                        parts: {
                            where: (parts, { eq }) => eq(parts.type, "text"),
                            limit: 1,
                        },
                    },
                });

                const preview = lastUserMessage?.parts?.[0]?.textContent as
                    | string
                    | null;

                return {
                    id: encodeConnectionId(conn.id),
                    slug: conn.slug,
                    title: conn.title,
                    lastActivityAt: conn.lastActivityAt,
                    messageCount: allMessages.length,
                    lastMessagePreview: preview?.slice(0, 100) ?? null,
                    isStreaming: conn.streamingStatus === "streaming",
                };
            })
        );

        logger.info(
            { repo, sessionCount: sessions.length, userId: dbUser.id },
            "Fetched code sessions for project"
        );

        return NextResponse.json({ sessions });
    } catch (error) {
        logger.error({ error, repo }, "Failed to fetch code sessions");
        return NextResponse.json(
            { error: "Failed to fetch sessions" },
            { status: 500 }
        );
    }
}
