/**
 * Workspace Management for Multi-User Code Mode
 *
 * Handles user-isolated workspaces on persistent disk storage.
 * Each user gets their own directory: /data/workspaces/{userId}/{owner}_{repo}/
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
 * Metadata stored in .workspace.json for each workspace
 */
export interface WorkspaceMetadata {
    owner: string;
    repo: string;
    fullName: string;
    defaultBranch: string;
    currentBranch?: string;
    lastCommitSha?: string;
    lastAccessedAt: string;
    lastSyncedAt?: string;
    createdAt: string;
    hasUncommittedChanges?: boolean;
}

/**
 * Workspace with computed properties
 */
export interface Workspace extends WorkspaceMetadata {
    path: string;
    sizeBytes?: number;
}

/**
 * Get the base data directory from environment
 * Falls back to /data for production, /tmp/carmenta-workspaces for dev
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
 * Format: {owner}_{repo} with sanitized names
 */
export function buildWorkspaceDirName(owner: string, repo: string): string {
    return `${sanitizeRepoName(owner)}_${sanitizeRepoName(repo)}`;
}

/**
 * Build the full filesystem path for a workspace
 */
export function buildWorkspacePath(
    userId: string,
    owner: string,
    repo: string
): string {
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

    // Resolve to absolute path
    const resolvedTarget = path.resolve(targetPath);
    const resolvedUserDir = path.resolve(userDir);

    // Must be within user's directory (not equal to it, and not escaping it)
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
 * Read workspace metadata from .workspace.json
 */
export async function getWorkspaceMetadata(
    workspacePath: string
): Promise<WorkspaceMetadata | null> {
    try {
        const metadataPath = path.join(workspacePath, ".workspace.json");
        const content = await fs.readFile(metadataPath, "utf-8");
        return JSON.parse(content) as WorkspaceMetadata;
    } catch {
        return null;
    }
}

/**
 * Write workspace metadata to .workspace.json
 */
export async function updateWorkspaceMetadata(
    workspacePath: string,
    metadata: Partial<WorkspaceMetadata>
): Promise<void> {
    const metadataPath = path.join(workspacePath, ".workspace.json");

    // Read existing metadata or create new
    let existing: WorkspaceMetadata | null = null;
    try {
        const content = await fs.readFile(metadataPath, "utf-8");
        existing = JSON.parse(content) as WorkspaceMetadata;
    } catch {
        // No existing metadata
    }

    const updated: WorkspaceMetadata = {
        ...(existing ?? {
            owner: "",
            repo: "",
            fullName: "",
            defaultBranch: "main",
            createdAt: new Date().toISOString(),
        }),
        ...metadata,
        lastAccessedAt: new Date().toISOString(),
    } as WorkspaceMetadata;

    await fs.writeFile(metadataPath, JSON.stringify(updated, null, 2));
}

/**
 * Touch workspace to update last accessed time
 */
export async function touchWorkspace(workspacePath: string): Promise<void> {
    await updateWorkspaceMetadata(workspacePath, {
        lastAccessedAt: new Date().toISOString(),
    });
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

            // Check for .git directory (must be a git repo)
            try {
                const gitStat = await fs.stat(path.join(workspacePath, ".git"));
                if (!gitStat.isDirectory()) {
                    continue;
                }
            } catch {
                continue;
            }

            const metadata = await getWorkspaceMetadata(workspacePath);
            if (metadata) {
                workspaces.push({
                    ...metadata,
                    path: workspacePath,
                });
            } else {
                // Workspace without metadata - try to infer from directory name
                const [owner, ...repoParts] = entry.name.split("_");
                const repo = repoParts.join("_");
                workspaces.push({
                    owner: owner ?? "unknown",
                    repo: repo ?? entry.name,
                    fullName: `${owner}/${repo}`,
                    defaultBranch: "main",
                    lastAccessedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    path: workspacePath,
                });
            }
        }
    } catch (error) {
        // User directory doesn't exist yet - that's fine
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            logger.warn({ error, userId }, "Failed to list user workspaces");
        }
    }

    // Sort by last accessed (most recent first)
    workspaces.sort((a, b) => {
        const aTime = new Date(a.lastAccessedAt).getTime();
        const bTime = new Date(b.lastAccessedAt).getTime();
        return bTime - aTime;
    });

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

    // Validate path is within user's directory
    if (!validateWorkspacePath(userId, workspacePath)) {
        return null;
    }

    // Check directory exists and is not a symlink
    try {
        if (await isSymlink(workspacePath)) {
            logger.warn({ workspacePath }, "Workspace is a symlink - rejecting");
            return null;
        }

        const stat = await fs.stat(workspacePath);
        if (!stat.isDirectory()) {
            return null;
        }
    } catch {
        return null;
    }

    // Check it's a git repo
    try {
        await fs.stat(path.join(workspacePath, ".git"));
    } catch {
        return null;
    }

    const metadata = await getWorkspaceMetadata(workspacePath);
    return metadata ? { ...metadata, path: workspacePath } : null;
}

/**
 * Calculate disk usage for a directory using du
 * Uses execFile to prevent command injection
 */
export async function calculateWorkspaceSize(workspacePath: string): Promise<number> {
    try {
        const { stdout } = await execFileAsync("du", ["-sb", workspacePath]);
        const sizeStr = stdout.split("\t")[0];
        return parseInt(sizeStr ?? "0", 10);
    } catch {
        return 0;
    }
}

/**
 * Calculate total disk usage for a user's workspaces
 */
export async function calculateUserDiskUsage(userId: string): Promise<number> {
    const userDir = path.join(getWorkspacesDir(), userId);
    return calculateWorkspaceSize(userDir);
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

    // Validate path is within user's directory
    if (!validateWorkspacePath(userId, workspacePath)) {
        logger.error(
            { userId, owner, repo },
            "Attempted to delete workspace outside user dir"
        );
        return false;
    }

    // Check it's not a symlink
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
 * Uses execFile to prevent command injection
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
        return false;
    }
}

/**
 * Get current git branch for workspace
 * Uses execFile to prevent command injection
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
 * Uses execFile to prevent command injection
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

/**
 * Cleanup options
 */
export interface CleanupOptions {
    maxAgeDays: number;
    maxSizeBytes?: number;
    dryRun?: boolean;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
    deleted: Array<{ owner: string; repo: string; reason: string }>;
    skipped: Array<{ owner: string; repo: string; reason: string }>;
    freedBytes: number;
}

/**
 * Cleanup old workspaces for a user
 */
export async function cleanupUserWorkspaces(
    userId: string,
    options: CleanupOptions
): Promise<CleanupResult> {
    const result: CleanupResult = {
        deleted: [],
        skipped: [],
        freedBytes: 0,
    };

    const workspaces = await listUserWorkspaces(userId);
    const now = Date.now();
    const maxAgeMs = options.maxAgeDays * 24 * 60 * 60 * 1000;

    for (const workspace of workspaces) {
        const lastAccessed = new Date(workspace.lastAccessedAt).getTime();

        // Skip workspaces with invalid timestamps
        if (Number.isNaN(lastAccessed)) {
            result.skipped.push({
                owner: workspace.owner,
                repo: workspace.repo,
                reason: "Invalid lastAccessedAt timestamp",
            });
            continue;
        }

        const age = now - lastAccessed;

        if (age < maxAgeMs) {
            // Not old enough to clean up
            continue;
        }

        // Check for uncommitted changes
        const hasChanges = await hasUncommittedChanges(workspace.path);
        if (hasChanges) {
            result.skipped.push({
                owner: workspace.owner,
                repo: workspace.repo,
                reason: "Has uncommitted changes",
            });
            continue;
        }

        // Calculate size before deleting
        const size = await calculateWorkspaceSize(workspace.path);

        if (options.dryRun) {
            result.deleted.push({
                owner: workspace.owner,
                repo: workspace.repo,
                reason: `Inactive for ${Math.floor(age / (24 * 60 * 60 * 1000))} days (dry run)`,
            });
            result.freedBytes += size;
        } else {
            const deleted = await deleteWorkspace(
                userId,
                workspace.owner,
                workspace.repo
            );
            if (deleted) {
                result.deleted.push({
                    owner: workspace.owner,
                    repo: workspace.repo,
                    reason: `Inactive for ${Math.floor(age / (24 * 60 * 60 * 1000))} days`,
                });
                result.freedBytes += size;
            }
        }
    }

    logger.info(
        {
            userId,
            deleted: result.deleted.length,
            skipped: result.skipped.length,
            freedBytes: result.freedBytes,
            dryRun: options.dryRun,
        },
        "Workspace cleanup completed"
    );

    return result;
}

/**
 * Cleanup old workspaces for all users
 */
export async function cleanupAllWorkspaces(
    options: CleanupOptions
): Promise<Map<string, CleanupResult>> {
    const results = new Map<string, CleanupResult>();
    const workspacesDir = getWorkspacesDir();

    try {
        const entries = await fs.readdir(workspacesDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) {
                continue;
            }

            // entry.name is the userId
            const userId = entry.name;
            const result = await cleanupUserWorkspaces(userId, options);
            results.set(userId, result);
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            logger.error({ error }, "Failed to cleanup workspaces");
        }
    }

    return results;
}
