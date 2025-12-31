/**
 * Workspace Management for Multi-User Code Mode
 *
 * Handles user-isolated workspaces on persistent disk storage.
 * Each user gets their own directory: /data/workspaces/{userId}/{owner}__{repo}/
 *
 * Security model:
 * - Paths are always built from database-controlled values
 * - Every operation validates userId ownership
 * - Path traversal is prevented via sanitization and validation
 * - Symlinks are rejected
 */

import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

import { logger } from "@/lib/logger";

const execFileAsync = promisify(execFile);

/**
 * A workspace is just a git repo in the user's directory
 */
export interface Workspace {
    owner: string;
    repo: string;
    fullName: string;
    path: string;
}

/**
 * Get the base data directory from environment
 */
export function getDataDir(): string {
    return process.env.DATA_DIR ?? "/data";
}

/**
 * Get the workspaces directory
 */
export function getWorkspacesDir(): string {
    return path.join(getDataDir(), "workspaces");
}

/**
 * Sanitize repo owner/name to prevent path traversal
 * Only allows alphanumeric, dash, underscore
 */
export function sanitizeRepoName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, "_");
}

/**
 * Build the directory name for a workspace
 * Format: {owner}__{repo} with sanitized names
 * Uses double underscore to prevent collisions (e.g., "a/b_c" vs "a_b/c")
 */
export function buildWorkspaceDirName(owner: string, repo: string): string {
    return `${sanitizeRepoName(owner)}__${sanitizeRepoName(repo)}`;
}

/**
 * Parse owner and repo from directory name
 */
export function parseWorkspaceDirName(dirName: string): {
    owner: string;
    repo: string;
} {
    const [owner, ...repoParts] = dirName.split("__");
    const repo = repoParts.join("__");
    return {
        owner: owner || "unknown",
        repo: repo || dirName,
    };
}

/**
 * Build the full filesystem path for a workspace
 * Validates userId is a UUID to prevent path traversal
 */
export function buildWorkspacePath(
    userId: string,
    owner: string,
    repo: string
): string {
    // Validate userId is a valid UUID (defense in depth)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        throw new Error(`Invalid userId format: ${userId}`);
    }

    const workspacesDir = getWorkspacesDir();
    const dirName = buildWorkspaceDirName(owner, repo);
    return path.join(workspacesDir, userId, dirName);
}

/**
 * Validate that a path is within the user's workspace directory
 * Prevents path traversal attacks
 */
export function validateWorkspacePath(userId: string, targetPath: string): boolean {
    const workspacesDir = getWorkspacesDir();
    const userDir = path.join(workspacesDir, userId);

    const resolvedTarget = path.resolve(targetPath);
    const resolvedUserDir = path.resolve(userDir);

    if (!resolvedTarget.startsWith(resolvedUserDir + path.sep)) {
        logger.warn(
            { targetPath: resolvedTarget, allowedBase: resolvedUserDir, userId },
            "Path validation failed: outside user workspace"
        );
        return false;
    }

    return true;
}

/**
 * Check if a path is a symlink (security measure)
 */
async function isSymlink(targetPath: string): Promise<boolean> {
    try {
        const stat = await fs.lstat(targetPath);
        return stat.isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Ensure the user's workspace directory exists
 */
export async function ensureUserWorkspaceDir(userId: string): Promise<string> {
    const userDir = path.join(getWorkspacesDir(), userId);
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
}

/**
 * List all workspaces for a user
 */
export async function listUserWorkspaces(userId: string): Promise<Workspace[]> {
    const userDir = path.join(getWorkspacesDir(), userId);
    const workspaces: Workspace[] = [];

    try {
        const entries = await fs.readdir(userDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) {
                continue;
            }

            const workspacePath = path.join(userDir, entry.name);

            // Skip symlinks (security)
            if (await isSymlink(workspacePath)) {
                logger.warn({ workspacePath }, "Skipping symlink workspace");
                continue;
            }

            // Must have .git directory
            try {
                const gitStat = await fs.stat(path.join(workspacePath, ".git"));
                if (!gitStat.isDirectory()) {
                    continue;
                }
            } catch {
                continue;
            }

            const { owner, repo } = parseWorkspaceDirName(entry.name);
            workspaces.push({
                owner,
                repo,
                fullName: `${owner}/${repo}`,
                path: workspacePath,
            });
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            logger.warn({ error, userId }, "Failed to list user workspaces");
        }
    }

    return workspaces;
}

/**
 * Get a specific workspace by owner/repo
 */
export async function getWorkspace(
    userId: string,
    owner: string,
    repo: string
): Promise<Workspace | null> {
    const workspacePath = buildWorkspacePath(userId, owner, repo);

    if (!validateWorkspacePath(userId, workspacePath)) {
        return null;
    }

    try {
        if (await isSymlink(workspacePath)) {
            logger.warn({ workspacePath }, "Workspace is a symlink - rejecting");
            return null;
        }

        const stat = await fs.stat(workspacePath);
        if (!stat.isDirectory()) {
            return null;
        }

        // Must have .git
        await fs.stat(path.join(workspacePath, ".git"));
    } catch {
        return null;
    }

    return {
        owner,
        repo,
        fullName: `${owner}/${repo}`,
        path: workspacePath,
    };
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(
    userId: string,
    owner: string,
    repo: string
): Promise<boolean> {
    const workspacePath = buildWorkspacePath(userId, owner, repo);

    if (!validateWorkspacePath(userId, workspacePath)) {
        logger.error(
            { userId, owner, repo },
            "Attempted to delete workspace outside user dir"
        );
        return false;
    }

    if (await isSymlink(workspacePath)) {
        logger.error({ workspacePath }, "Attempted to delete symlink workspace");
        return false;
    }

    try {
        await fs.rm(workspacePath, { recursive: true, force: true });
        logger.info({ userId, owner, repo, workspacePath }, "Deleted workspace");
        return true;
    } catch (error) {
        logger.error({ error, userId, owner, repo }, "Failed to delete workspace");
        return false;
    }
}

/**
 * Check if workspace has uncommitted changes
 */
export async function hasUncommittedChanges(workspacePath: string): Promise<boolean> {
    try {
        const { stdout } = await execFileAsync("git", [
            "-C",
            workspacePath,
            "status",
            "--porcelain",
        ]);
        return stdout.trim().length > 0;
    } catch {
        return true; // Assume dirty on error to be safe
    }
}

/**
 * Get current git branch for workspace
 */
export async function getCurrentBranch(
    workspacePath: string
): Promise<string | undefined> {
    try {
        const { stdout } = await execFileAsync("git", [
            "-C",
            workspacePath,
            "rev-parse",
            "--abbrev-ref",
            "HEAD",
        ]);
        return stdout.trim() || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Get current commit SHA for workspace
 */
export async function getCurrentCommitSha(
    workspacePath: string
): Promise<string | undefined> {
    try {
        const { stdout } = await execFileAsync("git", [
            "-C",
            workspacePath,
            "rev-parse",
            "HEAD",
        ]);
        return stdout.trim() || undefined;
    } catch {
        return undefined;
    }
}
