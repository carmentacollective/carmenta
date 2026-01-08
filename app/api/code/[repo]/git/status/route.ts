/**
 * Git Status API - Uncommitted changes for session
 *
 * GET /api/code/[repo]/git/status - Get uncommitted changes with stats
 *
 * Returns file list with status (added/modified/deleted) and line counts.
 */

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { exec, execFile } from "child_process";
import { promisify } from "util";

import { logger } from "@/lib/logger";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api/responses";
import { getOrCreateUser } from "@/lib/db/users";
import {
    findProjectBySlug,
    getProject,
    isWorkspaceMode,
    validateUserProjectPath,
} from "@/lib/code/projects";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface FileChange {
    path: string;
    status: "added" | "modified" | "deleted";
    additions: number;
    deletions: number;
}

/**
 * Parse git status --porcelain output
 */
function parseGitStatus(
    output: string
): { path: string; status: "added" | "modified" | "deleted" }[] {
    const files: { path: string; status: "added" | "modified" | "deleted" }[] = [];

    for (const line of output.split("\n")) {
        if (!line.trim()) continue;

        const statusCode = line.slice(0, 2);
        const filePath = line.slice(3).trim();

        // Skip empty paths
        if (!filePath) continue;

        // Determine status from git status codes
        // First column = staged, second column = unstaged
        let status: "added" | "modified" | "deleted" = "modified";

        if (statusCode.includes("A") || statusCode.startsWith("?")) {
            status = "added";
        } else if (statusCode.includes("D")) {
            status = "deleted";
        }

        files.push({ path: filePath, status });
    }

    return files;
}

/**
 * Parse git diff --numstat output for line counts
 */
function parseDiffStats(
    output: string
): Record<string, { additions: number; deletions: number }> {
    const stats: Record<string, { additions: number; deletions: number }> = {};

    for (const line of output.split("\n")) {
        if (!line.trim()) continue;

        const parts = line.split("\t");
        if (parts.length < 3) continue;

        const [additionsStr, deletionsStr, filePath] = parts;

        // Handle binary files (shown as - -)
        const additions = additionsStr === "-" ? 0 : parseInt(additionsStr, 10);
        const deletions = deletionsStr === "-" ? 0 : parseInt(deletionsStr, 10);

        if (!isNaN(additions) && !isNaN(deletions) && filePath) {
            stats[filePath] = { additions, deletions };
        }
    }

    return stats;
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

        // Use path query param if provided (faster, avoids directory scan)
        // Fall back to slug lookup for backwards compatibility
        const pathParam = request.nextUrl.searchParams.get("path");
        const project = pathParam
            ? await getProject(pathParam)
            : await findProjectBySlug(repo);
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

        // Get git status - use execFile for consistency with security pattern
        const { stdout: statusOutput } = await execFileAsync(
            "git",
            ["status", "--porcelain"],
            {
                cwd: project.path,
                encoding: "utf-8",
            }
        );

        const files = parseGitStatus(statusOutput);

        // If no files changed, return early
        if (files.length === 0) {
            return NextResponse.json({
                files: [],
                totalAdditions: 0,
                totalDeletions: 0,
            });
        }

        // Get diff stats for all files (staged and unstaged)
        const { stdout: diffOutput } = await execFileAsync(
            "git",
            ["diff", "HEAD", "--numstat"],
            {
                cwd: project.path,
                encoding: "utf-8",
            }
        );

        const diffStats = parseDiffStats(diffOutput);

        // Also get stats for untracked files (count all lines as additions)
        const untrackedFiles = files.filter((f) => f.status === "added");
        for (const file of untrackedFiles) {
            if (!diffStats[file.path]) {
                try {
                    // Use execFile to prevent command injection - pass filename as argument
                    const { stdout } = await execFileAsync("wc", ["-l", file.path], {
                        cwd: project.path,
                        encoding: "utf-8",
                    });
                    // wc -l outputs "123 filename", extract the number
                    const lines = parseInt(stdout.trim().split(/\s+/)[0], 10);
                    if (!isNaN(lines)) {
                        diffStats[file.path] = { additions: lines, deletions: 0 };
                    }
                } catch {
                    // File might not exist or be binary
                    diffStats[file.path] = { additions: 0, deletions: 0 };
                }
            }
        }

        // Combine status and stats
        const filesWithStats: FileChange[] = files.map((file) => ({
            ...file,
            additions: diffStats[file.path]?.additions ?? 0,
            deletions: diffStats[file.path]?.deletions ?? 0,
        }));

        // Calculate totals
        let totalAdditions = 0;
        let totalDeletions = 0;
        for (const file of filesWithStats) {
            totalAdditions += file.additions;
            totalDeletions += file.deletions;
        }

        logger.info(
            { repo, fileCount: files.length, totalAdditions, totalDeletions },
            "Retrieved git status"
        );

        return NextResponse.json({
            files: filesWithStats,
            totalAdditions,
            totalDeletions,
        });
    } catch (error) {
        logger.error({ error, repo }, "Failed to get git status");
        Sentry.captureException(error, {
            tags: { component: "api", route: "/api/code/[repo]/git/status" },
            extra: { repo },
        });
        return NextResponse.json(
            { error: "Failed to get git status" },
            { status: 500 }
        );
    }
}
