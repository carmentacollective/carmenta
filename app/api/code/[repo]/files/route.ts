/**
 * File Explorer API - Directory Listing
 *
 * GET /api/code/[repo]/files?path=/ - List directory contents
 *
 * Returns files and directories at the specified path within a project.
 * Respects .gitignore patterns and hides sensitive files.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import { logger } from "@/lib/logger";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api/responses";
import { getOrCreateUser } from "@/lib/db/users";
import {
    findProjectBySlug,
    isWorkspaceMode,
    validateUserProjectPath,
} from "@/lib/code/projects";

/**
 * File entry returned by the API
 */
export interface FileEntry {
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
    modifiedAt?: string;
    extension?: string;
}

/**
 * Directories to always hide from file explorer
 */
const HIDDEN_DIRS = new Set([
    ".git",
    "node_modules",
    ".next",
    ".turbo",
    ".vercel",
    "__pycache__",
    ".venv",
    "venv",
    ".cache",
    "coverage",
    "dist",
    ".DS_Store",
]);

/**
 * Files to always hide (sensitive or not useful)
 */
const HIDDEN_FILES = new Set([
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
    ".npmrc",
    ".yarnrc",
    "credentials.json",
    "secrets.json",
]);

/**
 * Check if a file/directory should be hidden
 */
function shouldHide(name: string): boolean {
    // Hidden directories
    if (HIDDEN_DIRS.has(name)) return true;

    // Hidden files
    if (HIDDEN_FILES.has(name)) return true;

    // Hidden dotfiles (except some useful ones)
    const allowedDotfiles = new Set([
        ".gitignore",
        ".prettierrc",
        ".eslintrc",
        ".eslintrc.json",
        ".eslintrc.js",
        ".prettierrc.json",
        ".prettierrc.js",
        ".editorconfig",
    ]);
    if (name.startsWith(".") && !allowedDotfiles.has(name)) return true;

    return false;
}

/**
 * Validate that a path is within the project (prevent traversal)
 */
function isPathWithinProject(projectPath: string, targetPath: string): boolean {
    const normalizedProject = path.resolve(projectPath);
    const normalizedTarget = path.resolve(projectPath, targetPath);
    return normalizedTarget.startsWith(normalizedProject);
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
        await getOrCreateUser(user?.id ?? "dev-user-id", userEmail, {
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            displayName: user?.fullName ?? "Dev User",
            imageUrl: user?.imageUrl ?? null,
        });

        // Parse query params
        const { searchParams } = new URL(request.url);
        const relativePath = searchParams.get("path") ?? "/";

        // Find project by repo slug
        const project = await findProjectBySlug(repo);
        if (!project) {
            return notFoundResponse("project");
        }

        // Validate in workspace mode if needed
        if (isWorkspaceMode() && userEmail) {
            const isValid = await validateUserProjectPath(userEmail, project.path);
            if (!isValid) {
                return unauthorizedResponse();
            }
        }

        // Validate path is within project (prevent traversal)
        if (!isPathWithinProject(project.path, relativePath)) {
            logger.warn(
                { repo, relativePath, projectPath: project.path },
                "Path traversal attempt blocked"
            );
            return new Response(JSON.stringify({ error: "Invalid path" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const absolutePath = path.resolve(project.path, relativePath);

        // Check path exists and is a directory
        let stat;
        try {
            stat = await fs.stat(absolutePath);
        } catch {
            return notFoundResponse("directory");
        }

        if (!stat.isDirectory()) {
            return new Response(JSON.stringify({ error: "Path is not a directory" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Read directory contents
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });

        // Filter hidden entries first
        const visibleEntries = entries.filter((entry) => !shouldHide(entry.name));

        // Parallelize stat calls for better performance with large directories
        const statResults = await Promise.all(
            visibleEntries.map(async (entry) => {
                const entryPath = path.join(relativePath, entry.name);
                const fullPath = path.join(absolutePath, entry.name);

                try {
                    const entryStat = await fs.stat(fullPath);
                    return { entry, entryPath, entryStat };
                } catch {
                    return null;
                }
            })
        );

        // Build file entries from successful stats
        const files: FileEntry[] = statResults
            .filter((result): result is NonNullable<typeof result> => result !== null)
            .map(({ entry, entryPath, entryStat }) => {
                const fileEntry: FileEntry = {
                    name: entry.name,
                    path: entryPath.startsWith("/") ? entryPath : `/${entryPath}`,
                    type: entry.isDirectory() ? "directory" : "file",
                    modifiedAt: entryStat.mtime.toISOString(),
                };

                if (!entry.isDirectory()) {
                    fileEntry.size = entryStat.size;
                    fileEntry.extension = path
                        .extname(entry.name)
                        .slice(1)
                        .toLowerCase();
                }

                return fileEntry;
            });

        // Sort: directories first, then alphabetically
        files.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        logger.info(
            { repo, path: relativePath, fileCount: files.length },
            "Listed directory contents"
        );

        return NextResponse.json({
            files,
            path: relativePath,
            projectPath: project.path,
        });
    } catch (error) {
        logger.error({ error, repo }, "Failed to list files");
        return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
    }
}
