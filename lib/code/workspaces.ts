/**
 * Workspace Management for Multi-User Code Mode
 *
 * Handles user-isolated workspaces on persistent disk storage.
 * Each user gets their own directory: /data/workspaces/{userEmail}/{owner}__{repo}/
 *
 * Security model:
 * - Paths are always built from database-controlled values
 * - Every operation validates userEmail ownership
 * - Path traversal is prevented via sanitization and validation
 * - Symlinks are rejected
 */

import * as Sentry from "@sentry/nextjs";
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
 * Sanitize email for use as directory name
 * nick@example.com → nick_example_com
 */
export function sanitizeEmail(email: string): string {
    return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
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
 * Email is sanitized to create a safe directory name
 */
export function buildWorkspacePath(
    userEmail: string,
    owner: string,
    repo: string
): string {
    if (!userEmail || !userEmail.includes("@")) {
        throw new Error(`Invalid email format: ${userEmail}`);
    }

    const workspacesDir = getWorkspacesDir();
    const userDir = sanitizeEmail(userEmail);
    const dirName = buildWorkspaceDirName(owner, repo);
    return path.join(workspacesDir, userDir, dirName);
}

/**
 * Validate that a path is within the user's workspace directory
 * Prevents path traversal attacks
 */
export function validateWorkspacePath(userEmail: string, targetPath: string): boolean {
    // Validate email format before using it
    if (!userEmail || !userEmail.includes("@")) {
        logger.warn({ userEmail }, "Invalid email format in validateWorkspacePath");
        return false;
    }

    const workspacesDir = getWorkspacesDir();
    const userDir = path.join(workspacesDir, sanitizeEmail(userEmail));

    const resolvedTarget = path.resolve(targetPath);
    const resolvedUserDir = path.resolve(userDir);

    if (!resolvedTarget.startsWith(resolvedUserDir + path.sep)) {
        logger.warn(
            { targetPath: resolvedTarget, allowedBase: resolvedUserDir, userEmail },
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
export async function ensureUserWorkspaceDir(userEmail: string): Promise<string> {
    const userDir = path.join(getWorkspacesDir(), sanitizeEmail(userEmail));
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
}

/**
 * List all workspaces for a user
 */
export async function listUserWorkspaces(userEmail: string): Promise<Workspace[]> {
    const userDir = path.join(getWorkspacesDir(), sanitizeEmail(userEmail));
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
            logger.warn({ error, userEmail }, "Failed to list user workspaces");
        }
    }

    return workspaces;
}

/**
 * Get a specific workspace by owner/repo
 */
export async function getWorkspace(
    userEmail: string,
    owner: string,
    repo: string
): Promise<Workspace | null> {
    const workspacePath = buildWorkspacePath(userEmail, owner, repo);

    if (!validateWorkspacePath(userEmail, workspacePath)) {
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

        // Must have .git directory
        const gitStat = await fs.stat(path.join(workspacePath, ".git"));
        if (!gitStat.isDirectory()) {
            return null;
        }
    } catch {
        return null;
    }

    // Parse owner/repo from directory name to ensure consistency with listUserWorkspaces
    const dirName = path.basename(workspacePath);
    const parsed = parseWorkspaceDirName(dirName);

    return {
        owner: parsed.owner,
        repo: parsed.repo,
        fullName: `${parsed.owner}/${parsed.repo}`,
        path: workspacePath,
    };
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(
    userEmail: string,
    owner: string,
    repo: string
): Promise<boolean> {
    const workspacePath = buildWorkspacePath(userEmail, owner, repo);

    if (!validateWorkspacePath(userEmail, workspacePath)) {
        logger.error(
            { userEmail, owner, repo },
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
        logger.info({ userEmail, owner, repo, workspacePath }, "Deleted workspace");
        return true;
    } catch (error) {
        logger.error({ error, userEmail, owner, repo }, "Failed to delete workspace");
        Sentry.captureException(error, {
            tags: { component: "code-mode", operation: "delete_workspace" },
            extra: { userEmail, owner, repo },
        });
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
