/**
 * File Explorer API - File Content
 *
 * GET /api/code/[repo]/files/content?path=/src/index.ts - Get file content
 *
 * Returns the content of a file for preview in the file explorer.
 * Includes metadata like line count and whether it's a text file.
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
 * Maximum file size to read (1MB)
 */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Maximum lines to return for preview
 */
const MAX_PREVIEW_LINES = 500;

/**
 * Binary file extensions that shouldn't be previewed
 */
const BINARY_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "ico",
    "svg",
    "pdf",
    "zip",
    "tar",
    "gz",
    "rar",
    "7z",
    "exe",
    "dll",
    "so",
    "dylib",
    "woff",
    "woff2",
    "ttf",
    "otf",
    "eot",
    "mp3",
    "mp4",
    "wav",
    "avi",
    "mov",
    "webm",
]);

/**
 * Validate that a path is within the project (prevent traversal)
 */
function isPathWithinProject(projectPath: string, targetPath: string): boolean {
    const normalizedProject = path.resolve(projectPath);
    // Strip leading slash to ensure path.resolve treats it as relative
    const safeTarget = targetPath.replace(/^\/+/, "") || ".";
    const normalizedTarget = path.resolve(projectPath, safeTarget);
    // Ensure target starts with project + path separator to prevent sibling directory bypass
    return (
        normalizedTarget === normalizedProject ||
        normalizedTarget.startsWith(normalizedProject + path.sep)
    );
}

/**
 * Check if content appears to be binary
 */
function isBinaryContent(buffer: Buffer): boolean {
    // Check for null bytes in first 8KB (common binary indicator)
    const checkLength = Math.min(buffer.length, 8192);
    for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) return true;
    }
    return false;
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
        const filePath = searchParams.get("path");

        if (!filePath) {
            return new Response(JSON.stringify({ error: "Path is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

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
        if (!isPathWithinProject(project.path, filePath)) {
            logger.warn(
                { repo, filePath, projectPath: project.path },
                "Path traversal attempt blocked"
            );
            return new Response(JSON.stringify({ error: "Invalid path" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Normalize path for actual file operations (same as security check)
        const safePath = filePath.replace(/^\/+/, "") || ".";
        const absolutePath = path.resolve(project.path, safePath);

        // Check file exists
        let stat;
        try {
            stat = await fs.stat(absolutePath);
        } catch {
            return notFoundResponse("file");
        }

        if (stat.isDirectory()) {
            return new Response(JSON.stringify({ error: "Path is a directory" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Check file extension for known binary types
        const extension = path.extname(absolutePath).slice(1).toLowerCase();
        if (BINARY_EXTENSIONS.has(extension)) {
            return NextResponse.json({
                content: null,
                isBinary: true,
                extension,
                size: stat.size,
                lineCount: 0,
                truncated: false,
                message: `Binary file (${extension}) - preview not available`,
            });
        }

        // Check file size
        if (stat.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                content: null,
                isBinary: false,
                extension,
                size: stat.size,
                lineCount: 0,
                truncated: true,
                message: `File too large to preview (${Math.round(stat.size / 1024)}KB)`,
            });
        }

        // Read file content
        const buffer = await fs.readFile(absolutePath);

        // Check if binary by content
        if (isBinaryContent(buffer)) {
            return NextResponse.json({
                content: null,
                isBinary: true,
                extension,
                size: stat.size,
                lineCount: 0,
                truncated: false,
                message: "Binary file - preview not available",
            });
        }

        const content = buffer.toString("utf-8");
        const lines = content.split("\n");
        const totalLines = lines.length;

        // Truncate if too many lines
        const truncated = totalLines > MAX_PREVIEW_LINES;
        const previewContent = truncated
            ? lines.slice(0, MAX_PREVIEW_LINES).join("\n")
            : content;

        logger.info({ repo, filePath, lineCount: totalLines }, "Read file content");

        return NextResponse.json({
            content: previewContent,
            isBinary: false,
            extension,
            size: stat.size,
            lineCount: totalLines,
            truncated,
            message: truncated
                ? `Showing first ${MAX_PREVIEW_LINES} of ${totalLines} lines`
                : null,
        });
    } catch (error) {
        logger.error({ error, repo }, "Failed to read file content");
        return NextResponse.json(
            { error: "Failed to read file content" },
            { status: 500 }
        );
    }
}
