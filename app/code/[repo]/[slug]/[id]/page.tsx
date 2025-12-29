/**
 * Code Session Page
 *
 * The actual code chat interface for a specific session.
 *
 * URL: /code/[repo]/[slug]/[id]
 * Example: /code/carmenta-code/fix-auth-bug/abc123
 *
 * Special cases:
 * - /code/[repo]/_/new - New session (ephemeral, creates on first message)
 * - /code/[repo]/_/[id] - Session with placeholder slug (pre-auto-title)
 */

import { redirect, notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { eq, and, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { decodeConnectionId, encodeConnectionId } from "@/lib/sqids";
import { getOrCreateUser } from "@/lib/db/users";
import { logger } from "@/lib/logger";

// Import the existing connection page content
import ConnectionPage from "@/app/connection/[slug]/[id]/page";

interface PageProps {
    params: Promise<{
        repo: string;
        slug: string;
        id: string;
    }>;
}

export default async function CodeSessionPage({ params }: PageProps) {
    const { repo, slug, id } = await params;

    // Handle "new" session - redirect to create flow
    if (id === "new") {
        // This is handled client-side - the session will be created on first message
        // For now, render the connection page in "new session" mode
        return <NewSessionPage repo={repo} />;
    }

    // Decode the session ID
    const connectionId = decodeConnectionId(id);
    if (!connectionId) {
        logger.warn({ id, repo }, "Invalid session ID");
        notFound();
    }

    // Get the connection
    const connection = await db.query.connections.findFirst({
        where: eq(connections.id, connectionId),
    });

    if (!connection) {
        logger.warn({ connectionId, repo }, "Session not found");
        notFound();
    }

    // Verify this connection belongs to the repo
    if (connection.projectPath) {
        const pathBasename = connection.projectPath.split("/").pop();
        if (pathBasename !== repo) {
            logger.warn(
                { connectionId, repo, actualRepo: pathBasename },
                "Session does not belong to this repo"
            );
            notFound();
        }
    }

    // Check if slug needs correction (redirect if wrong)
    if (slug !== "_" && connection.slug && connection.slug !== slug) {
        const correctUrl = `/code/${repo}/${connection.slug}/${id}`;
        logger.info(
            { from: slug, to: connection.slug, connectionId },
            "Redirecting to correct slug"
        );
        redirect(correctUrl);
    }

    // If session has a real slug but URL uses placeholder, redirect
    if (
        slug === "_" &&
        connection.slug &&
        connection.slug !== "_" &&
        connection.title
    ) {
        const correctUrl = `/code/${repo}/${connection.slug}/${id}`;
        redirect(correctUrl);
    }

    // Render the connection page with code mode context
    // Pass through to the existing connection infrastructure
    return <ConnectionPage params={Promise.resolve({ slug: connection.slug, id })} />;
}

/**
 * New Session Page - Ephemeral state before first message
 */
function NewSessionPage({ repo }: { repo: string }) {
    // This renders the chat interface in "new session" mode
    // The session will be created when the user sends their first message
    return (
        <ConnectionPage
            params={Promise.resolve({ slug: "_", id: "new" })}
            // @ts-expect-error - Adding code mode context
            codeMode={{ repo, isNew: true }}
        />
    );
}
