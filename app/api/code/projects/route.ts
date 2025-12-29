/**
 * API Route: Code Projects
 *
 * Discovers and lists available projects for code mode.
 */

import { NextResponse } from "next/server";

import { discoverProjects, getProject } from "@/lib/code";
import { logger } from "@/lib/logger";

/**
 * GET /api/code/projects
 *
 * List all available projects in the configured source directories.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectPath = searchParams.get("path");

        // If a specific path is requested, get that project
        if (projectPath) {
            const project = await getProject(projectPath);
            if (!project) {
                return NextResponse.json(
                    { error: "Project not found" },
                    { status: 404 }
                );
            }
            return NextResponse.json({ project });
        }

        // Otherwise, discover all projects
        const projects = await discoverProjects();

        logger.info({ count: projects.length }, "Projects API: listed projects");

        return NextResponse.json({
            projects,
            sourceDirs: [
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
