/**
 * Code Mode Connection API
 *
 * Creates a new connection with projectPath set for code mode.
 * Returns the connection ID and slug for navigation.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/db/users";
import { validateProject } from "@/lib/code";
import { generateSlug, encodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";

/**
 * Request body schema
 */
const requestSchema = z.object({
    projectPath: z.string().min(1, "Project path is required"),
    projectName: z.string().optional(),
});

export async function POST(request: Request) {
    // Validate authentication in production
    const user = await currentUser();
    if (!user && process.env.NODE_ENV === "production") {
        return unauthorizedResponse();
    }

    // Parse and validate request body
    let body: z.infer<typeof requestSchema>;
    try {
        body = requestSchema.parse(await request.json());
    } catch (error) {
        const message =
            error instanceof z.ZodError
                ? error.issues
                      .map((e) => `${e.path.join(".")}: ${e.message}`)
                      .join(", ")
                : "Invalid request body";

        logger.warn({ error: message }, "Code connection: validation failed");

        return NextResponse.json({ error: message }, { status: 400 });
    }

    // Validate project path exists
    const isValid = await validateProject(body.projectPath);
    if (!isValid) {
        return NextResponse.json({ error: "Invalid project path" }, { status: 400 });
    }

    try {
        // Use Clerk user if authenticated, fall back to dev user
        const userEmail = user?.emailAddresses[0]?.emailAddress ?? "dev-user@local";

        const dbUser = await getOrCreateUser(user?.id ?? "dev-user-id", userEmail, {
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            displayName: user?.fullName ?? "Dev User",
            imageUrl: user?.imageUrl ?? null,
        });

        // Generate a title and slug from project name
        const title = body.projectName ? `Code: ${body.projectName}` : "Code Session";
        const slug = generateSlug(title);

        // Create connection with projectPath
        const [connection] = await db
            .insert(connections)
            .values({
                userId: dbUser.id,
                title,
                slug,
                projectPath: body.projectPath,
                status: "active",
                streamingStatus: "idle",
            })
            .returning({ id: connections.id, slug: connections.slug });

        const publicId = encodeConnectionId(connection.id);

        logger.info(
            { connectionId: connection.id, projectPath: body.projectPath, slug },
            "Created code-mode connection"
        );

        return NextResponse.json({
            id: publicId,
            slug: connection.slug,
        });
    } catch (error) {
        logger.error({ error }, "Failed to create code-mode connection");
        return NextResponse.json(
            { error: "Failed to create session" },
            { status: 500 }
        );
    }
}
