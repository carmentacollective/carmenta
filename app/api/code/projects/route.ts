/**
 * API Route: Code Projects
 *
 * Discovers and lists available projects for code mode.
 *
 * Two modes:
 * - Workspace mode (DATA_DIR set): Lists user-isolated workspaces from persistent disk
 * - Local mode (no DATA_DIR): Scans CODE_SOURCE_DIR or ~/src for git repos
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
    discoverProjects,
    discoverUserProjects,
    getProject,
    getUserProject,
    isWorkspaceMode,
    validateUserProjectPath,
} from "@/lib/code";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";

/**
 * GET /api/code/projects
 *
 * List all available projects for the current user.
 * In workspace mode, returns user-isolated workspaces.
 * In local mode, scans configured source directories.
 */
export async function GET(req: Request) {
    const user = await currentUser();
    const userEmail = user?.emailAddresses[0]?.emailAddress;

    // Require authentication in production
    if (!user && process.env.NODE_ENV === "production") {
        return unauthorizedResponse();
    }

    try {
        const { searchParams } = new URL(req.url);
        const projectPath = searchParams.get("path");
        const owner = searchParams.get("owner");
        const repo = searchParams.get("repo");

        // If owner/repo specified, get that specific workspace (workspace mode)
        if (owner && repo && userEmail && isWorkspaceMode()) {
            const project = await getUserProject(userEmail, owner, repo);
            if (!project) {
                return NextResponse.json(
                    { error: "Project not found" },
                    { status: 404 }
                );
            }
            return NextResponse.json({ project });
        }

        // If a specific path is requested, get that project
        if (projectPath) {
            // In workspace mode, validate the path is within user's workspace
            if (isWorkspaceMode() && userEmail) {
                const isValid = await validateUserProjectPath(userEmail, projectPath);
                if (!isValid) {
                    return NextResponse.json(
                        { error: "Project not found" },
                        { status: 404 }
                    );
                }
            }

            const project = await getProject(projectPath);
            if (!project) {
                return NextResponse.json(
                    { error: "Project not found" },
                    { status: 404 }
                );
            }
            return NextResponse.json({ project });
        }

        // Discover projects based on mode
        const workspaceMode = isWorkspaceMode();
        const projects =
            workspaceMode && userEmail
                ? await discoverUserProjects(userEmail)
                : await discoverProjects();

        logger.info(
            { count: projects.length, workspaceMode, hasUser: !!userEmail },
            "Projects API: listed projects"
        );

        return NextResponse.json({
            projects,
            workspaceMode,
            // Only include source dirs in local mode
            sourceDirs: workspaceMode
                ? undefined
                : [
                      process.env.CODE_SOURCE_DIR,
                      process.env.HOME ? `${process.env.HOME}/src` : null,
                  ].filter(Boolean),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error({ error: message }, "Projects API: failed to list projects");

        return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
    }
}
